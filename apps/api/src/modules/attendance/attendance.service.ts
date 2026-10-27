import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { SignJWT } from 'jose';
import type { FormKind, Prisma } from '@connecta/db';
import { HALL_TICKET_TTL_S, type FormField } from '@connecta/shared';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { AppError } from '../../common/problem.js';
import { env } from '../../env.js';
import { Audit } from '../../infra/audit.js';
import { Db } from '../../infra/db.js';
import { Media } from '../../infra/media.js';
import { GateService } from './gate.service.js';

const ticketKey = new TextEncoder().encode(env.HALL_TICKET_SECRET);
type Answers = Record<string, string | string[] | number>;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly db: Db,
    private readonly gate: GateService,
    private readonly media: Media,
    private readonly audit: Audit,
  ) {}

  /** Interested is not a reservation · only while Published */
  async setInterest(ctx: AccessCtx, user: AuthUser, on: boolean) {
    if (ctx.event.status !== 'PUBLISHED') throw new AppError('INVALID_STATUS_TRANSITION', 'Interested is only available before the hall opens');
    const key = { eventId_userId: { eventId: ctx.event.id, userId: user.id } };
    if (on) {
      await this.db.eventInterest.upsert({ where: key, create: { eventId: ctx.event.id, userId: user.id }, update: {} });
      await this.audit.track(ctx.event.id, 'interested', user.id);
    } else {
      await this.db.eventInterest.deleteMany({ where: { eventId: ctx.event.id, userId: user.id } });
    }
  }

  async form(ctx: AccessCtx, kind: FormKind, userId?: string) {
    const form = await this.db.eventForm.findUnique({ where: { eventId_kind: { eventId: ctx.event.id, kind } } });
    const answered = form && userId ? !!(await this.db.formResponse.findUnique({ where: { formId_userId: { formId: form.id, userId } } })) : false;
    return { kind, fields: (form?.fields ?? []) as FormField[], answered };
  }

  async putForm(ctx: AccessCtx, actor: AuthUser, kind: FormKind, fields: FormField[]) {
    const ids = fields.map((f) => f.id);
    if (new Set(ids).size !== ids.length) throw new AppError('VALIDATION_FAILED', 'Question ids must be unique');
    await this.db.eventForm.upsert({
      where: { eventId_kind: { eventId: ctx.event.id, kind } },
      create: { eventId: ctx.event.id, kind, fields: fields as unknown as Prisma.InputJsonValue },
      update: { fields: fields as unknown as Prisma.InputJsonValue },
    });
    await this.audit.log(ctx.event.id, actor.id, `form.${kind.toLowerCase()}`, null, { count: fields.length });
    return this.form(ctx, kind);
  }

  private validateAnswers(fields: FormField[], answers: Answers) {
    const errors: { field: string; message: string }[] = [];
    for (const f of fields) {
      const a = answers[f.id];
      const empty = a === undefined || a === '' || (Array.isArray(a) && !a.length);
      if (empty) {
        if (f.required) errors.push({ field: `answers.${f.id}`, message: 'Required' });
        continue;
      }
      const ok =
        f.type === 'short_text' ? typeof a === 'string'
        : f.type === 'single' ? typeof a === 'string' && (f.options ?? []).includes(a)
        : f.type === 'multi' ? Array.isArray(a) && a.every((x) => (f.options ?? []).includes(x))
        : typeof a === 'number' && a >= 1 && a <= 5;
      if (!ok) errors.push({ field: `answers.${f.id}`, message: 'Not a valid answer' });
    }
    if (errors.length) throw new AppError('VALIDATION_FAILED', undefined, { errors });
    const known = new Set(fields.map((f) => f.id));
    return Object.fromEntries(Object.entries(answers).filter(([k]) => known.has(k)));
  }

  /**
   * Join form, once per event, every role · snapshots visitor type + province so later profile edits
   * don't rewrite old analytics (docs/features.md → ฟอร์มเข้างาน)
   */
  async attend(ctx: AccessCtx, user: AuthUser, input: { displayName: string; visitorType: Prisma.EventAttendeeCreateInput['visitorType']; consentMarketing: boolean; answers: Answers }) {
    const blocked = await this.gate.check(ctx, { requireForm: false });
    if (blocked && blocked.code !== 'HALL_FULL' && blocked.code !== 'ENTRY_PAUSED' && blocked.code !== 'HALL_NOT_OPEN') throw new AppError(blocked.code, undefined, blocked.extra);
    if (ctx.attendee) throw new AppError('ALREADY_EXISTS', 'You already joined this event');
    const form = await this.form(ctx, 'JOIN');
    const answers = this.validateAnswers(form.fields, input.answers);
    const profile = await this.db.user.findUniqueOrThrow({ where: { id: user.id }, select: { province: true } });
    await this.db.$transaction(async (tx) => {
      await tx.eventAttendee.create({
        data: { eventId: ctx.event.id, userId: user.id, displayName: input.displayName, visitorType: input.visitorType, province: profile.province ?? 'Unknown', consentMarketing: input.consentMarketing },
      });
      const f = await tx.eventForm.findUnique({ where: { eventId_kind: { eventId: ctx.event.id, kind: 'JOIN' } } });
      if (f && Object.keys(answers).length) await tx.formResponse.create({ data: { formId: f.id, userId: user.id, answers } });
    });
    await this.audit.track(ctx.event.id, 'attended', user.id);
  }

  async survey(ctx: AccessCtx, user: AuthUser, answers: Answers) {
    const form = await this.db.eventForm.findUnique({ where: { eventId_kind: { eventId: ctx.event.id, kind: 'SURVEY' } } });
    if (!form) throw new AppError('NOT_FOUND');
    const clean = this.validateAnswers((form.fields ?? []) as FormField[], answers);
    const exists = await this.db.formResponse.findUnique({ where: { formId_userId: { formId: form.id, userId: user.id } } });
    if (exists) throw new AppError('ALREADY_EXISTS', 'You already answered the survey');
    await this.db.formResponse.create({ data: { formId: form.id, userId: user.id, answers: clean } });
  }

  /**
   * Ticket into the hall: realtime trusts this short-lived JWT instead of re-checking the gate,
   * and LiveKit gets a token whose grants follow the user's roles
   */
  async ticket(ctx: AccessCtx, user: AuthUser) {
    const blocked = await this.gate.check(ctx, { requireForm: true });
    if (blocked) throw new AppError(blocked.code, undefined, blocked.extra);
    const attendee = await this.db.eventAttendee.findUniqueOrThrow({ where: { eventId_userId: { eventId: ctx.event.id, userId: user.id } }, select: { displayName: true } });
    const ticket = await new SignJWT({ eventId: ctx.event.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${HALL_TICKET_TTL_S}s`)
      .setAudience('connecta-realtime')
      .sign(ticketKey);
    return {
      realtimeUrl: env.PUBLIC_REALTIME_URL,
      ticket,
      mediaUrl: this.media.publicUrl,
      mediaToken: await this.media.token(ctx.event.id, user.id, attendee.displayName),
    };
  }
}
