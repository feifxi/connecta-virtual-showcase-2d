import { Injectable } from '@nestjs/common';
import type { Prisma } from '@connecta/db';
import { blockDemand, parseHallMap, planAllPlacements, type HallData, type HallPreset, type TiledMap } from '@connecta/shared';
import { loadPresetMap, presetSlots } from '@connecta/shared/node';
import type { AccessCtx } from '../../common/auth/access.js';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { projectCardInclude, toCategory, toProjectCard } from '../../common/mappers.js';
import { AppError } from '../../common/problem.js';
import { Audit } from '../../infra/audit.js';
import { HallBus } from '../../infra/bus.js';
import { Db } from '../../infra/db.js';
import { Storage } from '../../infra/storage.js';

@Injectable()
export class HallService {
  constructor(
    private readonly db: Db,
    private readonly storage: Storage,
    private readonly bus: HallBus,
    private readonly audit: Audit,
  ) {}

  async get(eventId: string): Promise<HallData> {
    const hall = await this.db.hall.findUniqueOrThrow({ where: { eventId }, include: { slots: { orderBy: { fillOrder: 'asc' }, include: { project: { select: { id: true } } } } } });
    const [projects, categories] = await Promise.all([
      this.db.project.findMany({ where: { eventId }, include: projectCardInclude, orderBy: { createdAt: 'asc' } }),
      this.db.eventCategory.findMany({ where: { eventId }, include: { _count: { select: { projects: true } } }, orderBy: { sort: 'asc' } }),
    ]);
    // slot keys come from the map (Tiled object names) · the DB keeps fill order
    const layout = parseHallMap(hall.mapJson as unknown as TiledMap);
    const keyByOrder = new Map(layout.slots.map((s) => [s.fillOrder, s.key]));
    const counts = categories.length ? categories.map((c) => c._count.projects) : [projects.length];
    return {
      preset: hall.preset,
      mapJson: hall.mapJson as Record<string, unknown>,
      slots: hall.slots.map((s) => ({ id: s.id, key: keyByOrder.get(s.fillOrder) ?? s.label, label: s.label, block: s.block, fillOrder: s.fillOrder, x: s.x, y: s.y, w: s.w, h: s.h, projectId: s.project?.id ?? null })),
      projects: await Promise.all(projects.map((p) => toProjectCard(p, this.storage))),
      categories: categories.map(toCategory),
      blocks: blockDemand(hall.slots, counts),
      unplacedProjectIds: projects.filter((p) => !p.boothSlotId).map((p) => p.id),
    };
  }

  private assertBeforeOpen(ctx: AccessCtx) {
    if (ctx.event.status !== 'DRAFT' && ctx.event.status !== 'PUBLISHED') throw new AppError('INVALID_STATUS_TRANSITION', 'The hall layout is fixed once the hall opens');
  }

  /** Switch preset before the hall opens · every booth is placed again · refused if they don't all fit */
  async setPreset(ctx: AccessCtx, user: AuthUser, preset: HallPreset) {
    this.assertBeforeOpen(ctx);
    const eventId = ctx.event.id;
    await this.db.$transaction(async (tx) => {
      const hall = await tx.hall.findUniqueOrThrow({ where: { eventId } });
      await tx.project.updateMany({ where: { eventId }, data: { boothSlotId: null } });
      await tx.boothSlot.deleteMany({ where: { hallId: hall.id } });
      await tx.hall.update({ where: { id: hall.id }, data: { preset, source: 'PRESET', mapJson: loadPresetMap(preset) as unknown as Prisma.InputJsonValue, slots: { create: presetSlots(preset) } } });
      const unplaced = await this.arrange(tx, eventId);
      if (unplaced.length) throw new AppError('HALL_NO_SLOT', `${unplaced.length} projects don't fit in the ${preset} preset`, { unplaced: unplaced.length });
    });
    await this.audit.log(eventId, user.id, 'hall.preset', null, { preset });
    return this.get(eventId);
  }

  /** Auto-arrange from scratch: 1 block = 1 category, closest to the entrance first */
  async autoArrange(ctx: AccessCtx, user: AuthUser) {
    this.assertBeforeOpen(ctx);
    await this.db.$transaction((tx) => this.arrange(tx, ctx.event.id));
    await this.audit.log(ctx.event.id, user.id, 'hall.arrange');
    return this.get(ctx.event.id);
  }

  private async arrange(tx: Prisma.TransactionClient, eventId: string) {
    const hall = await tx.hall.findUniqueOrThrow({ where: { eventId }, include: { slots: true } });
    const [projects, categories] = await Promise.all([
      tx.project.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' }, select: { id: true, categoryId: true, boothSlotId: true } }),
      tx.eventCategory.findMany({ where: { eventId }, orderBy: { sort: 'asc' }, select: { id: true } }),
    ]);
    const { placements, unplaced } = planAllPlacements(hall.slots, projects, categories.map((c) => c.id));
    await tx.project.updateMany({ where: { eventId }, data: { boothSlotId: null } });
    for (const [projectId, boothSlotId] of placements) if (boothSlotId) await tx.project.update({ where: { id: projectId }, data: { boothSlotId } });
    return unplaced;
  }

  /** Admin swaps booths by hand before the hall opens · the whole set in one transaction */
  async setPlacements(ctx: AccessCtx, user: AuthUser, placements: { projectId: string; boothSlotId: string | null }[]) {
    this.assertBeforeOpen(ctx);
    const eventId = ctx.event.id;
    const slotIds = placements.map((p) => p.boothSlotId).filter((s): s is string => !!s);
    if (new Set(slotIds).size !== slotIds.length) throw new AppError('VALIDATION_FAILED', 'Two projects in one booth spot');
    await this.db.$transaction(async (tx) => {
      const hall = await tx.hall.findUniqueOrThrow({ where: { eventId }, include: { slots: { select: { id: true } } } });
      const valid = new Set(hall.slots.map((s) => s.id));
      if (slotIds.some((s) => !valid.has(s))) throw new AppError('VALIDATION_FAILED', 'Unknown booth spot');
      const ids = placements.map((p) => p.projectId);
      if ((await tx.project.count({ where: { id: { in: ids }, eventId } })) !== ids.length) throw new AppError('NOT_FOUND', 'Unknown project');
      await tx.project.updateMany({ where: { id: { in: ids } }, data: { boothSlotId: null } });
      for (const p of placements) if (p.boothSlotId) await tx.project.update({ where: { id: p.projectId }, data: { boothSlotId: p.boothSlotId } });
    });
    await this.audit.log(eventId, user.id, 'hall.placements', null, { count: placements.length });
    await this.bus.publish(eventId, { type: 'boothsChanged' });
    return this.get(eventId);
  }
}
