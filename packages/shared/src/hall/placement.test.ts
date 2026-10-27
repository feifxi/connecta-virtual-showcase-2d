import { describe, expect, it } from 'vitest';
import { blockDemand, placeOne, planAllPlacements, type PlacementSlot } from './placement.js';

// 3 blocks × 2 slots · A is closest to the entrance
const slots: PlacementSlot[] = [
  { id: 'a1', block: 'A', fillOrder: 0 },
  { id: 'a2', block: 'A', fillOrder: 1 },
  { id: 'b1', block: 'B', fillOrder: 2 },
  { id: 'b2', block: 'B', fillOrder: 3 },
  { id: 'c1', block: 'C', fillOrder: 4 },
  { id: 'c2', block: 'C', fillOrder: 5 },
];
const p = (id: string, categoryId: string | null, boothSlotId: string | null = null) => ({ id, categoryId, boothSlotId });

describe('planAllPlacements', () => {
  it('fills in order when the event has no categories', () => {
    const { placements, unplaced } = planAllPlacements(slots, [p('1', null), p('2', null), p('3', null)], []);
    expect([...placements.values()]).toEqual(['a1', 'a2', 'b1']);
    expect(unplaced).toEqual([]);
  });

  it('gives each category its own blocks and never mixes them', () => {
    const projects = [p('x1', 'X'), p('y1', 'Y'), p('x2', 'X'), p('x3', 'X')];
    const { placements } = planAllPlacements(slots, projects, ['X', 'Y']);
    expect(placements.get('x1')).toBe('a1');
    expect(placements.get('x2')).toBe('a2');
    expect(placements.get('x3')).toBe('b1'); // X spills into the next block
    expect(placements.get('y1')).toBe('c1'); // Y never shares block B with X
  });

  it('reports projects that do not fit', () => {
    const projects = [p('x1', 'X'), p('y1', 'Y'), p('z1', 'Z'), p('w1', 'W')];
    const { unplaced } = planAllPlacements(slots, projects, ['X', 'Y', 'Z', 'W']);
    expect(unplaced).toEqual(['w1']);
  });
});

describe('placeOne', () => {
  it('uses a free slot in its own zone first', () => {
    expect(placeOne(slots, [p('x1', 'X', 'a1'), p('y1', 'Y', 'b1')], 'Y', true)).toBe('b2');
  });
  it('opens an empty block as a new zone when the zone is full', () => {
    expect(placeOne(slots, [p('x1', 'X', 'a1'), p('x2', 'X', 'a2'), p('y1', 'Y', 'b1')], 'X', true)).toBe('c1');
  });
  it('returns null when nothing is free', () => {
    const placed = [p('1', 'X', 'a1'), p('2', 'X', 'a2'), p('3', 'Y', 'b1'), p('4', 'Z', 'c1')];
    expect(placeOne(slots, placed, 'W', true)).toBeNull();
  });
  it('fills the first free slot when there are no categories', () => {
    expect(placeOne(slots, [p('1', null, 'a1')], null, false)).toBe('a2');
  });
});

it('blockDemand counts blocks per category', () => {
  expect(blockDemand(slots, [3, 1])).toEqual({ needed: 3, available: 3, slotsPerBlock: 2 });
});
