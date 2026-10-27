import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Event, Prisma } from '@connecta/db';
import { createEventSchema, DEFAULT_MODULES, IMAGE_RULE, updateEventSchema, type EventDetail, type EventModules } from '@connecta/shared';
import type { z } from 'zod';
import { loadPresetMap, presetSlots } from '@connecta/shared/node';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { sniffFile } from '../../common/files.js';
import { cursorOffset, eventCardInclude, isoOrNull, paginate, toCategory, toEventCard } from '../../common/mappers.js';
import { planLimits, reservedSeats } from '../../common/plan.js';
import { AppError } from '../../common/problem.js';
import { siteUrl } from '../../env.js';
import { Audit } from '../../infra/audit.js';
import { HallBus } from '../../infra/bus.js';
import { Db } from '../../infra/db.js';
import { keys, Storage } from '../../infra/storage.js';
import { GateService } from '../attendance/gate.service.js';
import { LifecycleService } from '../lifecycle/lifecycle.service.js';

const slugify = (title: string) =>
  `${title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'event'}-${randomBytes(3).toString('hex')}`;

@Injectable()
export class EventsService {
  constructor(
    private readonly db: Db,
    private readonly storage: Storage,
    private readonly audit: Audit,
    private readonly bus: HallBus,
    private readonly gate: GateService,
    private readonly lifecycle: LifecycleService,
  ) {}

  /** Explore: every published event is listed (docs/features.md → การเข้าถึงงาน) · live first, then soonest */
  async explore(q: { q?: string; status?: 'PUBLISHED' | 'LIVE' | 'EXHIBITION'; slug?: string; limit: number; cursor?: string }) {
    const offset = cursorOffset(q.cursor);
    const where: Prisma.EventWhereInput = {
      suspendedAt: null,
      status: q.status ?? { in: ['PUBLISHED', 'LIVE', 'EXHIBITION'] },
      ...(q.slug && { slug: q.slug }),
      ...(q.q && { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }] }),
    };
    const rows = await this.db.event.findMany({ where, include: eventCardInclude, orderBy: [{ status: 'asc' }, { startsAt: 'asc' }], skip: offset, take: q.limit + 1 });
    // enum order is DRAFT, PUBLISHED, LIVE, … → put LIVE first explicitly
    rows.sort((a, b) => Number(b.status === 'LIVE') - Number(a.status === 'LIVE'));
    const page = paginate(rows, q.limit, offset);
    return { data: await Promise.all(page.data.map((e) => toEventCard(e, this.storage))), nextCursor: page.nextCursor };
  }

  /** slug → id, with the same visibility as the event itself */
  async resolveSlug(slug: string, user: AuthUser | undefined) {
    const e = await this.db.event.findUnique({ where: { slug }, select: { id: true, slug: true, status: true, suspendedAt: true } });
    if (!e) throw new AppError('NOT_FOUND');
    if (e.status === 'DRAFT' || e.suspendedAt) {
      const admin = user && (await this.db.eventMember.findFirst({ where: { eventId: e.id, userId: user.id, roles: { has: 'ADMIN' } } }));
      if (!admin && user?.appRole !== 'PLATFORM_ADMIN') throw new AppError('NOT_FOUND');
    }
    return { id: e.id, slug: e.slug };
  }

  async create(user: AuthUser, input: z.output<typeof createEventSchema>) {
    const sub = await this.db.subscription.findUnique({ where: { userId: user.id } });
    const plan = sub?.plan === 'PRO' && sub.status === 'active' ? 'PRO' : 'FREE';
    const limits = await planLimits(this.db, { id: '00000000-0000-0000-0000-000000000000', plan });
    if (input.capacity > limits.capacity) throw new AppError('PLAN_LIMIT', `The ${plan} plan allows up to ${limits.capacity} people at once.`, { limit: limits.capacity });
    const event = await this.db.event.create({
      data: {
        slug: slugify(input.title),
        title: input.title,
        description: input.description,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        hallOpenMode: input.hallOpenMode,
        capacity: input.capacity,
        allowedDomain: input.allowedDomain ?? null,
        agenda: input.agenda,
        modules: { ...DEFAULT_MODULES, ...input.modules, ...(plan === 'FREE' && { ai: false }) },
        boothDeadline: input.boothDeadline ? new Date(input.boothDeadline) : null,
        plan,
        createdById: user.id,
        members: { create: { userId: user.id, roles: ['ADMIN'], assignedById: user.id } },
        categories: { create: input.categories.map((c, sort) => ({ name: c.name, color: c.color, sort })) },
        hall: { create: { preset: input.preset, mapJson: loadPresetMap(input.preset) as unknown as Prisma.InputJsonValue, slots: { create: presetSlots(input.preset) } } },
        forms: { create: [{ kind: 'JOIN', fields: [] }, { kind: 'SURVEY', fields: [] }] },
      },
    });
    await this.audit.log(event.id, user.id, 'event.create', event.id);
    return { id: event.id, slug: event.slug };
  }

  async detail(ctx: AccessCtx): Promise<EventDetail> {
    const e = await this.db.event.findUniqueOrThrow({
      where: { id: ctx.event.id },
      include: { ...eventCardInclude, categories: { include: { _count: { select: { projects: true } } }, orderBy: { sort: 'asc' } }, hall: { select: { preset: true } } },
    });
    const userId = ctx.user?.id;
    const [interested, myProjects, blocked] = await Promise.all([
      userId ? this.db.eventInterest.findUnique({ where: { eventId_userId: { eventId: e.id, userId } } }) : null,
      userId ? this.db.projectMember.findMany({ where: { userId, project: { eventId: e.id } }, select: { projectId: true } }) : [],
      ctx.user ? this.gate.check(ctx, { requireForm: true }) : Promise.resolve({ code: 'UNAUTHENTICATED' as const }),
    ]);
    return {
      ...(await toEventCard(e, this.storage)),
      agenda: (e.agenda ?? []) as { time: string; title: string }[],
      modules: { ...DEFAULT_MODULES, ...(e.modules as Partial<EventModules>) },
      plan: e.plan,
      capacity: e.capacity,
      hallOpenMode: e.hallOpenMode,
      resultsAnnouncedAt: isoOrNull(e.resultsAnnouncedAt),
      boothDeadline: isoOrNull(e.boothDeadline),
      submissionsOpen: e.submissionsOpen,
      entryPaused: e.entryPaused,
      hallPreset: e.hall?.preset ?? null,
      categories: e.categories.map(toCategory),
      myRoles: [...ctx.roles],
      myProjectIds: myProjects.map((p) => p.projectId),
      interested: !!interested,
      attended: ctx.attendee,
      canJoin: { ok: !blocked, reason: blocked?.code ?? null },
    };
  }

  async update(ctx: AccessCtx, actor: AuthUser, input: z.output<typeof updateEventSchema>) {
    const e = ctx.event;
    const { status, modules, ...fields } = input;
    const startsAt = fields.startsAt ? new Date(fields.startsAt) : e.startsAt;
    const endsAt = fields.endsAt ? new Date(fields.endsAt) : e.endsAt;
    if (endsAt <= startsAt) throw new AppError('VALIDATION_FAILED', undefined, { errors: [{ field: 'endsAt', message: 'Must be after the start time' }] });
    if (fields.capacity !== undefined) {
      const limits = await planLimits(this.db, e);
      if (fields.capacity > limits.capacity) throw new AppError('PLAN_LIMIT', `This plan allows up to ${limits.capacity} people at once.`, { limit: limits.capacity });
      const reserved = await reservedSeats(this.db, e.id);
      if (fields.capacity < reserved) throw new AppError('VALIDATION_FAILED', undefined, { errors: [{ field: 'capacity', message: `${reserved} seats are already held by invites` }] });
    }
    const mergedModules = modules ? { ...DEFAULT_MODULES, ...(e.modules as Partial<EventModules>), ...modules } : undefined;
    if (mergedModules?.ai && e.plan === 'FREE') throw new AppError('PLAN_LIMIT', 'AI features need the Pro plan.');

    await this.db.event.update({
      where: { id: e.id },
      data: {
        ...fields,
        ...(fields.startsAt && { startsAt }),
        ...(fields.endsAt && { endsAt }),
        ...(fields.boothDeadline !== undefined && { boothDeadline: fields.boothDeadline ? new Date(fields.boothDeadline) : null }),
        ...(mergedModules && { modules: mergedModules }),
      },
    });
    if (fields.endsAt && e.status === 'LIVE') await this.audit.log(e.id, actor.id, 'event.extend', e.id, { endsAt: endsAt.toISOString() });
    if (status && status !== e.status) {
      const fresh = await this.db.event.findUniqueOrThrow({ where: { id: e.id } });
      await this.lifecycle.transition(fresh, status, actor.id);
    } else if (e.status === 'LIVE') {
      await this.bus.publish(e.id, { type: 'statusChanged', status: e.status });
    }
    await this.audit.log(e.id, actor.id, 'event.update', e.id, { fields: Object.keys(input) });
    return this.detail({ ...ctx, event: await this.db.event.findUniqueOrThrow({ where: { id: e.id } }) });
  }

  /** Type the event name to confirm · removes every row of the event and its files */
  async remove(ctx: AccessCtx, actor: AuthUser, confirm: string) {
    const e = ctx.event;
    if (confirm.trim() !== e.title.trim()) throw new AppError('CONFIRMATION_MISMATCH');
    await this.db.$transaction([
      // analytics/log tables have no FKs (fast writes) → cleaned up by hand
      this.db.presenceSession.deleteMany({ where: { eventId: e.id } }),
      this.db.boothVisit.deleteMany({ where: { eventId: e.id } }),
      this.db.heatmapCount.deleteMany({ where: { eventId: e.id } }),
      this.db.analyticsEvent.deleteMany({ where: { eventId: e.id } }),
      this.db.auditLog.deleteMany({ where: { eventId: e.id } }),
      this.db.event.delete({ where: { id: e.id } }),
    ]);
    await this.storage.deletePrefix(keys.event(e.id));
    await this.bus.publish(e.id, { type: 'kick', userId: '*', reason: 'The event was deleted', banned: false });
    await this.audit.log(null, actor.id, 'event.delete', e.id, { title: e.title });
  }

  async setCover(ctx: AccessCtx, file: Express.Multer.File | undefined) {
    const sniffed = await sniffFile(file, IMAGE_RULE.mimes, IMAGE_RULE.maxBytes);
    const key = keys.eventCover(ctx.event.id, sniffed.ext);
    await this.storage.put(key, file!.buffer, sniffed.mime);
    await this.db.event.update({ where: { id: ctx.event.id }, data: { coverKey: key } });
  }

  // ---------- categories = zones ----------

  async categories(eventId: string) {
    const rows = await this.db.eventCategory.findMany({ where: { eventId }, include: { _count: { select: { projects: true } } }, orderBy: { sort: 'asc' } });
    return rows.map(toCategory);
  }

  async addCategory(eventId: string, input: { name: string; color: string; sort?: number }) {
    const sort = input.sort ?? (await this.db.eventCategory.count({ where: { eventId } }));
    const c = await this.db.eventCategory.create({ data: { eventId, name: input.name, color: input.color, sort }, include: { _count: { select: { projects: true } } } });
    return toCategory(c);
  }

  async updateCategory(eventId: string, categoryId: string, input: { name?: string; color?: string; sort?: number }) {
    const c = await this.db.eventCategory.findUnique({ where: { id: categoryId } });
    if (c?.eventId !== eventId) throw new AppError('NOT_FOUND');
    const updated = await this.db.eventCategory.update({ where: { id: categoryId }, data: input, include: { _count: { select: { projects: true } } } });
    await this.bus.publish(eventId, { type: 'boothsChanged' });
    return toCategory(updated);
  }

  async removeCategory(eventId: string, categoryId: string) {
    const c = await this.db.eventCategory.findUnique({ where: { id: categoryId }, include: { _count: { select: { projects: true } } } });
    if (c?.eventId !== eventId) throw new AppError('NOT_FOUND');
    if (c._count.projects) throw new AppError('CATEGORY_IN_USE');
    await this.db.eventCategory.delete({ where: { id: categoryId } });
  }

  /** .ics with a reminder · "Add to calendar" instead of emailing when the hall opens */
  calendar(e: Event) {
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Connecta//Event//EN',
      'BEGIN:VEVENT',
      `UID:${e.id}@connecta`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(e.startsAt)}`,
      `DTEND:${fmt(e.endsAt)}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(`${e.description}\n\n${siteUrl}/e/${e.slug}`)}`,
      `URL:${siteUrl}/e/${e.slug}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(e.title)} opens in 15 minutes`,
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  /** Duplicate: same hall preset, categories, rubric, forms and settings → a new Draft */
  async copy(ctx: AccessCtx, actor: AuthUser) {
    const src = await this.db.event.findUniqueOrThrow({ where: { id: ctx.event.id }, include: { categories: true, hall: true, forms: true, rubric: { include: { criteria: true } } } });
    const preset = (src.hall?.preset ?? 'hall') as 'hall' | 'room';
    const created = await this.db.event.create({
      data: {
        slug: slugify(src.title),
        title: `${src.title} (copy)`,
        description: src.description,
        agenda: src.agenda as Prisma.InputJsonValue,
        modules: src.modules as Prisma.InputJsonValue,
        capacity: src.capacity,
        plan: src.plan,
        startsAt: src.startsAt,
        endsAt: src.endsAt,
        hallOpenMode: src.hallOpenMode,
        allowedDomain: src.allowedDomain,
        createdById: actor.id,
        members: { create: { userId: actor.id, roles: ['ADMIN'], assignedById: actor.id } },
        categories: { create: src.categories.map((c) => ({ name: c.name, color: c.color, sort: c.sort })) },
        hall: { create: { preset, mapJson: (src.hall?.mapJson ?? loadPresetMap(preset)) as Prisma.InputJsonValue, slots: { create: presetSlots(preset) } } },
        forms: { create: src.forms.map((f) => ({ kind: f.kind, fields: f.fields as Prisma.InputJsonValue })) },
        ...(src.rubric && { rubric: { create: { criteria: { create: src.rubric.criteria.map((c) => ({ name: c.name, description: c.description, maxScore: c.maxScore, weight: c.weight, sort: c.sort })) } } } }),
      },
    });
    await this.audit.log(created.id, actor.id, 'event.copy', src.id);
    return { id: created.id, slug: created.slug };
  }
}
