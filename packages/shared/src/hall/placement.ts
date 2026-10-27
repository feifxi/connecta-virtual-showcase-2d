// Booth placement rules (docs/features.md → ฮอลล์)
// · event has categories → 1 block = 1 category (a zone) · a big category takes several blocks · blocks never mix
// · no categories → fill slots in fill order
// · blocks closest to the entrance fill first (lowest fill order)
// · adding a booth never moves other booths (people may be standing there)

export type PlacementSlot = { id: string; block: string; fillOrder: number };
export type PlacementProject = { id: string; categoryId: string | null; boothSlotId: string | null };

function blocksInOrder(slots: PlacementSlot[]) {
  const byBlock = new Map<string, PlacementSlot[]>();
  for (const s of [...slots].sort((a, b) => a.fillOrder - b.fillOrder)) {
    const list = byBlock.get(s.block) ?? [];
    list.push(s);
    byBlock.set(s.block, list);
  }
  return [...byBlock.values()];
}

/**
 * Arrange every project from scratch (before the hall opens: preset change or "auto-arrange").
 * `projects` in display order · `categoryOrder` = category ids sorted (empty = event has no categories).
 */
export function planAllPlacements(slots: PlacementSlot[], projects: PlacementProject[], categoryOrder: string[]) {
  const result = new Map<string, string | null>();
  const blocks = blocksInOrder(slots);
  if (!categoryOrder.length) {
    const ordered = blocks.flat();
    projects.forEach((p, i) => result.set(p.id, ordered[i]?.id ?? null));
    return { placements: result, unplaced: projects.filter((p) => !result.get(p.id)).map((p) => p.id) };
  }
  let nextBlock = 0;
  for (const cat of categoryOrder) {
    let room: PlacementSlot[] = [];
    for (const p of projects.filter((x) => x.categoryId === cat)) {
      if (!room.length) room = [...(blocks[nextBlock++] ?? [])];
      result.set(p.id, room.shift()?.id ?? null);
    }
  }
  // projects whose category was removed/unknown go last, into whatever is left
  const leftovers = projects.filter((p) => !result.has(p.id));
  const free = blocks.slice(nextBlock).flat();
  leftovers.forEach((p, i) => result.set(p.id, free[i]?.id ?? null));
  return { placements: result, unplaced: projects.filter((p) => !result.get(p.id)).map((p) => p.id) };
}

/**
 * Place one new project without moving others: a free slot in a block of its own category,
 * else a block that is completely empty (a lounge becomes a new zone), else null (hall full).
 */
export function placeOne(
  slots: PlacementSlot[],
  placed: PlacementProject[],
  categoryId: string | null,
  eventHasCategories: boolean,
): string | null {
  const taken = new Map(placed.filter((p) => p.boothSlotId).map((p) => [p.boothSlotId!, p]));
  const blocks = blocksInOrder(slots);
  if (!eventHasCategories) return blocks.flat().find((s) => !taken.has(s.id))?.id ?? null;
  for (const block of blocks) {
    const owners = new Set(block.filter((s) => taken.has(s.id)).map((s) => taken.get(s.id)!.categoryId));
    if (owners.size === 1 && owners.has(categoryId)) {
      const free = block.find((s) => !taken.has(s.id));
      if (free) return free.id;
    }
  }
  const empty = blocks.find((b) => b.every((s) => !taken.has(s.id)));
  return empty?.[0]?.id ?? null;
}

/** How many blocks the categories need vs. how many the preset has · for the settings warning */
export function blockDemand(slots: PlacementSlot[], countsByCategory: number[]) {
  const blocks = blocksInOrder(slots);
  const size = blocks[0]?.length ?? 1;
  const needed = countsByCategory.reduce((n, c) => n + Math.ceil(c / size), 0);
  return { needed, available: blocks.length, slotsPerBlock: size };
}
