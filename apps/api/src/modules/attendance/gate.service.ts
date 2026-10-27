import { Injectable } from '@nestjs/common';
import type { ErrorCode } from '@connecta/shared';
import type { AccessCtx } from '../../common/auth/access.js';
import { reservedSeats } from '../../common/plan.js';
import { Db } from '../../infra/db.js';

/**
 * The single gate into the hall (docs/technical.md → Auth: "ด่านเข้าฮอลล์จึงอยู่ใน API ที่เดียว")
 * Order matters: the first failing rule is the reason shown to the user.
 * Roles from invites always get in · domain lock, pause and the full-hall rule apply to Visitors only.
 */
@Injectable()
export class GateService {
  constructor(private readonly db: Db) {}

  async check(ctx: AccessCtx, opts: { requireForm: boolean }): Promise<{ code: ErrorCode; extra?: Record<string, unknown> } | null> {
    const { event, user } = ctx;
    if (!user) return { code: 'UNAUTHENTICATED' };
    if (ctx.banned) return { code: 'BANNED' };
    if (event.status !== 'LIVE' && event.status !== 'EXHIBITION') return { code: 'HALL_NOT_OPEN' };
    const visitor = ctx.roles.size === 0;
    if (visitor && event.allowedDomain && !(await this.ownsDomain(user.id, event.allowedDomain))) return { code: 'DOMAIN_NOT_ALLOWED', extra: { domain: event.allowedDomain } };
    if (opts.requireForm && !ctx.attendee) return { code: 'JOIN_FORM_REQUIRED' };
    if (visitor && event.entryPaused) return { code: 'ENTRY_PAUSED' };
    if (visitor) {
      const [online, reserved] = await Promise.all([this.onlineVisitors(event.id, user.id), reservedSeats(this.db, event.id)]);
      const seats = Math.max(0, event.capacity - reserved);
      if (online.others >= seats && !online.mine) return { code: 'HALL_FULL', extra: { online: online.others, capacity: seats, retryAfter: 60 } };
    }
    return null;
  }

  /** Verified emails only: the account email (OAuth / magic link) or one proven through an invite link */
  private async ownsDomain(userId: string, domain: string) {
    const [u, extra] = await Promise.all([
      this.db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerified: true } }),
      this.db.userEmail.findMany({ where: { userId }, select: { email: true } }),
    ]);
    const emails = [...(u.emailVerified ? [u.email] : []), ...extra.map((e) => e.email)];
    return emails.some((e) => e.toLowerCase().endsWith(`@${domain.toLowerCase()}`));
  }

  /** Visitors in the hall now · invited roles sit on reserved seats, so they don't count here */
  private async onlineVisitors(eventId: string, userId: string) {
    const members = await this.db.eventMember.findMany({ where: { eventId }, select: { userId: true } });
    const roleHolders = new Set(members.map((m) => m.userId));
    const rows = await this.db.presenceSession.findMany({ where: { eventId, leftAt: null }, select: { userId: true }, distinct: ['userId'] });
    const visitors = rows.filter((r) => !roleHolders.has(r.userId));
    return { others: visitors.filter((r) => r.userId !== userId).length, mine: rows.some((r) => r.userId === userId) };
  }

  /** People in the hall now (open presence sessions written by realtime) · rejoining yourself never counts as a new seat */
  async online(eventId: string, userId?: string) {
    const rows = await this.db.presenceSession.findMany({ where: { eventId, leftAt: null }, select: { userId: true }, distinct: ['userId'] });
    return { others: rows.filter((r) => r.userId !== userId).length, mine: !!userId && rows.some((r) => r.userId === userId), total: rows.length };
  }
}
