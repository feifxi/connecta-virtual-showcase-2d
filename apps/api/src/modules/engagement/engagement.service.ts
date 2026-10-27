import { Injectable } from '@nestjs/common';
import type { Feedback, FeedbackStatus, User } from '@connecta/db';
import type { EventModules, Feedback as FeedbackResponse } from '@connecta/shared';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { iso, personSelect, toPerson } from '../../common/mappers.js';
import { AppError } from '../../common/problem.js';
import { Audit } from '../../infra/audit.js';
import { Db } from '../../infra/db.js';

type PersonRow = Pick<User, 'id' | 'displayName' | 'name' | 'avatarPreset' | 'organization' | 'position' | 'deletedAt'>;

@Injectable()
export class EngagementService {
  constructor(
    private readonly db: Db,
    private readonly audit: Audit,
  ) {}

  private module(ctx: AccessCtx, key: keyof EventModules) {
    if (!(ctx.event.modules as Partial<EventModules>)[key]) throw new AppError('MODULE_DISABLED');
  }

  private openDuring(ctx: AccessCtx, statuses: string[]) {
    if (!statuses.includes(ctx.event.status)) throw new AppError(ctx.event.status === 'EXHIBITION' || ctx.event.status === 'ARCHIVED' ? 'JUDGING_CLOSED' : 'HALL_NOT_OPEN', 'Not open right now');
  }

  // ---------- feedback · only the booth's presenters + Admins ever see it ----------

  async addFeedback(ctx: AccessCtx, user: AuthUser, text: string, isAnonymous: boolean) {
    this.module(ctx, 'feedback');
    this.openDuring(ctx, ['LIVE', 'EXHIBITION']);
    const p = ctx.project!;
    await this.db.feedback.create({ data: { projectId: p.id, authorId: user.id, text, isAnonymous } });
    const presenters = await this.db.projectMember.findMany({ where: { projectId: p.id }, select: { userId: true } });
    if (presenters.length) await this.db.notification.createMany({ data: presenters.map((m) => ({ userId: m.userId, kind: 'feedback', payload: { projectId: p.id, title: p.title, eventId: p.eventId } })) });
    await this.audit.track(p.eventId, 'feedback', user.id, p.id);
  }

  toFeedback(f: Feedback & { author: PersonRow }, asAdmin: boolean): FeedbackResponse {
    return { id: f.id, text: f.text, isAnonymous: f.isAnonymous, status: f.status, createdAt: iso(f.createdAt), author: f.isAnonymous && !asAdmin ? null : toPerson(f.author) };
  }

  /** Presenters never see who wrote an anonymous note · Admins always do · removed notes are gone for presenters */
  async listFeedback(ctx: AccessCtx) {
    const rows = await this.db.feedback.findMany({
      where: { projectId: ctx.project!.id, ...(!ctx.isAdmin && { status: { not: 'REMOVED' } }) },
      include: { author: { select: personSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((f) => this.toFeedback(f, ctx.isAdmin));
  }

  /** Presenter hides/unhides in their booth · Admin removes (moderation, audited) */
  async setFeedbackStatus(feedbackId: string, ctx: AccessCtx, user: AuthUser, status: FeedbackStatus) {
    const f = await this.db.feedback.findUnique({ where: { id: feedbackId } });
    if (f?.projectId !== ctx.project!.id) throw new AppError('NOT_FOUND');
    if (status === 'REMOVED' && !ctx.isAdmin) throw new AppError('FORBIDDEN_ROLE', 'Only Admins remove feedback');
    if (status !== 'REMOVED' && !ctx.isPresenterOf && !ctx.isAdmin) throw new AppError('FORBIDDEN_ROLE');
    await this.db.feedback.update({ where: { id: feedbackId }, data: { status } });
    if (status === 'REMOVED') await this.audit.log(ctx.event.id, user.id, 'feedback.remove', feedbackId);
  }

  // ---------- Popular Vote · any number of projects, once each, while Live ----------

  async vote(ctx: AccessCtx, user: AuthUser, on: boolean) {
    this.module(ctx, 'popularVote');
    if (ctx.event.status !== 'LIVE') throw new AppError('JUDGING_CLOSED', 'Voting is open while the event is live');
    const p = ctx.project!;
    if (on) {
      const exists = await this.db.vote.findUnique({ where: { eventId_userId_projectId: { eventId: p.eventId, userId: user.id, projectId: p.id } } });
      if (exists) throw new AppError('ALREADY_EXISTS', 'You already voted for this project');
      await this.db.vote.create({ data: { eventId: p.eventId, userId: user.id, projectId: p.id } });
      await this.audit.track(p.eventId, 'vote', user.id, p.id);
    } else {
      await this.db.vote.deleteMany({ where: { eventId: p.eventId, userId: user.id, projectId: p.id } });
    }
  }

  async mine(ctx: AccessCtx, user: AuthUser) {
    const p = ctx.project!;
    const [vote, contact, feedbackCount] = await Promise.all([
      this.db.vote.findUnique({ where: { eventId_userId_projectId: { eventId: p.eventId, userId: user.id, projectId: p.id } } }),
      this.db.contactRequest.findUnique({ where: { projectId_userId: { projectId: p.id, userId: user.id } } }),
      this.db.feedback.count({ where: { projectId: p.id, authorId: user.id } }),
    ]);
    return { voted: !!vote, votesLeft: null, contactRequested: !!contact, feedbackCount };
  }

  // ---------- contact requests · one way, withdrawing deletes the row ----------

  async requestContact(ctx: AccessCtx, user: AuthUser, input: { email: string; phone?: string; link?: string; message?: string }) {
    this.openDuring(ctx, ['LIVE', 'EXHIBITION']);
    const p = ctx.project!;
    const data = { email: input.email, phone: input.phone ?? null, link: input.link ?? null, message: input.message ?? null };
    await this.db.contactRequest.upsert({ where: { projectId_userId: { projectId: p.id, userId: user.id } }, create: { projectId: p.id, userId: user.id, ...data }, update: data });
    await this.audit.track(p.eventId, 'contact_request', user.id, p.id);
  }

  async withdrawContact(ctx: AccessCtx, user: AuthUser) {
    await this.db.contactRequest.deleteMany({ where: { projectId: ctx.project!.id, userId: user.id } });
  }

  async contacts(ctx: AccessCtx) {
    const rows = await this.db.contactRequest.findMany({ where: { projectId: ctx.project!.id }, include: { user: { select: personSelect } }, orderBy: { createdAt: 'desc' } });
    return rows.map((c) => ({ id: c.id, person: toPerson(c.user), email: c.email, phone: c.phone, link: c.link, message: c.message, createdAt: iso(c.createdAt) }));
  }
}

/** CSV with a BOM so Excel opens Thai text correctly */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // no formula injection
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
