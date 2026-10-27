import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { boothStandPoint, buildCollision, parseHallMap, type TiledMap } from './map.js';

const load = (name: string) => parseHallMap(JSON.parse(readFileSync(new URL(`../../assets/presets/${name}.json`, import.meta.url), 'utf8')) as TiledMap);

describe('parseHallMap', () => {
  it.each([
    ['hall', 30, 5],
    ['room', 12, 2],
  ])('%s preset has %i slots in %i blocks', (name, slotCount, blockCount) => {
    const layout = load(name);
    expect(layout.slots).toHaveLength(slotCount);
    expect(layout.blocks).toHaveLength(blockCount);
    expect(layout.slots[0]!.label).toBe('01');
  });

  it('spawn is walkable and walls are not', () => {
    const layout = load('hall');
    const col = buildCollision(layout, new Set());
    expect(col.isWalkable(layout.spawn.x, layout.spawn.y)).toBe(true);
    expect(col.isWalkable(1, 1)).toBe(false);
  });

  it('a booth table blocks walking but the stand point in front of it is free', () => {
    const layout = load('hall');
    const slot = layout.slots[0]!;
    const col = buildCollision(layout, new Set([slot.key]));
    const table = col.boxes.find((b) => b.y > slot.y + 70 && b.x > slot.x && b.x < slot.x + slot.w)!;
    expect(col.isWalkable(table.x + 2, table.y + 2)).toBe(false);
    const stand = boothStandPoint(slot);
    expect(col.isWalkable(stand.x, stand.y)).toBe(true);
  });
});
