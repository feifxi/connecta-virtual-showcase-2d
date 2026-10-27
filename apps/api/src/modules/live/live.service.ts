import { Injectable } from '@nestjs/common';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { iso, personSelect, toPerson } from '../../common/mappers.js';
import { AppError } from '../../common/problem.js';
import { Audit } from '../../infra/audit.js';
import { HallBus } from '../../infra/bus.js';
import { Db } from '../../infra/db.js';
import { Media } from '../../infra/media.js';

@Injectable()
export class LiveService {
  constructor(
    private readonly db: Db,
    private readonly bus: HallBus,
    private readonly media: Media,
    private readonly audit: Audit,
  ) {}

  private actorName(userId: string) {
    return this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true, name: true } }).then((u) => u.displayName || u.name);
  }

  /**
   * Admin mutes anyone · a Presenter only people inside their own booth while standing there too
   * Nobody unmutes someone else (docs/features.md → เสียงโซนบูธ) · muting happens in LiveKit, not just the client
   */
  async mute(ctx: AccessCtx, actor: AuthUser, targetId: string, muted: boolean) {
    if (!muted) throw new AppError('CANNOT_UNMUTE_OTHERS');
    if (!ctx.isAdmin) {
      if (!ctx.roles.has('PRESENTER')) throw new AppError('FORBIDDEN_ROLE');
      const [mine, theirs] = await Promise.all([this.bus.boothOf(ctx.event.id, actor.id), this.bus.boothOf(ctx.event.id, targetId)]);
      const presents = mine && (await this.db.projectMember.findUnique({ where: { projectId_userId: { projectId: mine, userId: actor.id } } }));
      if (!presents || theirs !== mine) throw new AppError('FORBIDDEN_ROLE', 'You can mute people inside your own booth only');
    }
    await this.media.muteMicrophone(ctx.event.id, targetId);
    await this.bus.publish(ctx.event.id, { type: 'muted', userId: targetId, by: await this.actorName(actor.id) });
    await this.audit.log(ctx.event.id, actor.id, 'hall.mute', targetId);
  }

  /** Kick = out of the hall now, may come back */
  async kick(ctx: AccessCtx, actor: AuthUser, targetId: string) {
    await this.bus.publish(ctx.event.id, { type: 'kick', userId: targetId, reason: 'An organizer removed you from the hall', banned: false });
    await this.media.remove(ctx.event.id, targetId);
    await this.audit.log(ctx.event.id, actor.id, 'hall.kick', targetId);
  }

  /** Emergency switches: stop new entries · mute every microphone once */
  async settings(ctx: AccessCtx, actor: AuthUser, input: { entryPaused?: boolean; muteAll?: boolean }) {
    if (input.entryPaused !== undefined) {
      await this.db.event.update({ where: { id: ctx.event.id }, data: { entryPaused: input.entryPaused } });
      await this.bus.publish(ctx.event.id, { type: 'settings', entryPaused: input.entryPaused });
      await this.audit.log(ctx.event.id, actor.id, input.entryPaused ? 'hall.pause' : 'hall.resume');
    }
    if (input.muteAll) {
      await this.media.muteAll(ctx.event.id);
      await this.bus.publish(ctx.event.id, { type: 'muted', userId: '*', by: await this.actorName(actor.id) });
      await this.audit.log(ctx.event.id, actor.id, 'hall.mute_all');
    }
  }

  async announce(ctx: AccessCtx, actor: AuthUser, text: string) {
    if (ctx.event.status !== 'LIVE' && ctx.event.status !== 'EXHIBITION') throw new AppError('HALL_NOT_OPEN');
    await this.bus.publish(ctx.event.id, { type: 'announcement', text, byUserId: actor.id, byName: await this.actorName(actor.id) });
    await this.audit.log(ctx.event.id, actor.id, 'hall.announce', null, { text });
  }

  async report(ctx: AccessCtx, actor: AuthUser, input: { targetUserId: string; targetKind: 'USER' | 'CHAT' | 'FEEDBACK'; targetRef?: string; snapshot?: string; reason: string }) {
    if (input.targetUserId === actor.id) throw new AppError('VALIDATION_FAILED', "You can't report yourself");
    const recent = await this.db.report.count({ where: { eventId: ctx.event.id, reporterId: actor.id, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
    if (recent >= 5) throw new AppError('RATE_LIMITED');
    await this.db.report.create({ data: { eventId: ctx.event.id, reporterId: actor.id, ...input, targetRef: input.targetRef ?? null, snapshot: input.snapshot ?? null } });
  }

  async reports(eventId: string, status?: 'OPEN' | 'RESOLVED' | 'DISMISSED') {
    const rows = await this.db.report.findMany({ where: { eventId, ...(status && { status }) }, include: { reporter: { select: personSelect }, targetUser: { select: personSelect } }, orderBy: { createdAt: 'desc' } });
    return rows.map((r) => ({ id: r.id, reporter: toPerson(r.reporter), target: toPerson(r.targetUser), targetKind: r.targetKind, snapshot: r.snapshot, reason: r.reason, status: r.status, createdAt: iso(r.createdAt) }));
  }

  async setReportStatus(eventId: string, actor: AuthUser, reportId: string, status: 'OPEN' | 'RESOLVED' | 'DISMISSED') {
    const { count } = await this.db.report.updateMany({ where: { id: reportId, eventId }, data: { status, handledById: actor.id } });
    if (!count) throw new AppError('NOT_FOUND');
    await this.audit.log(eventId, actor.id, 'report.status', reportId, { status });
  }
}
