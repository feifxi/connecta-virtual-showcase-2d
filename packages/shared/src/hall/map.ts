import { TILE, type ZoneColor } from '../constants.js';
import { PROPS } from './props.js';

// Hall preset = a Tiled map with floor/walls tiles and object layers:
// blocks (zone groups) · slots (booth spots, props: block + order) · props · signs · spots (decor NPC spots) · spawns
// The same parsed layout drives the client renderer and the server's collision check.

type TiledProperty = { name: string; type?: string; value: string | number | boolean };
type TiledObject = { name: string; x: number; y: number; width?: number; height?: number; properties?: TiledProperty[] };
type TiledLayer = { name: string; type: string; data?: number[]; objects?: TiledObject[] };
export type TiledMap = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: { firstgid: number; tiles?: { id: number; properties?: TiledProperty[] }[] }[];
};

export type Rect = { x: number; y: number; w: number; h: number };
export type MapSlot = Rect & { key: string; block: string; fillOrder: number; label: string };
export type MapBlock = Rect & { id: string; order: number };
export type MapProp = { key: string; x: number; bottom: number };

export type HallLayout = {
  widthPx: number;
  heightPx: number;
  cols: number;
  rows: number;
  spawn: { x: number; y: number };
  blocks: MapBlock[];
  slots: MapSlot[];
  props: MapProp[];
  signs: { name: string; x: number; y: number; zone: string }[];
  /** 1 = wall tile */
  walls: Uint8Array;
};

const props = (o: TiledObject) => Object.fromEntries((o.properties ?? []).map((p) => [p.name, String(p.value)]));
const layer = (map: TiledMap, name: string) => map.layers.find((l) => l.name === name);

export function parseHallMap(map: TiledMap): HallLayout {
  const solidGids = new Set<number>();
  for (const ts of map.tilesets)
    for (const t of ts.tiles ?? [])
      if (t.properties?.some((p) => p.name === 'collides' && p.value === true)) solidGids.add(ts.firstgid + t.id);
  const wallData = layer(map, 'walls')?.data ?? [];
  const walls = new Uint8Array(map.width * map.height);
  wallData.forEach((gid, i) => (walls[i] = solidGids.has(gid) ? 1 : 0));

  const slots: MapSlot[] = (layer(map, 'slots')?.objects ?? [])
    .map((o) => {
      const p = props(o);
      return { key: o.name, block: p.block ?? '', fillOrder: Number(p.order), x: o.x, y: o.y, w: o.width ?? 0, h: o.height ?? 0, label: '' };
    })
    .sort((a, b) => a.fillOrder - b.fillOrder)
    .map((s, i) => ({ ...s, label: String(i + 1).padStart(2, '0') }));

  const blocks: MapBlock[] = (layer(map, 'blocks')?.objects ?? [])
    .map((o) => ({
      id: o.name,
      x: o.x,
      y: o.y,
      w: o.width ?? 0,
      h: o.height ?? 0,
      order: Math.min(...slots.filter((s) => s.block === o.name).map((s) => s.fillOrder)),
    }))
    .sort((a, b) => a.order - b.order);

  const spawn = layer(map, 'spawns')?.objects?.find((o) => o.name === 'spawn');
  return {
    widthPx: map.width * map.tilewidth,
    heightPx: map.height * map.tileheight,
    cols: map.width,
    rows: map.height,
    spawn: { x: spawn?.x ?? TILE * 2, y: spawn?.y ?? TILE * 2 },
    blocks,
    slots,
    props: (layer(map, 'props')?.objects ?? []).map((o) => ({ key: props(o).key ?? o.name, x: o.x, bottom: o.y })),
    signs: (layer(map, 'signs')?.objects ?? []).map((o) => ({ name: o.name, x: o.x, y: o.y, zone: props(o).zone ?? '' })),
    walls,
  };
}

/** Solid box of a bottom-anchored prop, in world px · null if the prop has no collision */
export function propBox(p: MapProp): Rect | null {
  const def = PROPS[p.key];
  if (!def) return null;
  const [bx, by, bw, bh] = def.box;
  return { x: p.x - def.w / 2 + bx, y: p.bottom - def.h + by, w: bw, h: bh };
}

const EMPTY_SEATS = ['beanbag_sky', 'beanbag_butter', 'armchair_mint'];

/** Furniture drawn in a slot · occupied → backdrop + table in the zone color · empty → plant + a seat */
export function slotFurniture(slot: Rect & { fillOrder: number }, booth: { zone: ZoneColor | 'neutral' } | null): MapProp[] {
  const cx = slot.x + slot.w / 2;
  if (!booth) {
    return [
      { key: 'plant', x: slot.x + 0.7 * TILE, bottom: slot.y + 1.9 * TILE },
      { key: EMPTY_SEATS[slot.fillOrder % EMPTY_SEATS.length]!, x: cx, bottom: slot.y + 3.4 * TILE },
    ];
  }
  return [
    { key: `backdrop_${booth.zone}_${slot.fillOrder % 2}`, x: cx, bottom: slot.y + 2 * TILE },
    { key: `table_${booth.zone}_${slot.fillOrder % 3}`, x: cx, bottom: slot.y + 3.3 * TILE },
  ];
}

export const contains = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/**
 * Point collision for a player's feet: walls, map props and booth furniture.
 * Rebuild when booths change (a booth added during the event adds a table).
 */
export function buildCollision(layout: HallLayout, occupiedSlotKeys: ReadonlySet<string>) {
  const boxes: Rect[] = [];
  for (const p of layout.props) {
    const b = propBox(p);
    if (b) boxes.push(b);
  }
  for (const s of layout.slots)
    for (const p of slotFurniture(s, occupiedSlotKeys.has(s.key) ? { zone: 'neutral' } : null)) {
      const b = propBox(p);
      if (b) boxes.push(b);
    }
  return {
    boxes,
    isWalkable(x: number, y: number) {
      if (x < 0 || y < 0 || x >= layout.widthPx || y >= layout.heightPx) return false;
      if (layout.walls[Math.floor(y / TILE) * layout.cols + Math.floor(x / TILE)]) return false;
      return !boxes.some((b) => contains(b, x, y));
    },
  };
}

/** Where a player stands when they "go to booth": in front of the table, inside the carpet */
export function boothStandPoint(slot: Rect) {
  return { x: Math.round(slot.x + slot.w / 2), y: Math.round(slot.y + slot.h - 18) };
}
