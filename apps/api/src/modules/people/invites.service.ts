import { Injectable } from '@nestjs/common';
import type { EventInvite, EventRole } from '@connecta/db';
import { INVITE_TTL_DAYS, INVITES_PER_DAY_PER_EVENT, type InviteLookup, type MyInvite } from '@connecta/shared';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { iso, maskEmail, personSelect, toPerson } from '../../common/mappers.js';
import { judgeCount, planLimits, reservedSeats } from '../../common/plan.js';
import { AppError } from '../../common/problem.js';
import { hashToken, newToken } from '../../common/tokens.js';
import { siteUrl } from '../../env.js';
import { Audit } from '../../infra/audit.js';
import { HallBus } from '../../infra/bus.js';
import { Db } from '../../infra/db.js';
import { Mail } from '../../infra/mail.js';

const ROLE_WORD: Record<EventRole, string> = { ADMIN: 'an Admin', PRESENTER: 'a Presenter', JUDGE: 'a Judge' };
const inviteInclude = { project: { select: { title: true } }, acceptedBy: { select: personSelect } } as const;

@Injectable()
export class InvitesService {
  constructor(
    private readonly db: Db,
    private readonly mail: Mail,
    private readonly audit: Audit,
    private readonly bus: HallBus,
  ) {}

  async list(eventId: string, status?: string) {
    // pending invites past their date are reported as expired
    await this.db.eventInvite.updateMany({ where: { eventId, status: 'PENDING', expiresAt: { lte: new Date() } }, data: { status: 'EXPIRED' } });
    const rows = await this.db.eventInvite.findMany({
      where: { eventId, ...(status && { status: status as EventInvite['status'] }) },
      include: inviteInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((i) => ({
      id: i.id,
      email: i.email,
      roles: i.roles,
      projectId: i.projectId,
      projectTitle: i.project?.title ?? null,
      status: i.status,
      createdAt: iso(i.createdAt),
      expiresAt: iso(i.expiresAt),
      acceptedBy: i.acceptedBy ? toPerson(i.acceptedBy) : null,
    }));
  }

  /**
   * Admin invites by email · same email already pending for the same role/project = resend (old link stops working)
   * Every invite holds a seat in the hall · plan limits checked here, not in the UI
   */
  async create(ctx: AccessCtx, actor: AuthUser, emails: string[], roles: EventRole[], projectId?: string) {
    const event = ctx.event;
    const unique = [...new Set(emails.map((e) => e.toLowerCase()))];
    if (projectId) {
      const p = await this.db.project.findUnique({ where: { id: projectId }, select: { eventId: true } });
      if (p?.eventId !== event.id) throw new AppError('NOT_FOUND', 'Project not in this event');
      if (!roles.includes('PRESENTER')) throw new AppError('VALIDATION_FAILED', 'A project invite must include the PRESENTER role');
    } else if (roles.includes('PRESENTER')) {
      throw new AppError('VALIDATION_FAILED', 'Presenter invites need a project');
    }

    const since = new Date(Date.now() - 86_400_000);
    const today = await this.db.eventInvite.count({ where: { eventId: event.id, createdAt: { gt: since } } });
    if (today + unique.length > INVITES_PER_DAY_PER_EVENT) throw new AppError('RATE_LIMITED', 'Daily invite limit for this event reached');

    const pendingSame = await this.db.eventInvite.findMany({
      where: { eventId: event.id, email: { in: unique }, status: 'PENDING', projectId: projectId ?? null },
      select: { id: true, email: true },
    });
    const resent = new Set(pendingSame.map((i) => i.email));
    const fresh = unique.length - resent.size;
    const limits = await planLimits(this.db, event);
    const reserved = await reservedSeats(this.db, event.id);
    if (reserved + fresh > event.capacity) {
      throw new AppError('PLAN_LIMIT', `Invites hold seats: ${reserved + fresh} of ${event.capacity}. Raise the hall capacity or upgrade.`, { reserved, capacity: event.capacity });
    }
    if (roles.includes('JUDGE') && (await judgeCount(this.db, event.id)) + fresh > limits.judges) {
      throw new AppError('PLAN_LIMIT', `This plan allows up to ${limits.judges} judges.`);
    }

    const created: { invite: EventInvite; token: string }[] = [];
    await this.db.$transaction(async (tx) => {
      if (pendingSame.length) await tx.eventInvite.updateMany({ where: { id: { in: pendingSame.map((i) => i.id) } }, data: { status: 'REVOKED' } });
      for (const email of unique) {
        const { token, hash } = newToken();
        const invite = await tx.eventInvite.create({
          data: { eventId: event.id, email, roles, projectId: projectId ?? null, tokenHash: hash, invitedById: actor.id, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000) },
        });
        created.push({ invite, token });
      }
    });
    // Draft events send invites when published (tokens are re-issued then, since only hashes are stored)
    if (event.status !== 'DRAFT') await Promise.all(created.map((c) => this.deliver(c.invite, c.token, actor.id)));
    await this.audit.log(event.id, actor.id, 'invite.create', null, { emails: unique, roles, projectId: projectId ?? null });
    return { sent: event.status !== 'DRAFT', count: created.length };
  }

  /** Presenter invites teammates into their own booth only */
  async createForProject(ctx: AccessCtx, actor: AuthUser, emails: string[]) {
    return this.create(ctx, actor, emails, ['PRESENTER'], ctx.project!.id);
  }

  /** On publish: re-issue tokens for every pending invite of the event and email them */
  async sendPending(eventId: string, actorId: string) {
    const pending = await this.db.eventInvite.findMany({ where: { eventId, status: 'PENDING', expiresAt: { gt: new Date() } } });
    for (const invite of pending) {
      const { token, hash } = newToken();
      const updated = await this.db.eventInvite.update({ where: { id: invite.id }, data: { tokenHash: hash, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000) } });
      await this.deliver(updated, token, actorId);
    }
    return pending.length;
  }

  private async deliver(invite: EventInvite, token: string, actorId: string) {
    const [event, inviter, project] = await Promise.all([
      this.db.event.findUniqueOrThrow({ where: { id: invite.eventId }, select: { title: true } }),
      this.db.user.findUniqueOrThrow({ where: { id: invite.invitedById }, select: { displayName: true, name: true } }),
      invite.projectId ? this.db.project.findUnique({ where: { id: invite.projectId }, select: { title: true } }) : null,
    ]);
    const who = inviter.displayName || inviter.name;
    const as = invite.roles.map((r) => ROLE_WORD[r]).join(' and ');
    const forProject = project ? ` for "${project.title}"` : '';
    await this.mail.sendButton(
      invite.email,
      `${who} invited you to ${event.title}`,
      `You're invited to ${event.title}`,
      `${who} invited you to join as ${as}${forProject}. The link works once and expires in ${INVITE_TTL_DAYS} days.`,
      'Accept invite',
      `${siteUrl}/invite/${token}`,
    );
    // in-app too, when the address already has an account
    const owner = await this.ownerOfEmail(invite.email);
    if (owner) await this.db.notification.create({ data: { userId: owner, kind: 'invite', payload: { inviteId: invite.id, eventTitle: event.title, roles: invite.roles } } });
    await this.audit.track(invite.eventId, 'invite_sent', actorId, invite.projectId, { inviteId: invite.id });
  }

  private async ownerOfEmail(email: string) {
    const u = await this.db.user.findUnique({ where: { email }, select: { id: true } });
    if (u) return u.id;
    return (await this.db.userEmail.findUnique({ where: { email }, select: { userId: true } }))?.userId ?? null;
  }

  async revoke(eventId: string, inviteId: string, actorId: string) {
    const invite = await this.db.eventInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.eventId !== eventId) throw new AppError('NOT_FOUND');
    if (invite.status !== 'PENDING') throw new AppError('INVALID_STATUS_TRANSITION', 'Only pending invites can be revoked');
    await this.db.eventInvite.update({ where: { id: inviteId }, data: { status: 'REVOKED' } });
    await this.audit.log(eventId, actorId, 'invite.revoke', inviteId);
  }

  // ---------- receiving side ----------

  private async byToken(token: string) {
    const invite = await this.db.eventInvite.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!invite) throw new AppError('INVITE_REVOKED');
    return invite;
  }

  private assertUsable(invite: EventInvite) {
    if (invite.status === 'ACCEPTED') throw new AppError('INVITE_USED');
    if (invite.status === 'REVOKED') throw new AppError('INVITE_REVOKED');
    if (invite.status === 'EXPIRED' || invite.expiresAt <= new Date()) throw new AppError('INVITE_EXPIRED');
  }

  private async lookupShape(invite: EventInvite) {
    const [event, inviter, project] = await Promise.all([
      this.db.event.findUniqueOrThrow({ where: { id: invite.eventId }, select: { id: true, slug: true, title: true } }),
      this.db.user.findUniqueOrThrow({ where: { id: invite.invitedById }, select: { displayName: true, name: true } }),
      invite.projectId ? this.db.project.findUnique({ where: { id: invite.projectId }, select: { title: true } }) : null,
    ]);
    return { id: invite.id, eventId: event.id, eventSlug: event.slug, eventTitle: event.title, roles: invite.roles, projectTitle: project?.title ?? null, invitedByName: inviter.displayName || inviter.name };
  }

  async lookup(token: string, user: AuthUser): Promise<InviteLookup> {
    const invite = await this.byToken(token);
    this.assertUsable(invite);
    const emails = await this.emailsOf(user.id);
    return { ...(await this.lookupShape(invite)), maskedEmail: maskEmail(invite.email), matchesAccount: emails.includes(invite.email.toLowerCase()) };
  }

  private async emailsOf(userId: string) {
    const [u, extra] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } }),
      this.db.userEmail.findMany({ where: { userId }, select: { email: true } }),
    ]);
    return [u.email, ...extra.map((e) => e.email)].map((e) => e.toLowerCase());
  }

  /** Invites addressed to any email this account owns (shown on Home) */
  async mine(userId: string): Promise<MyInvite[]> {
    const emails = await this.emailsOf(userId);
    const rows = await this.db.eventInvite.findMany({ where: { email: { in: emails }, status: 'PENDING', expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    return Promise.all(rows.map((r) => this.lookupShape(r)));
  }

  acceptToken(token: string, user: AuthUser) {
    return this.byToken(token).then((invite) => this.accept(invite, user));
  }

  async acceptMine(inviteId: string, user: AuthUser) {
    const invite = await this.db.eventInvite.findUnique({ where: { id: inviteId } });
    if (!invite || !(await this.emailsOf(user.id)).includes(invite.email.toLowerCase())) throw new AppError('NOT_FOUND');
    return this.accept(invite, user);
  }

  /** Accepting with another account is allowed · that email is then remembered for the account */
  private async accept(invite: EventInvite, user: AuthUser) {
    this.assertUsable(invite);
    const account = await this.db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
    const roles = await this.db.$transaction(async (tx) => {
      // single use even under double clicks: only one update can flip PENDING → ACCEPTED
      const flipped = await tx.eventInvite.updateMany({ where: { id: invite.id, status: 'PENDING' }, data: { status: 'ACCEPTED', acceptedById: user.id, acceptedAt: new Date() } });
      if (!flipped.count) throw new AppError('INVITE_USED');
      if (account.email.toLowerCase() !== invite.email.toLowerCase()) {
        const taken = await tx.userEmail.findUnique({ where: { email: invite.email } });
        if (!taken) await tx.userEmail.create({ data: { userId: user.id, email: invite.email } });
      }
      const existing = await tx.eventMember.findUnique({ where: { eventId_userId: { eventId: invite.eventId, userId: user.id } } });
      const merged = [...new Set([...(existing?.roles ?? []), ...invite.roles])];
      await tx.eventMember.upsert({
        where: { eventId_userId: { eventId: invite.eventId, userId: user.id } },
        create: { eventId: invite.eventId, userId: user.id, roles: merged, assignedById: invite.invitedById },
        update: { roles: merged },
      });
      if (invite.projectId) await tx.projectMember.upsert({ where: { projectId_userId: { projectId: invite.projectId, userId: user.id } }, create: { projectId: invite.projectId, userId: user.id }, update: {} });
      return merged;
    });
    await this.bus.publish(invite.eventId, { type: 'roleChanged', userId: user.id, roles });
    await this.audit.track(invite.eventId, 'invite_accepted', user.id, invite.projectId, { inviteId: invite.id });
    const event = await this.db.event.findUniqueOrThrow({ where: { id: invite.eventId }, select: { slug: true } });
    return { eventSlug: event.slug, roles: invite.roles, projectId: invite.projectId };
  }
}

