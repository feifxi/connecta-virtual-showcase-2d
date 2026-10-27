import { Injectable } from '@nestjs/common';
import type { EventModules, Results, Rubric, ScoreSheet } from '@connecta/shared';
import { isSheetComplete, mean, sheetPercent } from '@connecta/shared';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { isoOrNull, personSelect, projectCardInclude, toPerson, toProjectCard } from '../../common/mappers.js';
import { AppError } from '../../common/problem.js';
import { siteUrl } from '../../env.js';
import { Audit } from '../../infra/audit.js';
import { Db } from '../../infra/db.js';
import { Mail } from '../../infra/mail.js';
import { Storage } from '../../infra/storage.js';

type Criterion = { id: string; maxScore: number; weight: number };
const sheetEtag = (v: number) => `W/"${v}"`;

@Injectable()
export class JudgingService {
  constructor(
    private readonly db: Db,
    private readonly storage: Storage,
    private readonly audit: Audit,
    private readonly mail: Mail,
  ) {}

  module(ctx: AccessCtx) {
    if (!(ctx.event.modules as Partial<EventModules>).judging) throw new AppError('MODULE_DISABLED');
  }

  async rubric(eventId: string): Promise<Rubric> {
    const r = await this.db.rubric.findUnique({ where: { eventId }, include: { criteria: { orderBy: { sort: 'asc' } } } });
    if (!r) return { id: null, lockedAt: null, criteria: [] };
    return {
      id: r.id,
      lockedAt: isoOrNull(r.lockedAt),
      criteria: r.criteria.map((c) => ({ id: c.id, name: c.name, description: c.description, maxScore: c.maxScore, weight: Number(c.weight), sort: c.sort })),
    };
  }

  private async criteria(eventId: string): Promise<Criterion[]> {
    const r = await this.rubric(eventId);
    return r.criteria.map((c) => ({ id: c.id, maxScore: c.maxScore, weight: c.weight }));
  }

  /** One rubric per event · after the first score only descriptions may change */
  async putRubric(ctx: AccessCtx, actor: AuthUser, criteria: { id?: string; name: string; description: string; maxScore: number; weight: number }[]) {
    const eventId = ctx.event.id;
    const current = await this.db.rubric.findUnique({ where: { eventId }, include: { criteria: true } });
    if (current?.lockedAt) {
      const same =
        criteria.length === current.criteria.length &&
        criteria.every((c) => {
          const old = current.criteria.find((o) => o.id === c.id);
          return old && old.name === c.name && old.maxScore === c.maxScore && Number(old.weight) === c.weight;
        });
      if (!same) throw new AppError('RUBRIC_LOCKED');
      await this.db.$transaction(criteria.map((c) => this.db.rubricCriterion.update({ where: { id: c.id! }, data: { description: c.description } })));
    } else {
      await this.db.$transaction(async (tx) => {
        const rubric = current ?? (await tx.rubric.create({ data: { eventId } }));
        const keep = criteria.filter((c) => c.id && rubric && current?.criteria.some((o) => o.id === c.id)).map((c) => c.id!);
        await tx.rubricCriterion.deleteMany({ where: { rubricId: rubric.id, id: { notIn: keep } } });
        for (const [sort, c] of criteria.entries()) {
          const data = { name: c.name, description: c.description, maxScore: c.maxScore, weight: c.weight, sort };
          if (c.id && keep.includes(c.id)) await tx.rubricCriterion.update({ where: { id: c.id }, data });
          else await tx.rubricCriterion.create({ data: { ...data, rubricId: rubric.id } });
        }
      });
    }
    await this.audit.log(eventId, actor.id, 'rubric.update', null, { count: criteria.length });
    return this.rubric(eventId);
  }

  async assignments(eventId: string) {
    const [judges, rows] = await Promise.all([
      this.db.eventMember.findMany({ where: { eventId, roles: { has: 'JUDGE' } }, include: { user: { select: personSelect } } }),
      this.db.judgeAssignment.findMany({ where: { eventId }, select: { judgeId: true, projectId: true } }),
    ]);
    return { judges: judges.map((j) => toPerson(j.user)), assignments: rows };
  }

  /** Replaces the whole set · empty = every judge judges every project */
  async putAssignments(ctx: AccessCtx, actor: AuthUser, rows: { judgeId: string; projectId: string }[]) {
    const eventId = ctx.event.id;
    const [judges, projects] = await Promise.all([
      this.db.eventMember.findMany({ where: { eventId, roles: { has: 'JUDGE' } }, select: { userId: true } }),
      this.db.project.findMany({ where: { eventId }, select: { id: true } }),
    ]);
    const judgeIds = new Set(judges.map((j) => j.userId));
    const projectIds = new Set(projects.map((p) => p.id));
    if (rows.some((r) => !judgeIds.has(r.judgeId) || !projectIds.has(r.projectId))) throw new AppError('VALIDATION_FAILED', 'Assignments must use this event’s judges and projects');
    const unique = [...new Map(rows.map((r) => [`${r.judgeId}:${r.projectId}`, r])).values()];
    await this.db.$transaction([this.db.judgeAssignment.deleteMany({ where: { eventId } }), this.db.judgeAssignment.createMany({ data: unique.map((r) => ({ ...r, eventId })) })]);
    await this.audit.log(eventId, actor.id, 'judging.assignments', null, { count: unique.length });
    return this.assignments(eventId);
  }

  private async assignedProjectIds(eventId: string, judgeId: string) {
    const any = await this.db.judgeAssignment.count({ where: { eventId } });
    if (!any) return (await this.db.project.findMany({ where: { eventId }, select: { id: true } })).map((p) => p.id);
    return (await this.db.judgeAssignment.findMany({ where: { eventId, judgeId }, select: { projectId: true } })).map((a) => a.projectId);
  }

  /** Judge's list: assigned projects + my status on each */
  async judgeList(ctx: AccessCtx, judge: AuthUser) {
    const eventId = ctx.event.id;
    const ids = await this.assignedProjectIds(eventId, judge.id);
    const [rubric, projects, sheets] = await Promise.all([
      this.rubric(eventId),
      this.db.project.findMany({ where: { id: { in: ids } }, include: projectCardInclude, orderBy: { boothSlot: { fillOrder: 'asc' } } }),
      this.db.scoreSheet.findMany({ where: { judgeId: judge.id, projectId: { in: ids } }, include: { scores: true } }),
    ]);
    const criteria = rubric.criteria.map((c) => ({ id: c.id, maxScore: c.maxScore, weight: c.weight }));
    const byProject = new Map(sheets.map((s) => [s.projectId, s]));
    return {
      rubric,
      judgingOpen: ctx.event.status === 'LIVE',
      items: await Promise.all(
        projects.map(async (p) => {
          const s = byProject.get(p.id);
          return { project: await toProjectCard(p, this.storage), status: s?.status ?? ('NONE' as const), percent: s ? sheetPercent(criteria, s.scores.map((x) => ({ criterionId: x.criterionId, score: Number(x.score) }))) : null };
        }),
      ),
    };
  }

  async mySheet(ctx: AccessCtx, judge: AuthUser): Promise<ScoreSheet> {
    const p = ctx.project!;
    const [s, criteria] = await Promise.all([this.db.scoreSheet.findUnique({ where: { judgeId_projectId: { judgeId: judge.id, projectId: p.id } }, include: { scores: true } }), this.criteria(p.eventId)]);
    if (!s) return { id: null, projectId: p.id, status: 'NONE', comment: null, scores: [], percent: null, version: 0, submittedAt: null };
    const scores = s.scores.map((x) => ({ criterionId: x.criterionId, score: Number(x.score) }));
    return { id: s.id, projectId: p.id, status: s.status, comment: s.comment, scores, percent: sheetPercent(criteria, scores), version: s.version, submittedAt: isoOrNull(s.submittedAt) };
  }

  etag = sheetEtag;

  private assertOpen(ctx: AccessCtx) {
    this.module(ctx);
    if (ctx.event.status !== 'LIVE') throw new AppError('JUDGING_CLOSED');
  }

  /** Autosave on every change (stays DRAFT, or SUBMITTED if already submitted) · locks the rubric at the first score */
  async saveSheet(ctx: AccessCtx, judge: AuthUser, input: { scores: { criterionId: string; score: number }[]; comment?: string | null }, ifMatch?: string) {
    this.assertOpen(ctx);
    const p = ctx.project!;
    const rubric = await this.db.rubric.findUnique({ where: { eventId: p.eventId }, include: { criteria: true } });
    if (!rubric?.criteria.length) throw new AppError('VALIDATION_FAILED', 'The organizer has not set up the rubric yet');
    const byId = new Map(rubric.criteria.map((c) => [c.id, c]));
    const errors = input.scores.flatMap((s, i) => {
      const c = byId.get(s.criterionId);
      if (!c) return [{ field: `scores.${i}.criterionId`, message: 'Unknown criterion' }];
      if (s.score > c.maxScore) return [{ field: `scores.${i}.score`, message: `Max ${c.maxScore}` }];
      return [];
    });
    if (errors.length) throw new AppError('VALIDATION_FAILED', undefined, { errors });

    await this.db.$transaction(async (tx) => {
      const existing = await tx.scoreSheet.findUnique({ where: { judgeId_projectId: { judgeId: judge.id, projectId: p.id } } });
      if (ifMatch && existing && ifMatch !== sheetEtag(existing.version)) throw new AppError('STALE_VERSION');
      const sheet = existing
        ? await tx.scoreSheet.update({ where: { id: existing.id, version: existing.version }, data: { comment: input.comment ?? existing.comment, version: { increment: 1 } } })
        : await tx.scoreSheet.create({ data: { judgeId: judge.id, projectId: p.id, comment: input.comment ?? null } });
      for (const s of input.scores) {
        await tx.score.upsert({ where: { sheetId_criterionId: { sheetId: sheet.id, criterionId: s.criterionId } }, create: { sheetId: sheet.id, criterionId: s.criterionId, score: s.score }, update: { score: s.score } });
      }
      if (input.scores.length && !rubric.lockedAt) await tx.rubric.update({ where: { id: rubric.id }, data: { lockedAt: new Date() } });
    });
    return this.mySheet(ctx, judge);
  }

  async submitSheet(ctx: AccessCtx, judge: AuthUser) {
    this.assertOpen(ctx);
    const p = ctx.project!;
    const s = await this.db.scoreSheet.findUnique({ where: { judgeId_projectId: { judgeId: judge.id, projectId: p.id } }, include: { scores: true } });
    const criteria = await this.criteria(p.eventId);
    if (!s || !isSheetComplete(criteria, s.scores.map((x) => ({ criterionId: x.criterionId, score: Number(x.score) })))) throw new AppError('SHEET_INCOMPLETE');
    await this.db.scoreSheet.update({ where: { id: s.id }, data: { status: 'SUBMITTED', submittedAt: new Date(), version: { increment: 1 } } });
    return this.mySheet(ctx, judge);
  }

  async setCommentVisible(sheetId: string, actor: AuthUser, visible: boolean, eventId: string) {
    await this.db.scoreSheet.update({ where: { id: sheetId }, data: { commentVisible: visible } });
    await this.audit.log(eventId, actor.id, visible ? 'sheet.comment.show' : 'sheet.comment.hide', sheetId);
  }

  async progress(eventId: string) {
    const [judges, projects, sheets, assignments] = await Promise.all([
      this.db.eventMember.findMany({ where: { eventId, roles: { has: 'JUDGE' } }, include: { user: { select: personSelect } } }),
      this.db.project.findMany({ where: { eventId }, select: { id: true, title: true, boothSlot: { select: { label: true } } }, orderBy: { createdAt: 'asc' } }),
      this.db.scoreSheet.findMany({ where: { project: { eventId } }, select: { judgeId: true, projectId: true, status: true } }),
      this.db.judgeAssignment.findMany({ where: { eventId }, select: { judgeId: true, projectId: true } }),
    ]);
    const allToAll = !assignments.length;
    const assigned = (judgeId: string) => (allToAll ? projects.length : assignments.filter((a) => a.judgeId === judgeId).length);
    const expected = (projectId: string) => (allToAll ? judges.length : assignments.filter((a) => a.projectId === projectId).length);
    return {
      judges: judges.map((j) => ({
        ...toPerson(j.user),
        assigned: assigned(j.userId),
        submitted: sheets.filter((s) => s.judgeId === j.userId && s.status === 'SUBMITTED').length,
        drafts: sheets.filter((s) => s.judgeId === j.userId && s.status === 'DRAFT').length,
      })),
      projects: projects.map((p) => ({ projectId: p.id, title: p.title, boothLabel: p.boothSlot?.label ?? null, expected: expected(p.id), submitted: sheets.filter((s) => s.projectId === p.id && s.status === 'SUBMITTED').length })),
    };
  }

  async remind(ctx: AccessCtx, actor: AuthUser) {
    const { judges } = await this.progress(ctx.event.id);
    const behind = judges.filter((j) => j.submitted < j.assigned);
    if (behind.length) await this.db.notification.createMany({ data: behind.map((j) => ({ userId: j.userId, kind: 'judging_reminder', payload: { eventId: ctx.event.id, slug: ctx.event.slug, title: ctx.event.title, left: j.assigned - j.submitted } })) });
    await this.audit.log(ctx.event.id, actor.id, 'judging.remind', null, { judges: behind.length });
    return { reminded: behind.length };
  }

  /** Weighted totals per project (mean of SUBMITTED sheets) · per criterion · per judge · audience votes */
  async results(eventId: string): Promise<Results> {
    const [rubric, projects, sheets, votes] = await Promise.all([
      this.rubric(eventId),
      this.db.project.findMany({ where: { eventId }, include: { boothSlot: { select: { label: true } }, category: { select: { name: true } } } }),
      this.db.scoreSheet.findMany({ where: { project: { eventId }, status: 'SUBMITTED' }, include: { scores: true, judge: { select: personSelect } } }),
      this.db.vote.groupBy({ by: ['projectId'], where: { eventId }, _count: { _all: true } }),
    ]);
    const criteria = rubric.criteria.map((c) => ({ id: c.id, maxScore: c.maxScore, weight: c.weight }));
    const voteCount = new Map(votes.map((v) => [v.projectId, v._count._all]));
    const sheetRows = sheets.map((s) => {
      const scores = s.scores.map((x) => ({ criterionId: x.criterionId, score: Number(x.score) }));
      return { id: s.id, projectId: s.projectId, judge: toPerson(s.judge), percent: sheetPercent(criteria, scores), comment: s.comment, commentVisible: s.commentVisible, scores };
    });
    const rows = projects.map((p) => {
      const mine = sheetRows.filter((s) => s.projectId === p.id);
      const perCriterion = Object.fromEntries(
        rubric.criteria.map((c) => [c.id, mean(mine.flatMap((s) => s.scores.filter((x) => x.criterionId === c.id).map((x) => (x.score / c.maxScore) * 100)))]),
      );
      return { projectId: p.id, title: p.title, boothLabel: p.boothSlot?.label ?? null, category: p.category?.name ?? null, percent: mean(mine.map((s) => s.percent).filter((x): x is number => x !== null)), sheets: mine.length, perCriterion, votes: voteCount.get(p.id) ?? 0 };
    });
    rows.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
    return { criteria: rubric.criteria, projects: rows, sheets: sheetRows.map(({ scores: _s, ...rest }) => rest) };
  }

  /** Announce after the event: top N by score + top N by votes → awards, presenters get an email */
  async announce(ctx: AccessCtx, actor: AuthUser, judgesTop: number, audienceTop: number) {
    const e = ctx.event;
    if (e.status !== 'EXHIBITION' && e.status !== 'ARCHIVED') throw new AppError('INVALID_STATUS_TRANSITION', 'End the event before announcing results');
    const { projects } = await this.results(e.id);
    const modules = e.modules as Partial<EventModules>;
    const judged = modules.judging ? projects.filter((p) => p.percent !== null).slice(0, judgesTop) : [];
    const audience = modules.popularVote ? [...projects].filter((p) => p.votes > 0).sort((a, b) => b.votes - a.votes).slice(0, audienceTop) : [];
    await this.db.$transaction([
      this.db.award.deleteMany({ where: { eventId: e.id } }),
      this.db.award.createMany({
        data: [...judged.map((p, i) => ({ eventId: e.id, projectId: p.projectId, kind: 'JUDGES' as const, rank: i + 1 })), ...audience.map((p, i) => ({ eventId: e.id, projectId: p.projectId, kind: 'AUDIENCE' as const, rank: i + 1 }))],
      }),
      this.db.event.update({ where: { id: e.id }, data: { resultsAnnouncedAt: new Date() } }),
    ]);
    const presenters = await this.db.projectMember.findMany({ where: { project: { eventId: e.id } }, include: { user: { select: { email: true, deletedAt: true } }, project: { select: { id: true, title: true } } } });
    for (const m of presenters) {
      if (m.user.deletedAt) continue;
      await this.mail.sendButton(m.user.email, `Results for ${e.title}`, 'Your results are ready', `Scores, judges' comments and visitor feedback for "${m.project.title}" are ready.`, 'See your summary', `${siteUrl}/e/${e.slug}/my-booth?project=${m.project.id}`);
    }
    await this.audit.log(e.id, actor.id, 'results.announce', null, { judgesTop, audienceTop });
    return this.awards(e.id);
  }

  async awards(eventId: string) {
    const rows = await this.db.award.findMany({ where: { eventId }, include: { project: { include: projectCardInclude } }, orderBy: [{ kind: 'asc' }, { rank: 'asc' }] });
    return Promise.all(rows.map(async (a) => ({ kind: a.kind, rank: a.rank, project: await toProjectCard(a.project, this.storage) })));
  }
}
