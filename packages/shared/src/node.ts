// Node-only helpers (reads the preset files) · import from '@connecta/shared/node'
import { readFileSync } from 'node:fs';
import type { HallPreset } from './constants.js';
import { parseHallMap, type TiledMap } from './hall/map.js';

const cache = new Map<HallPreset, TiledMap>();

export function loadPresetMap(preset: HallPreset): TiledMap {
  let map = cache.get(preset);
  if (!map) {
    map = JSON.parse(readFileSync(new URL(`../assets/presets/${preset}.json`, import.meta.url), 'utf8')) as TiledMap;
    cache.set(preset, map);
  }
  return map;
}

/** Rows for `booth_slots` when a hall is created from a preset */
export function presetSlots(preset: HallPreset) {
  return parseHallMap(loadPresetMap(preset)).slots.map((s) => ({
    block: s.block,
    fillOrder: s.fillOrder,
    x: Math.round(s.x),
    y: Math.round(s.y),
    w: Math.round(s.w),
    h: Math.round(s.h),
    label: s.label,
  }));
}
