import * as Phaser from 'phaser';

// Walk grid + A* (16px cells, 8 directions, no corner cutting) for click-to-walk · ported from ui-mockup-v2
export class NavGrid {
  readonly w: number;
  readonly h: number;
  blocked: Uint8Array;

  constructor(
    widthPx: number,
    heightPx: number,
    readonly cell = 16,
  ) {
    this.w = Math.ceil(widthPx / cell);
    this.h = Math.ceil(heightPx / cell);
    this.blocked = new Uint8Array(this.w * this.h);
  }

  mark(x: number, y: number, w: number, h: number) {
    const c = this.cell;
    for (let gy = Math.floor(y / c); gy <= Math.floor((y + h) / c); gy++)
      for (let gx = Math.floor(x / c); gx <= Math.floor((x + w) / c); gx++) if (gx >= 0 && gy >= 0 && gx < this.w && gy < this.h) this.blocked[gy * this.w + gx] = 1;
  }

  private free(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && !this.blocked[y * this.w + x];
  }

  private nearestFree(gx: number, gy: number): [number, number] | null {
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (this.free(gx + dx, gy + dy)) return [gx + dx, gy + dy];
    return null;
  }

  find(sx: number, sy: number, tx: number, ty: number): Phaser.Math.Vector2[] | null {
    const C = this.cell;
    const W = this.w;
    const N = this.w * this.h;
    const s = this.nearestFree(Math.floor(sx / C), Math.floor(sy / C));
    const t = this.nearestFree(Math.floor(tx / C), Math.floor(ty / C));
    if (!s || !t) return null;
    const start = s[1] * W + s[0];
    const goal = t[1] * W + t[0];
    const g = new Float32Array(N).fill(Infinity);
    const f = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const open: number[] = [start];
    const h = (i: number) => {
      const dx = Math.abs((i % W) - t[0]);
      const dy = Math.abs(Math.floor(i / W) - t[1]);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    g[start] = 0;
    f[start] = h(start);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (f[open[i]!]! < f[open[bi]!]!) bi = i;
      const cur = open.splice(bi, 1)[0]!;
      if (cur === goal) break;
      closed[cur] = 1;
      const cx = cur % W;
      const cy = Math.floor(cur / W);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (!this.free(nx, ny)) continue;
          const ni = ny * W + nx;
          if (closed[ni]) continue;
          if (dx && dy && (!this.free(nx, cy) || !this.free(cx, ny))) continue;
          const ng = g[cur]! + (dx && dy ? Math.SQRT2 : 1);
          if (ng < g[ni]!) {
            if (g[ni] === Infinity) open.push(ni);
            g[ni] = ng;
            f[ni] = ng + h(ni);
            from[ni] = cur;
          }
        }
    }
    if (from[goal] === -1 && goal !== start) return null;
    const cells: number[] = [];
    for (let c = goal; c !== -1 && c !== start; c = from[c]!) cells.unshift(c);
    const pts = cells.map((c) => new Phaser.Math.Vector2((c % W) * C + C / 2, Math.floor(c / W) * C + C / 2));
    if (pts.length && !this.blocked[Math.floor(ty / C) * W + Math.floor(tx / C)]) pts[pts.length - 1] = new Phaser.Math.Vector2(tx, ty);
    return simplify(pts);
  }
}

/** Drop points on a straight line so walking looks smooth */
function simplify(pts: Phaser.Math.Vector2[]) {
  if (pts.length < 3) return pts;
  const out = [pts[0]!];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = pts[i]!;
    const c = pts[i + 1]!;
    if (Math.sign(b.x - a.x) !== Math.sign(c.x - b.x) || Math.sign(b.y - a.y) !== Math.sign(c.y - b.y)) out.push(b);
  }
  out.push(pts[pts.length - 1]!);
  return out;
}
