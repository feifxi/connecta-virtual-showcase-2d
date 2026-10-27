import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { Event, EventStatus } from '@connecta/db';
import { isSheetComplete } from '@connecta/shared';
import { planLimits } from '../../common/plan.js';
import { AppError } from '../../common/problem.js';
import { Audit } from '../../infra/audit.js';
import { HallBus } from '../../infra/bus.js';
import { Db } from '../../infra/db.js';
import { InvitesService } from '../people/invites.service.js';

// docs/data-model.md → สถานะของงาน
const NEXT: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['PUBLISHED', 'LIVE'],
  PUBLISHED: ['LIVE'],
  LIVE: ['EXHIBITION'],
  EXHIBITION: ['ARCHIVED'],
  ARCHIVED: [],
};

@Injectable()
export class LifecycleService {
  private readonly log = new Logger(LifecycleService.name);

  constructor(
    private readonly db: Db,
    private readonly invites: InvitesService,
    private readonly bus: HallBus,
    private readonly audit: Audit,
  ) {}

  async transition(event: Event, to: EventStatus, actorId: string | null) {
    if (event.status === to) return event;
    if (!NEXT[event.status].includes(to)) throw new AppError('INVALID_STATUS_TRANSITION', `${event.status} → ${to} is not allowed`);
    let updated: Event;
    if (to === 'EXHIBITION') updated = await this.endEvent(event);
    else updated = await this.db.event.update({ where: { id: event.id, status: event.status }, data: { status: to, ...(to === 'LIVE' && event.startsAt > new Date() && { startsAt: new Date() }) } });

    if ((to === 'PUBLISHED' || to === 'LIVE') && event.status === 'DRAFT') await this.invites.sendPending(event.id, actorId ?? event.createdById);
    if (to === 'LIVE') await this.notifyInterested(updated);
    await this.bus.publish(event.id, { type: 'statusChanged', status: to });
    await this.audit.log(event.id, actorId ?? event.createdById, `event.${to.toLowerCase()}`, event.id, { from: event.status, auto: !actorId });
    return updated;
  }

  /** Ending = close judging + Popular Vote in one transaction · complete drafts count, incomplete ones don't */
  private async endEvent(event: Event) {
    const limits = await planLimits(this.db, event);
    return this.db.$transaction(async (tx) => {
      const rubric = await tx.rubric.findUnique({ where: { eventId: event.id }, include: { criteria: true } });
      if (rubric) {
        const drafts = await tx.scoreSheet.findMany({ where: { status: 'DRAFT', project: { eventId: event.id } }, include: { scores: true } });
        const criteria = rubric.criteria.map((c) => ({ id: c.id, maxScore: c.maxScore, weight: Number(c.weight) }));
        const done = drafts.filter((d) => isSheetComplete(criteria, d.scores.map((s) => ({ criterionId: s.criterionId, score: Number(s.score) }))));
        if (done.length) await tx.scoreSheet.updateMany({ where: { id: { in: done.map((d) => d.id) } }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
      }
      return tx.event.update({
        where: { id: event.id, status: 'LIVE' },
        data: { status: 'EXHIBITION', endsAt: new Date() < event.endsAt ? new Date() : event.endsAt, exhibitionUntil: new Date(Date.now() + limits.exhibitionDays * 86_400_000) },
      });
    });
  }

  private async notifyInterested(event: Event) {
    const people = await this.db.eventInterest.findMany({ where: { eventId: event.id }, select: { userId: true } });
    if (!people.length) return;
    await this.db.notification.createMany({ data: people.map((p) => ({ userId: p.userId, kind: 'hall_open', payload: { eventId: event.id, slug: event.slug, title: event.title } })) });
  }

  /** Scheduled status changes · the event ends by itself even if nobody presses the button */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = new Date();
    const due = await this.db.event.findMany({
      where: {
        suspendedAt: null,
        OR: [
          { status: 'PUBLISHED', hallOpenMode: 'SCHEDULE', startsAt: { lte: now } },
          { status: 'LIVE', endsAt: { lte: now } },
          { status: 'EXHIBITION', exhibitionUntil: { lte: now } },
        ],
      },
    });
    for (const e of due) {
      const to: EventStatus = e.status === 'PUBLISHED' ? 'LIVE' : e.status === 'LIVE' ? 'EXHIBITION' : 'ARCHIVED';
      await this.transition(e, to, null).catch((err) => this.log.error(`auto ${e.id} → ${to}: ${err.message}`));
    }
    await this.warnEnding(now);
  }

  /** Admins get one in-app warning 30 minutes before the end */
  private async warnEnding(now: Date) {
    const soon = await this.db.event.findMany({ where: { status: 'LIVE', endsAt: { gt: now, lte: new Date(now.getTime() + 30 * 60_000) } }, select: { id: true, slug: true, title: true, endsAt: true } });
    for (const e of soon) {
      const admins = await this.db.eventMember.findMany({ where: { eventId: e.id, roles: { has: 'ADMIN' } }, select: { userId: true } });
      for (const a of admins) {
        const sent = await this.db.notification.count({ where: { userId: a.userId, kind: 'ending_soon', payload: { path: ['eventId'], equals: e.id } } });
        if (!sent) await this.db.notification.create({ data: { userId: a.userId, kind: 'ending_soon', payload: { eventId: e.id, slug: e.slug, title: e.title, endsAt: e.endsAt.toISOString() } } });
      }
    }
  }
}
