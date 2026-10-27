import { Injectable } from '@nestjs/common';
import type { EventRole } from '@connecta/db';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { iso, personSelect, toPerson } from '../../common/mappers.js';
import { judgeCount, planLimits, reservedSeats } from '../../common/plan.js';
import { AppError } from '../../common/problem.js';
import { Audit } from '../../infra/audit.js';
import { HallBus } from '../../infra/bus.js';
import { Db } from '../../infra/db.js';
import { Media } from '../../infra/media.js';

type Tx = Parameters<Parameters<Db['$transaction']>[0]>[0];

@Injectable()
export class MembersService {
  constructor(
    private readonly db: Db,
    private readonly audit: Audit,
    private readonly bus: HallBus,
    private readonly media: Media,
  ) {}

  async list(ctx: AccessCtx) {
    const eventId = ctx.event.id;
    const [rows, reserved] = await Promise.all([
      this.db.eventMember.findMany({ where: { eventId }, include: { user: { select: { ...personSelect, email: true, projectMembers: { where: { project: { eventId } }, select: { projectId: true } } } } }, orderBy: { assignedAt: 'asc' } }),
      reservedSeats(this.db, eventId),
    ]);
    return {
      data: rows.map((m) => ({ ...toPerson(m.user), email: m.user.deletedAt ? '' : m.user.email, roles: m.roles, projectIds: m.user.projectMembers.map((p) => p.projectId), assignedAt: iso(m.assignedAt) })),
      reserved,
      capacity: ctx.event.capacity,
    };
  }

  /** Admin ≥ 1 must hold inside the same transaction as the change */
  private async assertAdminsLeft(tx: Tx, eventId: string) {
    const admins = await tx.eventMember.count({ where: { eventId, roles: { has: 'ADMIN' } } });
    if (admins < 1) throw new AppError('LAST_ADMIN');
  }

  /** Only Admins assign roles · the person must already be in the event (attended or holds a role) */
  async setRoles(ctx: AccessCtx, actor: AuthUser, userId: string, roles: EventRole[]) {
    const eventId = ctx.event.id;
    const unique = [...new Set(roles)];
    const [existing, attendee] = await Promise.all([
      this.db.eventMember.findUnique({ where: { eventId_userId: { eventId, userId } } }),
      this.db.eventAttendee.findUnique({ where: { eventId_userId: { eventId, userId } } }),
    ]);
    if (!existing && !attendee) throw new AppError('NOT_FOUND', 'This person is not in the event');
    if (unique.includes('JUDGE') && !existing?.roles.includes('JUDGE')) {
      const limits = await planLimits(this.db, ctx.event);
      if ((await judgeCount(this.db, eventId)) + 1 > limits.judges) throw new AppError('PLAN_LIMIT', `This plan allows up to ${limits.judges} judges.`);
    }
    if (!existing && unique.length) {
      const reserved = await reservedSeats(this.db, eventId);
      const members = await this.db.eventMember.count({ where: { eventId } });
      if (Math.max(reserved, members) + 1 > ctx.event.capacity) throw new AppError('PLAN_LIMIT', 'Every role holds a seat in the hall and the hall is fully reserved.');
    }
    await this.db.$transaction(async (tx) => {
      if (unique.length) {
        await tx.eventMember.upsert({
          where: { eventId_userId: { eventId, userId } },
          create: { eventId, userId, roles: unique, assignedById: actor.id },
          update: { roles: unique, assignedById: actor.id, assignedAt: new Date() },
        });
      } else if (existing) {
        await tx.eventMember.delete({ where: { eventId_userId: { eventId, userId } } });
      }
      if (!unique.includes('PRESENTER')) await tx.projectMember.deleteMany({ where: { userId, project: { eventId } } });
      await this.assertAdminsLeft(tx, eventId);
    });
    await this.bus.publish(eventId, { type: 'roleChanged', userId, roles: unique });
    await this.audit.log(eventId, actor.id, 'member.roles', userId, { from: existing?.roles ?? [], to: unique });
    return unique;
  }

  /** Admin removes someone's roles, or anyone leaves the event themselves */
  async remove(ctx: AccessCtx, actor: AuthUser, userId: string) {
    if (!ctx.isAdmin && actor.id !== userId) throw new AppError('FORBIDDEN_ROLE');
    const eventId = ctx.event.id;
    await this.db.$transaction(async (tx) => {
      await tx.eventMember.deleteMany({ where: { eventId, userId } });
      await tx.projectMember.deleteMany({ where: { userId, project: { eventId } } });
      await this.assertAdminsLeft(tx, eventId);
    });
    await this.bus.publish(eventId, { type: 'roleChanged', userId, roles: [] });
    await this.audit.log(eventId, actor.id, actor.id === userId ? 'member.leave' : 'member.remove', userId);
  }

  // ---------- bans ----------

  async bans(eventId: string) {
    const rows = await this.db.eventBan.findMany({ where: { eventId }, include: { user: { select: personSelect }, bannedBy: { select: personSelect } }, orderBy: { createdAt: 'desc' } });
    return rows.map((b) => ({ person: toPerson(b.user), reason: b.reason, createdAt: iso(b.createdAt), bannedBy: toPerson(b.bannedBy) }));
  }

  /** Ban = can't enter this event again · kicked out of the hall and media at once */
  async ban(ctx: AccessCtx, actor: AuthUser, userId: string, reason: string) {
    const eventId = ctx.event.id;
    if (userId === actor.id) throw new AppError('FORBIDDEN_ROLE', "You can't ban yourself");
    const member = await this.db.eventMember.findUnique({ where: { eventId_userId: { eventId, userId } } });
    if (member?.roles.includes('ADMIN')) throw new AppError('FORBIDDEN_ROLE', 'Remove the Admin role first');
    await this.db.$transaction([
      this.db.eventBan.upsert({ where: { eventId_userId: { eventId, userId } }, create: { eventId, userId, bannedById: actor.id, reason }, update: { reason, bannedById: actor.id } }),
      this.db.eventMember.deleteMany({ where: { eventId, userId } }),
      this.db.projectMember.deleteMany({ where: { userId, project: { eventId } } }),
    ]);
    await this.bus.publish(eventId, { type: 'kick', userId, reason, banned: true });
    await this.media.remove(eventId, userId);
    await this.audit.log(eventId, actor.id, 'member.ban', userId, {}, reason);
  }

  async unban(eventId: string, actor: AuthUser, userId: string) {
    await this.db.eventBan.deleteMany({ where: { eventId, userId } });
    await this.audit.log(eventId, actor.id, 'member.unban', userId);
  }

  async auditLogs(eventId: string) {
    const rows = await this.db.auditLog.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' }, take: 500 });
    const actors = await this.db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.actorId))] } }, select: personSelect });
    const byId = new Map(actors.map((a) => [a.id, toPerson(a)]));
    return rows.map((r) => ({ id: String(r.id), actor: byId.get(r.actorId) ?? null, action: r.action, targetId: r.targetId, reason: r.reason, data: (r.data ?? {}) as Record<string, unknown>, createdAt: iso(r.createdAt) }));
  }
}
