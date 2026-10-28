import * as Phaser from 'phaser';
import { Callbacks } from '@colyseus/sdk';
import {
  buildCollision,
  contains,
  parseHallMap,
  slotFurniture,
  TICK_HZ,
  TILE,
  WALK_SPEED,
  ZONE_HEX,
  type BoothView,
  type ChatMessage,
  type Dir,
  type HallLayout,
  type MapSlot,
  type PlayerView,
  type TiledMap,
  type ZoneColor,
} from '@connecta/shared';
import { withBase } from '@/lib/utils';
import type { HallConnection } from '../connection';
import { useHall } from '../store';
import { NavGrid } from './nav';

// The hall renderer · React draws every control on top · rooms state comes from Colyseus, never from React

const DIRS: Dir[] = ['down', 'up', 'left', 'right']; // sprite sheet rows
const CHAR_COUNT = 14;
const SCALE = 0.62; // 80px frames → ~50px characters on 32px tiles
const INTERP_DELAY_MS = 120; // remote players drawn slightly in the past (two snapshots to blend, S3)
const MAX_SNAPSHOTS = 10;
const PEEK_PX = 2.5 * TILE;
const CARPET_TILE: Record<ZoneColor | 'neutral', number> = { mint: 4, lilac: 5, peach: 6, sky: 7, neutral: 7 }; // gids in hall-tiles
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";
const BADGE: Record<string, string> = { ADMIN: 'Admin', PRESENTER: 'Presenter', JUDGE: 'Judge' };

type Snapshot = { t: number; x: number; y: number };
type Remote = { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; name: string; ring: Phaser.GameObjects.Ellipse; snaps: Snapshot[]; avatar: number; dir: Dir; userId: string };
type Bubble = { text: Phaser.GameObjects.Text; lift: number };

export type HallSceneData = { conn: HallConnection; mapJson: Record<string, unknown>; title: string };

export class HallScene extends Phaser.Scene {
  private conn!: HallConnection;
  private title = '';
  private map!: TiledMap;
  private layout!: HallLayout;
  private collision!: ReturnType<typeof buildCollision>;
  private nav!: NavGrid;
  private floor!: Phaser.Tilemaps.TilemapLayer;
  private boothLayer!: Phaser.GameObjects.Container;
  private boothKey = '';
  /** floor tile under every slot cell before carpets were painted (restored when a slot is empty) */
  private baseTiles = new Map<string, number>();
  private me: Phaser.GameObjects.Sprite | null = null;
  private meLabel: Phaser.GameObjects.Text | null = null;
  private meAvatar = 0;
  private meDir: Dir = 'down';
  private remotes = new Map<string, Remote>();
  private bubbles = new Map<string, Bubble>();
  private path: Phaser.Math.Vector2[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private lastSent = 0;
  private sent = { x: -1, y: -1 };
  private peekKey = '';
  private peekAt = { x: -1, y: -1, booths: null as unknown };
  private offs: (() => void)[] = [];

  constructor() {
    super('hall');
  }

  init(data: HallSceneData) {
    this.conn = data.conn;
    this.title = data.title;
    this.map = data.mapJson as unknown as TiledMap;
    this.layout = parseHallMap(this.map);
  }

  preload() {
    this.cache.tilemap.add('hall-map', { format: Phaser.Tilemaps.Formats.TILED_JSON, data: this.map });
    this.load.image('hall-tiles', withBase('/assets/presets/tiles.png'));
    this.load.atlas('hall-props', withBase('/assets/presets/props.png'), withBase('/assets/presets/props.json'));
    for (let i = 0; i < CHAR_COUNT; i++) this.load.spritesheet(`c${i}`, withBase(`/assets/characters/character-${String(i + 1).padStart(2, '0')}-walk.png`), { frameWidth: 80, frameHeight: 80 });
  }

  create() {
    const map = this.add.tilemap('hall-map');
    const tiles = map.addTilesetImage('hall-tiles', 'hall-tiles');
    if (!tiles) throw new Error('tileset missing');
    this.floor = map.createLayer('floor', tiles, 0, 0)!.setDepth(-2) as Phaser.Tilemaps.TilemapLayer;
    for (const sl of this.layout.slots)
      for (let y = 0; y < sl.h / TILE; y++)
        for (let x = 0; x < sl.w / TILE; x++) {
          const tx = sl.x / TILE + x;
          const ty = sl.y / TILE + y;
          this.baseTiles.set(`${tx}:${ty}`, this.floor.getTileAt(tx, ty)?.index ?? 1);
        }
    map.createLayer('walls', tiles, 0, 0)!.setDepth(-1);
    for (let i = 0; i < CHAR_COUNT; i++)
      DIRS.forEach((d, row) => {
        if (!this.anims.exists(`c${i}-${d}`)) this.anims.create({ key: `c${i}-${d}`, frames: this.anims.generateFrameNumbers(`c${i}`, { start: row * 4, end: row * 4 + 3 }), frameRate: 7, repeat: -1 });
      });
    for (const p of this.layout.props) this.prop(p.key, p.x, p.bottom);
    for (const s of this.layout.signs) if (['stage', 'lounge', 'welcome'].includes(s.zone)) this.plate(s.x, s.y, (s.zone === 'welcome' ? this.title : s.name).toUpperCase(), s.zone === 'welcome' ? 0x0f1a3a : s.zone === 'lounge' ? 0xf08a9e : 0x7b5a8f, 10);
    this.boothLayer = this.add.container(0, 0);
    this.renderBooths();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.layout.widthPx, this.layout.heightPx).setZoom(useHall.getState().zoom).setBackgroundColor('#d6d8df');
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys('W,A,S,D', false) as typeof this.wasd;
    // typing in chat must not walk the avatar
    kb.disableGlobalCapture();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.me) return;
      const w = pointer.positionToCamera(cam) as Phaser.Math.Vector2;
      this.path = this.nav.find(this.me.x, this.me.y - 4, w.x, w.y) ?? [];
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.setZoom(useHall.getState().zoom * (dy > 0 ? 0.9 : 1.1)));

    this.bindRoom();
    this.offs.push(
      useHall.subscribe((s, prev) => {
        if (s.zoom !== prev.zoom) cam.setZoom(s.zoom);
        if (s.booths !== prev.booths) this.renderBooths();
        if (s.speaking !== prev.speaking) this.paintSpeaking(s.speaking);
      }),
      this.conn.on('correct', ({ x, y }) => {
        this.me?.setPosition(x, y);
        this.path = [];
      }),
      this.conn.on('bubble', (m) => this.say(m)),
      this.conn.on('react', ({ sessionId, emoji }) => this.emote(sessionId, emoji)),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dispose());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.dispose());
  }

  /**
   * Unhooks the store and the room right away · game.destroy() is deferred to the next frame,
   * and a store update in between would repaint a destroyed tilemap
   */
  dispose() {
    for (const off of this.offs.splice(0)) off();
  }

  /** Zoom 0.9–2.6 · also used by the React zoom buttons */
  setZoom(z: number) {
    useHall.getState().set({ zoom: Math.min(2.6, Math.max(0.9, Math.round(z * 100) / 100)) });
  }

  // ---------- room state → sprites ----------

  private bindRoom() {
    const room = this.conn.room!;
    const cb = Callbacks.get(room as never) as unknown as {
      onAdd: (path: string, fn: (v: PlayerView, key: string) => void) => () => void;
      onRemove: (path: string, fn: (v: PlayerView, key: string) => void) => () => void;
      onChange: (target: unknown, fn: () => void) => () => void;
    };
    this.offs.push(
      cb.onAdd('players', (p, key) => {
        if (key === room.sessionId) {
          this.meAvatar = p.avatar;
          this.me = this.add.sprite(p.x, p.y, `c${p.avatar}`, 0).setOrigin(0.5, 0.92).setScale(SCALE);
          this.meLabel = this.label(`${p.name} (you)`, true);
          this.cameras.main.startFollow(this.me, true, 0.12, 0.12);
          return;
        }
        const r: Remote = {
          sprite: this.add.sprite(p.x, p.y, `c${p.avatar % CHAR_COUNT}`, 0).setOrigin(0.5, 0.92).setScale(SCALE),
          label: this.label(this.nameOf(p), false),
          name: this.nameOf(p),
          ring: this.add.ellipse(p.x, p.y, 34, 14).setStrokeStyle(2, 0x33c27f).setVisible(false),
          snaps: [{ t: performance.now(), x: p.x, y: p.y }],
          avatar: p.avatar % CHAR_COUNT,
          dir: 'down',
          userId: p.userId,
        };
        this.remotes.set(key, r);
        this.offs.push(
          cb.onChange(p, () => {
            const now = performance.now();
            const prev = r.snaps[r.snaps.length - 1]!;
            if (prev.x !== p.x || prev.y !== p.y) {
              // after standing still, start from rest one tick ago (otherwise the idle gap is interpolated)
              if (now - prev.t > 200) r.snaps.push({ t: now - 1000 / TICK_HZ, x: prev.x, y: prev.y });
              r.snaps.push({ t: now, x: p.x, y: p.y });
              if (r.snaps.length > MAX_SNAPSHOTS) r.snaps.shift();
            }
            r.dir = (p.dir as Dir) || r.dir;
            // re-rendering a Text texture is expensive: only when the name or badges change, not on every move
            const name = this.nameOf(p);
            if (name !== r.name) {
              r.name = name;
              r.label.setText(name);
            }
          }),
        );
      }),
      cb.onRemove('players', (_p, key) => {
        const r = this.remotes.get(key);
        r?.sprite.destroy();
        r?.label.destroy();
        r?.ring.destroy();
        this.remotes.delete(key);
      }),
    );
  }

  private nameOf(p: PlayerView) {
    const b = p.badges ? p.badges.split(',').map((x) => BADGE[x]).filter(Boolean) : [];
    return b.length ? `${p.name} · ${b.join(' · ')}` : p.name;
  }

  private paintSpeaking(userIds: string[]) {
    const set = new Set(userIds);
    for (const r of this.remotes.values()) r.ring.setVisible(set.has(r.userId));
  }

  // ---------- booths (server decides which slot holds which project) ----------

  private slotByKey(key: string) {
    return this.layout.slots.find((s) => s.key === key);
  }

  private renderBooths() {
    if (!this.boothLayer?.scene || !this.floor?.layer) return;
    const booths = Object.values(useHall.getState().booths);
    const key = booths.map((b) => `${b.slotKey}:${b.zone}:${b.title}`).sort().join('|');
    if (key === this.boothKey) return;
    this.boothKey = key;
    this.boothLayer.removeAll(true);
    const bySlot = new Map(booths.map((b) => [b.slotKey, b]));
    for (const s of this.layout.slots) {
      const b = bySlot.get(s.key);
      const zone = (b?.zone ?? 'neutral') as ZoneColor | 'neutral';
      for (let y = 0; y < s.h / TILE; y++)
        for (let x = 0; x < s.w / TILE; x++) {
          const tx = s.x / TILE + x;
          const ty = s.y / TILE + y;
          this.floor.putTileAt(b ? CARPET_TILE[zone] : (this.baseTiles.get(`${tx}:${ty}`) ?? 1), tx, ty);
        }
      for (const p of slotFurniture(s, b ? { zone } : null)) {
        const img = this.prop(p.key, p.x, p.bottom);
        if (img) this.boothLayer.add(img);
      }
      if (b) {
        this.plate(s.x + s.w / 2, s.y - 0.6 * TILE + 6, `${s.label}  ${b.title.length > 13 ? `${b.title.slice(0, 12).trimEnd()}…` : b.title}`, Number.parseInt(ZONE_HEX[zone].slice(1), 16), 9, this.boothLayer);
      }
    }
    // one plate per zone (block) · blocks hold one category each
    for (const block of this.layout.blocks) {
      const b = booths.find((x) => this.slotByKey(x.slotKey)?.block === block.id && x.categoryName);
      if (b) this.plate(block.x + block.w / 2, block.y - 0.45 * TILE, b.categoryName.toUpperCase(), Number.parseInt(ZONE_HEX[b.zone as ZoneColor].slice(1), 16), 10, this.boothLayer);
    }
    this.collision = buildCollision(this.layout, new Set(booths.map((b) => b.slotKey)));
    this.nav = new NavGrid(this.layout.widthPx, this.layout.heightPx);
    for (let gy = 0; gy < this.nav.h; gy++)
      for (let gx = 0; gx < this.nav.w; gx++) if (!this.collision.isWalkable(gx * 16 + 8, gy * 16 + 8)) this.nav.blocked[gy * this.nav.w + gx] = 1;
    for (const box of this.collision.boxes) this.nav.mark(box.x - 6, box.y - 4, box.w + 12, box.h + 8);
  }

  // ---------- frame ----------

  update(time: number, delta: number) {
    if (this.me) this.moveMe(time, delta);
    const renderAt = performance.now() - INTERP_DELAY_MS;
    for (const r of this.remotes.values()) {
      const prev = { x: r.sprite.x, y: r.sprite.y };
      const at = interpolate(r.snaps, renderAt);
      r.sprite.setPosition(at.x, at.y).setDepth(at.y);
      const moving = Math.hypot(at.x - prev.x, at.y - prev.y) > 0.3;
      this.animate(r.sprite, r.avatar, r.dir, moving);
      r.label.setPosition(at.x, at.y - 50).setDepth(100001 + at.y / 10000);
      r.ring.setPosition(at.x, at.y - 2).setDepth(at.y - 1);
    }
    for (const [sessionId, b] of this.bubbles) {
      const host = sessionId === this.conn.room?.sessionId ? this.me : this.remotes.get(sessionId)?.sprite;
      if (host) b.text.setPosition(host.x, host.y - 64 - b.lift);
    }
  }

  private moveMe(time: number, delta: number) {
    const me = this.me!;
    const dir = new Phaser.Math.Vector2(
      Number(this.cursors.right.isDown || this.wasd.D.isDown) - Number(this.cursors.left.isDown || this.wasd.A.isDown),
      Number(this.cursors.down.isDown || this.wasd.S.isDown) - Number(this.cursors.up.isDown || this.wasd.W.isDown),
    );
    if (dir.lengthSq() > 0) this.path = [];
    else if (this.path.length) {
      const next = this.path[0]!;
      const to = new Phaser.Math.Vector2(next.x - me.x, next.y - me.y);
      if (to.length() < 4) this.path.shift();
      else dir.copy(to);
    }
    const moving = dir.lengthSq() > 0;
    if (moving) {
      dir.normalize().scale((WALK_SPEED * delta) / 1000);
      // same collision model as the server · slide along whichever axis is free
      const nx = me.x + dir.x;
      const ny = me.y + dir.y;
      if (this.collision.isWalkable(nx, ny)) me.setPosition(nx, ny);
      else if (this.collision.isWalkable(nx, me.y)) me.setPosition(nx, me.y);
      else if (this.collision.isWalkable(me.x, ny)) me.setPosition(me.x, ny);
      else this.path = [];
      this.meDir = Math.abs(dir.x) > Math.abs(dir.y) ? (dir.x > 0 ? 'right' : 'left') : dir.y > 0 ? 'down' : 'up';
    }
    this.animate(me, this.meAvatar, this.meDir, moving);
    me.setDepth(me.y);
    this.meLabel?.setPosition(me.x, me.y - 50).setDepth(100002);

    const x = Math.round(me.x);
    const y = Math.round(me.y);
    if (time - this.lastSent >= 1000 / TICK_HZ && (x !== this.sent.x || y !== this.sent.y)) {
      this.conn.send('move', { x, y, dir: this.meDir });
      this.lastSent = time;
      this.sent = { x, y };
    }
    this.updatePeek(x, y);
  }

  /** Standing next to a booth (not on its carpet): show its name, ● Live and how many are inside */
  private updatePeek(x: number, y: number) {
    const st = useHall.getState();
    if (x === this.peekAt.x && y === this.peekAt.y && st.booths === this.peekAt.booths) return;
    this.peekAt = { x, y, booths: st.booths };
    const slots = Object.values(st.booths)
      .map((b) => ({ b, s: this.slotByKey(b.slotKey) }))
      .filter((v): v is { b: BoothView & { sharing: boolean }; s: MapSlot } => !!v.s);
    const onCarpet = slots.some(({ s }) => contains(s, x, y));
    const dist = (s: MapSlot) => Math.hypot(Math.max(s.x - x, 0, x - (s.x + s.w)), Math.max(s.y - y, 0, y - (s.y + s.h)));
    const near = onCarpet ? null : (slots.filter(({ s }) => dist(s) < PEEK_PX).sort((a, b) => dist(a.s) - dist(b.s))[0]?.b.projectId ?? null);
    if ((near ?? '') !== this.peekKey) {
      this.peekKey = near ?? '';
      st.set({ peek: near });
    }
  }

  // ---------- bubbles ----------

  private say(m: ChatMessage) {
    const sessionId = [...this.remotes].find(([, r]) => r.userId === m.fromUserId)?.[0] ?? (m.fromUserId === useHall.getState().myUserId ? this.conn.room?.sessionId : undefined);
    if (sessionId) this.bubble(sessionId, m.text, false);
  }

  private emote(sessionId: string, emoji: string) {
    this.bubble(sessionId, emoji, true);
  }

  private bubble(sessionId: string, text: string, emoji: boolean) {
    this.bubbles.get(sessionId)?.text.destroy();
    const t = this.add
      .text(0, 0, text, {
        fontFamily: FONT,
        fontSize: emoji ? '22px' : '10px',
        color: '#0f1a3a',
        resolution: 4,
        ...(emoji ? {} : { backgroundColor: '#ffffff', padding: { left: 6, right: 6, top: 4, bottom: 4 }, wordWrap: { width: 150 } }),
      })
      .setOrigin(0.5, 1)
      .setDepth(100003);
    t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    const b: Bubble = { text: t, lift: 0 };
    this.bubbles.set(sessionId, b);
    if (emoji) this.tweens.add({ targets: b, lift: 18, duration: 1800, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: emoji ? 1300 : 4500,
      duration: 500,
      onComplete: () => {
        t.destroy();
        if (this.bubbles.get(sessionId) === b) this.bubbles.delete(sessionId);
      },
    });
  }

  // ---------- helpers ----------

  private animate(s: Phaser.GameObjects.Sprite, char: number, dir: Dir, moving: boolean) {
    const key = `c${char}-${dir}`;
    if (moving) {
      if (s.anims.currentAnim?.key !== key || !s.anims.isPlaying) s.play(key);
    } else if (s.anims.isPlaying) {
      s.stop();
      s.setFrame(DIRS.indexOf(dir) * 4);
    }
  }

  private label(text: string, you: boolean) {
    const t = this.add
      .text(0, 0, text, { fontFamily: FONT, fontSize: '10px', fontStyle: '600', color: '#ffffff', resolution: 4, backgroundColor: you ? '#1d5cf5' : 'rgba(15,26,58,0.87)', padding: { left: 5, right: 5, top: 1, bottom: 1 } })
      .setOrigin(0.5, 1);
    t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return t;
  }

  private plate(x: number, y: number, s: string, bg: number, size: number, into?: Phaser.GameObjects.Container) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size + 2}px`, fontStyle: '700', color: '#ffffff', resolution: 4, padding: { left: 7, right: 7, top: 3, bottom: 3 } }).setOrigin(0.5).setDepth(100000);
    t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    const g = this.add.graphics().setDepth(99999).fillStyle(bg, 1).fillRoundedRect(x - t.width / 2, y - t.height / 2, t.width, t.height, t.height / 2);
    into?.add([g, t]);
  }

  private prop(key: string, x: number, bottom: number) {
    if (!this.textures.getFrame('hall-props', key)) return null;
    return this.add.image(x, bottom, 'hall-props', key).setOrigin(0.5, 1).setDepth(bottom);
  }
}

function interpolate(snaps: Snapshot[], t: number) {
  const last = snaps[snaps.length - 1]!;
  if (t >= last.t) return last;
  for (let i = snaps.length - 1; i > 0; i--) {
    const a = snaps[i - 1]!;
    const b = snaps[i]!;
    if (t >= a.t) {
      const k = (t - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }
  return snaps[0]!;
}
