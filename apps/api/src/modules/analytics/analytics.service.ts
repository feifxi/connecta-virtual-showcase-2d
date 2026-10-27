import { Injectable } from '@nestjs/common';
import type { Event } from '@connecta/db';
import { mean, type FormField } from '@connecta/shared';
import type { AccessCtx } from '../../common/auth/access.js';
import { Db } from '../../infra/db.js';
import { EngagementService } from '../engagement/engagement.service.js';
import { JudgingService } from '../judging/judging.service.js';

const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;
const INTERVAL_MS = { '1m': 60_000, '5m': 300_000, '15m': 900_000, '60m': 3_600_000 } as const;

/** Post-event report for Admins (docs/features.md → Analytics) · computed from raw rows, nothing pre-aggregated except the heatmap */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly db: Db,
    private readonly judging: JudgingService,
    private readonly engagement: EngagementService,
  ) {}

  private async sessions(eventId: string) {
    return this.db.presenceSession.findMany({ where: { eventId }, select: { userId: true, joinedAt: true, leftAt: true } });
  }

  async summary(e: Event) {
    const [interests, attendees, sessions, boothVisits, feedbackCount, voteCount] = await Promise.all([
      this.db.eventInterest.findMany({ where: { eventId: e.id }, select: { userId: true } }),
      this.db.eventAttendee.findMany({ where: { eventId: e.id }, select: { userId: true } }),
      this.sessions(e.id),
      this.db.boothVisit.count({ where: { eventId: e.id } }),
      this.db.feedback.count({ where: { project: { eventId: e.id } } }),
      this.db.vote.count({ where: { eventId: e.id } }),
    ]);
    const interested = new Set(interests.map((i) => i.userId));
    const fromInterested = attendees.filter((a) => interested.has(a.userId)).length;

    // peak = max overlapping sessions (sweep over join/leave instants)
    const now = new Date();
    const points = sessions.flatMap((s) => [
      { t: s.joinedAt.getTime(), d: 1 },
      { t: (s.leftAt ?? now).getTime(), d: -1 },
    ]);
    points.sort((a, b) => a.t - b.t || a.d - b.d);
    let online = 0;
    let peak = 0;
    let peakAt: number | null = null;
    for (const p of points) {
      online += p.d;
      if (online > peak) (peak = online), (peakAt = p.t);
    }
    const perUser = new Map<string, number>();
    for (const s of sessions) perUser.set(s.userId, (perUser.get(s.userId) ?? 0) + minutes(s.joinedAt, s.leftAt ?? now));

    return {
      interested: interested.size,
      attended: attendees.length,
      attendedFromInterested: fromInterested,
      walkIns: attendees.length - fromInterested,
      peakConcurrent: peak,
      peakAt: peakAt ? new Date(peakAt).toISOString() : null,
      avgMinutes: mean([...perUser.values()]),
      boothVisits,
      feedbackCount,
      voteCount,
    };
  }

  async attendance(e: Event, interval: keyof typeof INTERVAL_MS) {
    const sessions = await this.sessions(e.id);
    const step = INTERVAL_MS[interval];
    const now = Date.now();
    const first = Math.min(e.startsAt.getTime(), ...sessions.map((s) => s.joinedAt.getTime()));
    const last = Math.min(now, Math.max(e.endsAt.getTime(), ...sessions.map((s) => (s.leftAt?.getTime() ?? now))));
    const out: { at: string; online: number }[] = [];
    for (let t = Math.floor(first / step) * step; t <= last && out.length < 2000; t += step) {
      out.push({ at: new Date(t).toISOString(), online: new Set(sessions.filter((s) => s.joinedAt.getTime() <= t && (s.leftAt?.getTime() ?? now) > t).map((s) => s.userId)).size });
    }
    return out;
  }

  async booths(eventId: string) {
    const [projects, visits, events, feedback, results] = await Promise.all([
      this.db.project.findMany({ where: { eventId }, select: { id: true, title: true, boothSlot: { select: { label: true, fillOrder: true } } } }),
      this.db.boothVisit.findMany({ where: { eventId }, select: { projectId: true, userId: true, enteredAt: true, leftAt: true } }),
      this.db.analyticsEvent.findMany({ where: { eventId, type: { in: ['booth_peek', 'screen_share_view', 'poster_view'] } }, select: { type: true, projectId: true, userId: true } }),
      this.db.feedback.groupBy({ by: ['projectId'], where: { project: { eventId } }, _count: { _all: true } }),
      this.judging.results(eventId),
    ]);
    const now = new Date();
    const fb = new Map(feedback.map((f) => [f.projectId, f._count._all]));
    const res = new Map(results.projects.map((r) => [r.projectId, r]));
    const users = (type: string, projectId: string) => new Set(events.filter((x) => x.type === type && x.projectId === projectId && x.userId).map((x) => x.userId!));
    return projects
      .sort((a, b) => (a.boothSlot?.fillOrder ?? 1e9) - (b.boothSlot?.fillOrder ?? 1e9))
      .map((p) => {
        const mine = visits.filter((v) => v.projectId === p.id);
        const visitors = new Set(mine.map((v) => v.userId));
        const peeked = users('booth_peek', p.id);
        return {
          projectId: p.id,
          title: p.title,
          boothLabel: p.boothSlot?.label ?? null,
          visitors: visitors.size,
          avgMinutes: mean(mine.map((v) => minutes(v.enteredAt, v.leftAt ?? now))),
          // stood next to the booth but never stepped in
          passedBy: [...peeked].filter((u) => !visitors.has(u)).length,
          screenShareViews: users('screen_share_view', p.id).size,
          posterViews: users('poster_view', p.id).size,
          feedback: fb.get(p.id) ?? 0,
          votes: res.get(p.id)?.votes ?? 0,
          percent: res.get(p.id)?.percent ?? null,
        };
      });
  }

  async heatmap(eventId: string) {
    const rows = await this.db.heatmapCount.groupBy({ by: ['cellX', 'cellY'], where: { eventId }, _sum: { samples: true } });
    return rows.map((r) => ({ cellX: r.cellX, cellY: r.cellY, samples: r._sum.samples ?? 0 }));
  }

  async audience(eventId: string) {
    const [types, provinces, form] = await Promise.all([
      this.db.eventAttendee.groupBy({ by: ['visitorType'], where: { eventId }, _count: { _all: true } }),
      this.db.eventAttendee.groupBy({ by: ['province'], where: { eventId }, _count: { _all: true } }),
      this.db.eventForm.findUnique({ where: { eventId_kind: { eventId, kind: 'SURVEY' } }, include: { responses: { select: { answers: true } } } }),
    ]);
    const fields = (form?.fields ?? []) as FormField[];
    const answers = (form?.responses ?? []).map((r) => r.answers as Record<string, unknown>);
    const count = (vals: string[]) => {
      const m = new Map<string, number>();
      for (const v of vals) m.set(v, (m.get(v) ?? 0) + 1);
      return [...m].map(([key, c]) => ({ key, count: c })).sort((a, b) => b.count - a.count);
    };
    return {
      visitorTypes: types.map((t) => ({ key: t.visitorType, count: t._count._all })).sort((a, b) => b.count - a.count),
      provinces: provinces.map((p) => ({ key: p.province, count: p._count._all })).sort((a, b) => b.count - a.count),
      survey: fields.map((f) => {
        const vals = answers.map((a) => a[f.id]).filter((v) => v !== undefined && v !== '');
        const keys = f.type === 'short_text' ? vals.map(() => 'answered') : vals.flatMap((v) => (Array.isArray(v) ? v.map(String) : [String(v)]));
        return { fieldId: f.id, label: f.label, type: f.type, answers: count(keys) };
      }),
    };
  }

  /** The team's own view after the event · scores only once results are announced */
  async presenterSummary(ctx: AccessCtx) {
    const p = ctx.project!;
    const [booths, feedback, contacts] = await Promise.all([this.booths(p.eventId), this.engagement.listFeedback(ctx), this.db.contactRequest.count({ where: { projectId: p.id } })]);
    const booth = booths.find((b) => b.projectId === p.id)!;
    let results = null;
    if (ctx.event.resultsAnnouncedAt) {
      const r = await this.judging.results(p.eventId);
      const mine = r.projects.find((x) => x.projectId === p.id);
      const awards = await this.db.award.findMany({ where: { eventId: p.eventId, projectId: p.id }, select: { kind: true, rank: true } });
      results = {
        percent: mine?.percent ?? null,
        perCriterion: r.criteria.map((c) => ({ name: c.name, percent: mine?.perCriterion[c.id] ?? null })),
        comments: r.sheets.filter((s) => s.projectId === p.id && s.commentVisible && s.comment).map((s) => s.comment!),
        awards,
      };
    } else {
      booth.percent = null; // no scores before the announcement, even to the team
    }
    return { booth, feedback, contactRequests: contacts, results };
  }
}

