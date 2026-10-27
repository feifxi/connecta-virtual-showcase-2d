import { Injectable } from '@nestjs/common';
import { Prisma } from '@connecta/db';
import { IMAGE_RULE, placeOne, updateProjectSchema, type ProjectDetail } from '@connecta/shared';
import type { z } from 'zod';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { sniffFile } from '../../common/files.js';
import { cursorOffset, paginate, projectCardInclude, toProjectCard } from '../../common/mappers.js';
import { AppError } from '../../common/problem.js';
import { Audit } from '../../infra/audit.js';
import { HallBus } from '../../infra/bus.js';
import { Db } from '../../infra/db.js';
import { keys, Storage } from '../../infra/storage.js';
import { InvitesService } from '../people/invites.service.js';
import { FilesService } from './files.service.js';

export const etagOf = (version: number) => `W/"${version}"`;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly db: Db,
    private readonly storage: Storage,
    private readonly audit: Audit,
    private readonly bus: HallBus,
    private readonly invites: InvitesService,
    private readonly files: FilesService,
  ) {}

  /** Search by title / summary / tags (full-text index) or member name · filter by category */
  async list(eventId: string, q: { q?: string; categoryId?: string; limit: number; cursor?: string }, user?: AuthUser) {
    const offset = cursorOffset(q.cursor);
    let ids: string[] | undefined;
    if (q.q) {
      const term = q.q.trim();
      const hits = await this.db.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT p.id FROM projects p
        WHERE p.event_id = ${eventId}::uuid AND (
          project_search_vector(p.title, p.summary, p.tags) @@ plainto_tsquery('simple', ${term})
          OR p.title ILIKE ${`%${term}%`}
          OR EXISTS (SELECT 1 FROM project_members m JOIN users u ON u.id = m.user_id
                     WHERE m.project_id = p.id AND coalesce(u.display_name, u.name) ILIKE ${`%${term}%`})
        )`);
      ids = hits.map((h) => h.id);
      if (user) await this.audit.track(eventId, 'search', user.id, null, { q: term, hits: ids.length });
    }
    const rows = await this.db.project.findMany({
      where: { eventId, ...(q.categoryId && { categoryId: q.categoryId }), ...(ids && { id: { in: ids } }) },
      include: projectCardInclude,
      orderBy: [{ boothSlot: { fillOrder: 'asc' } }, { createdAt: 'asc' }],
      skip: offset,
      take: q.limit + 1,
    });
    const page = paginate(rows, q.limit, offset);
    return { data: await Promise.all(page.data.map((p) => toProjectCard(p, this.storage))), nextCursor: page.nextCursor };
  }

  /**
   * Admin adds a project, or anyone submits one while submissions are open (they become its presenter)
   * The booth is placed at once without moving other booths · member emails get presenter invites
   */
  async create(ctx: AccessCtx, user: AuthUser, input: { title: string; categoryId?: string | null; memberEmails: string[]; summary?: string }) {
    const e = ctx.event;
    if (!ctx.isAdmin && !e.submissionsOpen) throw new AppError('SUBMISSIONS_CLOSED');
    if (!ctx.isAdmin && (e.status === 'EXHIBITION' || e.status === 'ARCHIVED')) throw new AppError('SUBMISSIONS_CLOSED');
    const categories = await this.db.eventCategory.findMany({ where: { eventId: e.id }, select: { id: true } });
    if (input.categoryId && !categories.some((c) => c.id === input.categoryId)) throw new AppError('VALIDATION_FAILED', undefined, { errors: [{ field: 'categoryId', message: 'Unknown category' }] });
    if (categories.length && !input.categoryId) throw new AppError('VALIDATION_FAILED', undefined, { errors: [{ field: 'categoryId', message: 'Pick a category' }] });

    const project = await this.db.$transaction(async (tx) => {
      const hall = await tx.hall.findUniqueOrThrow({ where: { eventId: e.id }, include: { slots: true } });
      const placed = await tx.project.findMany({ where: { eventId: e.id }, select: { id: true, categoryId: true, boothSlotId: true } });
      const slotId = placeOne(hall.slots, placed, input.categoryId ?? null, categories.length > 0);
      if (!slotId && e.status === 'LIVE') throw new AppError('HALL_NO_SLOT');
      const p = await tx.project.create({ data: { eventId: e.id, title: input.title, summary: input.summary ?? null, categoryId: input.categoryId ?? null, boothSlotId: slotId, links: [] } });
      if (!ctx.isAdmin) {
        await tx.projectMember.create({ data: { projectId: p.id, userId: user.id } });
        const m = await tx.eventMember.findUnique({ where: { eventId_userId: { eventId: e.id, userId: user.id } } });
        await tx.eventMember.upsert({
          where: { eventId_userId: { eventId: e.id, userId: user.id } },
          create: { eventId: e.id, userId: user.id, roles: ['PRESENTER'], assignedById: user.id },
          update: { roles: [...new Set([...(m?.roles ?? []), 'PRESENTER' as const])] },
        });
      }
      return p;
    });
    const self = await this.db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
    const emails = input.memberEmails.filter((m) => ctx.isAdmin || m.toLowerCase() !== self.email.toLowerCase());
    if (emails.length) await this.invites.create(ctx, user, emails, ['PRESENTER'], project.id);
    if (e.status === 'LIVE') await this.bus.publish(e.id, { type: 'boothsChanged' });
    if (!ctx.isAdmin) await this.bus.publish(e.id, { type: 'roleChanged', userId: user.id, roles: ['PRESENTER'] });
    await this.audit.log(e.id, user.id, 'project.create', project.id);
    return this.detail({ ...ctx, project, isPresenterOf: !ctx.isAdmin || ctx.isPresenterOf });
  }

  async detail(ctx: AccessCtx): Promise<ProjectDetail> {
    const p = await this.db.project.findUniqueOrThrow({ where: { id: ctx.project!.id }, include: { ...projectCardInclude, files: { orderBy: { createdAt: 'asc' } } } });
    const canEdit = ctx.isPresenterOf || ctx.isAdmin;
    const card = await toProjectCard(p, this.storage);
    const files = await Promise.all(p.files.map((f) => this.files.toResponse(p.eventId, f)));
    const pendingInvites = canEdit ? await this.db.eventInvite.findMany({ where: { projectId: p.id, status: 'PENDING', expiresAt: { gt: new Date() } }, select: { id: true, email: true } }) : [];
    const has = (kind: string) => p.files.some((f) => f.kind === kind);
    return {
      ...card,
      videoUrl: p.videoUrl,
      links: (p.links ?? []) as { label: string; url: string }[],
      aiEnabled: p.aiEnabled,
      // DOC files feed the AI assistant only · visitors never download them
      files: canEdit ? files : files.filter((f) => f.kind !== 'DOC'),
      version: p.version,
      canEdit,
      pendingInvites,
      checklist: canEdit
        ? [
            { key: 'summary', label: 'Write a short summary', done: !!p.summary?.trim() },
            { key: 'cover', label: 'Add a cover image', done: !!p.coverKey },
            { key: 'poster', label: 'Upload your poster (PDF)', done: has('POSTER') },
            { key: 'tags', label: 'Add tags so people can find you', done: p.tags.length > 0 },
            { key: 'team', label: 'Invite your teammates', done: p.members.length + pendingInvites.length > 1 },
          ]
        : [],
    };
  }

  /** Presenter of this booth or Admin · during the event too (broadcast + audit) · If-Match guards two tabs */
  async update(ctx: AccessCtx, user: AuthUser, input: z.output<typeof updateProjectSchema>, ifMatch?: string) {
    const p = ctx.project!;
    if (ifMatch && ifMatch !== etagOf(p.version)) throw new AppError('STALE_VERSION');
    if (input.categoryId !== undefined && input.categoryId !== p.categoryId) {
      if (!ctx.isAdmin) throw new AppError('FORBIDDEN_ROLE', 'Only Admins move a booth to another category');
      if (input.categoryId && !(await this.db.eventCategory.findFirst({ where: { id: input.categoryId, eventId: p.eventId } }))) throw new AppError('NOT_FOUND', 'Unknown category');
    }
    if (input.aiEnabled && !(ctx.event.modules as { ai?: boolean }).ai) throw new AppError('MODULE_DISABLED', 'The organizer has not turned on AI for this event');
    const { count } = await this.db.project.updateMany({ where: { id: p.id, version: p.version }, data: { ...input, ...(input.tags && { tags: [...new Set(input.tags)] }), version: { increment: 1 } } });
    if (!count) throw new AppError('STALE_VERSION');
    if (ctx.event.status === 'LIVE') {
      await this.bus.publish(p.eventId, { type: 'boothUpdated', projectId: p.id });
      await this.audit.log(p.eventId, user.id, 'project.update', p.id, { fields: Object.keys(input) });
    }
    return this.detail({ ...ctx, project: await this.db.project.findUniqueOrThrow({ where: { id: p.id } }) });
  }

  async remove(ctx: AccessCtx, user: AuthUser) {
    const p = ctx.project!;
    await this.db.project.delete({ where: { id: p.id } });
    await this.storage.deletePrefix(`events/${p.eventId}/projects/${p.id}/`);
    if (ctx.event.status === 'LIVE') await this.bus.publish(p.eventId, { type: 'boothsChanged' });
    await this.audit.log(p.eventId, user.id, 'project.delete', p.id, { title: p.title });
  }

  async setCover(ctx: AccessCtx, file: Express.Multer.File | undefined) {
    const p = ctx.project!;
    const sniffed = await sniffFile(file, IMAGE_RULE.mimes, IMAGE_RULE.maxBytes);
    const key = keys.projectCover(p.eventId, p.id, sniffed.ext);
    await this.storage.put(key, file!.buffer, sniffed.mime);
    await this.db.project.update({ where: { id: p.id }, data: { coverKey: key, version: { increment: 1 } } });
    if (ctx.event.status === 'LIVE') await this.bus.publish(p.eventId, { type: 'boothUpdated', projectId: p.id });
  }

  async removeMember(ctx: AccessCtx, user: AuthUser, userId: string) {
    const p = ctx.project!;
    await this.db.projectMember.deleteMany({ where: { projectId: p.id, userId } });
    // no other booth → no longer a presenter in this event
    const others = await this.db.projectMember.count({ where: { userId, project: { eventId: p.eventId } } });
    if (!others) {
      const m = await this.db.eventMember.findUnique({ where: { eventId_userId: { eventId: p.eventId, userId } } });
      if (m) {
        const roles = m.roles.filter((r) => r !== 'PRESENTER');
        if (roles.length) await this.db.eventMember.update({ where: { eventId_userId: { eventId: p.eventId, userId } }, data: { roles } });
        else await this.db.eventMember.delete({ where: { eventId_userId: { eventId: p.eventId, userId } } });
        await this.bus.publish(p.eventId, { type: 'roleChanged', userId, roles });
      }
    }
    await this.audit.log(p.eventId, user.id, 'project.member.remove', userId, { projectId: p.id });
  }
}
