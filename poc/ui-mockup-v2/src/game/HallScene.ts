import * as Phaser from "phaser";
import { START_ZOOM } from "@/lib/data";
import { NavGrid, tiledProps, type Dir } from "./nav";

// Phaser hall for mockup v2 · map + runtime booth placement from poc/demo-app (/presets, Hall preset)
// · characters from poc/TestUI · offline (no server, no media) · the React page draws all UI on top

export type HallProject = { no: string; title: string; short: string; category: string; live: boolean; presenter: string; avatar: number };
export type BoothInfo = HallProject & { people: number };
export type Hearing = { people: string[]; inBooth: string | null };

export const HallEvents = { READY: "hall-ready", ENTER: "hall-booth-enter", LEAVE: "hall-booth-leave", HEARING: "hall-hearing", PEEK: "hall-booth-peek" } as const;

const T = 32;
const SPEED = 150;
const FAST = 3; // "go to booth" from the list walks 3× faster (still a walk, not a warp)
const NPC_SPEED = 64;
const RANGE = 5 * T; // hearing range outside booths (same as Gather)
const WALK_DWELL = 600; // stop on a booth carpet = join now · still walking on it = join after this (ms) · cutting across doesn't connect
const PEEK = 2.5 * T; // standing this close to a booth (outside it) shows its card
const SCALE = 0.62; // 80px TestUI frames → ~50px characters on 32px tiles
const DIRS: Dir[] = ["down", "up", "left", "right"]; // sheet rows
const CHAR_COUNT = 14;
const ZONE_TILE: Record<string, number> = { Engineering: 3, Computing: 4, Health: 5, Design: 6 }; // mint · lilac · peach · sky carpets
const ZONE_PROP: Record<string, string> = { Engineering: "mint", Computing: "lilac", Health: "peach", Design: "sky" };
const ZONE_COLOR: Record<string, number> = { Engineering: 0x3fae7f, Computing: 0x8a6ee0, Health: 0xf08a5d, Design: 0x4b95e0, lounge: 0xf08a9e, stage: 0x7b5a8f, welcome: 0x0f1a3a };
const NAMES = ["Mika", "Haru", "Nami", "Ren", "Sora", "Yuki", "Mali", "Nont", "Phum", "Prae", "Dr. Arun", "Dr. Pim", "Fah", "Dr. May"];

type Slot = { id: string; block: string; order: number; rect: Phaser.Geom.Rectangle; project: HallProject | null };
type Npc = { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; char: number; dir: Dir; path: Phaser.Math.Vector2[]; wait: number; roam: boolean; target: Spot | null; name: string };
type Spot = { x: number; y: number; taken: boolean; kind: string };

export class HallScene extends Phaser.Scene {
  private projects: HallProject[] = [];
  private avatar = 7;
  private playerName = "Nont (you)";
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerLabel!: Phaser.GameObjects.Text;
  private bubble: { text: Phaser.GameObjects.Text; lift: number } | null = null;
  private fast = false;
  private playerDir: Dir = "down";
  private ring!: Phaser.GameObjects.Graphics;
  private nav!: NavGrid;
  private floor!: Phaser.Tilemaps.TilemapLayer;
  private slots: Slot[] = [];
  private blockRects = new Map<string, Phaser.Geom.Rectangle>();
  private boothSolids!: Phaser.Physics.Arcade.StaticGroup;
  private npcs: Npc[] = [];
  private spots: Spot[] = [];
  private path: Phaser.Math.Vector2[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private current: Slot | null = null;
  private onCarpet: { slot: Slot; since: number } | null = null;
  private peekKey = "";
  private hearingKey = "";

  constructor() {
    super("hall");
  }

  init(data: { projects: HallProject[]; avatar: number; name: string }) {
    this.projects = data.projects;
    this.avatar = data.avatar;
    this.playerName = data.name;
  }

  preload() {
    this.load.tilemapTiledJSON("hall-map", "/assets/presets/hall.json");
    this.load.image("hall-tiles", "/assets/presets/tiles.png");
    this.load.atlas("hall-props", "/assets/presets/props.png", "/assets/presets/props.json");
    this.load.json("hall-boxes", "/assets/presets/boxes.json");
    for (let i = 0; i < CHAR_COUNT; i++) this.load.spritesheet(`c${i}`, `/assets/characters/character-${String(i + 1).padStart(2, "0")}-walk.png`, { frameWidth: 80, frameHeight: 80 });
  }

  create() {
    const map = this.add.tilemap("hall-map");
    const tiles = map.addTilesetImage("hall-tiles", "hall-tiles");
    if (!tiles) throw new Error("tileset missing");
    this.floor = map.createLayer("floor", tiles, 0, 0)!.setDepth(-2) as Phaser.Tilemaps.TilemapLayer;
    const walls = map.createLayer("walls", tiles, 0, 0)!.setDepth(-1);
    walls.setCollisionByProperty({ collides: true });

    for (let i = 0; i < CHAR_COUNT; i++)
      DIRS.forEach((d, row) => {
        if (!this.anims.exists(`c${i}-${d}`)) this.anims.create({ key: `c${i}-${d}`, frames: this.anims.generateFrameNumbers(`c${i}`, { start: row * 4, end: row * 4 + 3 }), frameRate: 7, repeat: -1 });
      });

    this.nav = new NavGrid(map.widthInPixels, map.heightInPixels);
    for (let gy = 0; gy < this.nav.h; gy++)
      for (let gx = 0; gx < this.nav.w; gx++)
        if (walls.getTileAtWorldXY(gx * 16 + 8, gy * 16 + 8)?.collides) this.nav.blocked[gy * this.nav.w + gx] = 1;
    const solids = this.physics.add.staticGroup();
    this.boothSolids = this.physics.add.staticGroup();
    for (const o of map.getObjectLayer("props")?.objects ?? []) this.addProp(tiledProps(o).key, o.x!, o.y!, solids);

    for (const o of map.getObjectLayer("blocks")?.objects ?? []) this.blockRects.set(o.name, new Phaser.Geom.Rectangle(o.x!, o.y!, o.width!, o.height!));
    this.slots = (map.getObjectLayer("slots")?.objects ?? [])
      .map((o) => { const p = tiledProps(o); return { id: o.name, block: p.block, order: Number(p.order), rect: new Phaser.Geom.Rectangle(o.x!, o.y!, o.width!, o.height!), project: null }; })
      .sort((a, b) => a.order - b.order);
    for (const o of map.getObjectLayer("signs")?.objects ?? []) {
      const zone = tiledProps(o).zone;
      if (zone === "stage" || zone === "lounge" || zone === "welcome" || zone === "mint") this.plate(o.x!, o.y!, zone === "welcome" ? "SENIOR DESIGN SHOWCASE 2026" : o.name.toUpperCase(), ZONE_COLOR[zone] ?? ZONE_COLOR.stage, zone === "welcome" ? 12 : 10);
    }
    this.spots = (map.getObjectLayer("spots")?.objects ?? []).map((o) => ({ x: o.x!, y: o.y!, taken: false, kind: o.name }));

    this.placeBooths();

    const spawn = map.findObject("spawns", (o) => o.name === "spawn");
    this.player = this.physics.add.sprite(spawn?.x ?? 100, spawn?.y ?? 100, `c${this.avatar}`, 0).setOrigin(0.5, 0.92).setScale(SCALE);
    (this.player.body as Phaser.Physics.Arcade.Body).setSize(26, 12).setOffset(27, 62);
    this.physics.add.collider(this.player, walls);
    this.physics.add.collider(this.player, solids);
    this.physics.add.collider(this.player, this.boothSolids);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.player.setCollideWorldBounds(true);
    this.playerLabel = this.label(this.playerName, true);

    this.ring = this.add.graphics().setDepth(-0.5);
    this.ring.fillStyle(0x1d5cf5, 0.06).fillCircle(0, 0, RANGE).lineStyle(1.5, 0x1d5cf5, 0.4).strokeCircle(0, 0, RANGE);

    this.spawnCrowd();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels).setZoom(START_ZOOM).startFollow(this.player, true, 0.12, 0.12);
    cam.setBackgroundColor("#d6d8df");

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys("W,A,S,D") as typeof this.wasd;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const w = pointer.positionToCamera(cam) as Phaser.Math.Vector2;
      this.path = this.nav.find(this.player.x, this.player.y - 4, w.x, w.y) ?? [];
      this.fast = false;
    });
    this.game.events.emit(HallEvents.READY);
  }

  // ---------- commands from the React page ----------
  setZoom(z: number) { this.cameras.main.setZoom(z); }
  goToBooth(no: string) {
    const s = this.slots.find((x) => x.project?.no === no);
    if (s) { this.path = this.nav.find(this.player.x, this.player.y - 4, s.rect.centerX, s.rect.bottom - 18) ?? []; this.fast = true; }
  }
  setPlayerName(name: string) { this.playerLabel.setText(name); }

  // above your head: a reaction pops up and floats away (~2 s) · a nearby chat message stays ~5 s then fades
  say(text: string, kind: "reaction" | "chat") {
    this.bubble?.text.destroy();
    const emoji = kind === "reaction";
    const t = this.add.text(this.player.x, this.player.y - 56, text, {
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: emoji ? "22px" : "10px", color: "#0f1a3a", resolution: 4,
      ...(emoji ? {} : { backgroundColor: "#ffffff", padding: { left: 6, right: 6, top: 4, bottom: 4 }, wordWrap: { width: 150 } }),
    }).setOrigin(0.5, 1).setDepth(100003);
    t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    const b = { text: t, lift: 0 };
    this.bubble = b;
    if (emoji) this.tweens.add({ targets: b, lift: 18, duration: 1800, ease: "Sine.easeOut" });
    this.tweens.add({ targets: t, alpha: 0, delay: emoji ? 1300 : 4500, duration: 500, onComplete: () => { t.destroy(); if (this.bubble === b) this.bubble = null; } });
  }

  // ---------- booths: one category per block, empty slots become plants ----------
  private placeBooths() {
    const blocks = [...this.blockRects.keys()];
    let next = 0;
    for (const cat of ["Engineering", "Computing", "Health", "Design"]) {
      let room: Slot[] = [];
      for (const p of this.projects.filter((x) => x.category === cat)) {
        if (!room.length) {
          const id = blocks[next++];
          if (!id) break;
          room = this.slots.filter((s) => s.block === id);
          const r = this.blockRects.get(id)!;
          this.plate(r.centerX, r.y - 0.45 * T, cat.toUpperCase(), ZONE_COLOR[cat], 10);
        }
        room.shift()!.project = p;
      }
    }
    const rnd = new Phaser.Math.RandomDataGenerator(["booths"]);
    for (const s of this.slots) {
      const b = s.project;
      const cx = s.rect.centerX;
      if (!b) {
        this.addProp("plant", s.rect.x + 0.7 * T, s.rect.y + 1.9 * T, this.boothSolids);
        this.addProp(rnd.pick(["beanbag_sky", "beanbag_butter", "armchair_mint"]), cx, s.rect.y + 3.4 * T, this.boothSolids);
        continue;
      }
      for (let y = 0; y < s.rect.height / T; y++) for (let x = 0; x < s.rect.width / T; x++) this.floor.putTileAt(ZONE_TILE[b.category] + 1, s.rect.x / T + x, s.rect.y / T + y);
      const zone = ZONE_PROP[b.category];
      this.addProp(`backdrop_${zone}_${Number(b.no) % 2}`, cx, s.rect.y + 2 * T, this.boothSolids);
      this.addProp(`table_${zone}_${Number(b.no) % 3}`, cx, s.rect.y + 3.3 * T, this.boothSolids);
      this.plate(cx, s.rect.y - 0.6 * T + 6, `${b.no}  ${b.short}`, ZONE_COLOR[b.category], 9);
      if (b.live) this.npcs.push(this.npc(b.avatar, cx - 0.4 * T, s.rect.y + 2.6 * T, "down", false, `${b.presenter} · Presenter`));
      for (let k = 0; k < 4; k++) this.spots.push({ x: s.rect.x + (0.7 + k * 0.85) * T, y: s.rect.y + (4.2 + (k % 2) * 0.45) * T, taken: false, kind: "audience" });
    }
  }

  private spawnCrowd() {
    const rnd = new Phaser.Math.RandomDataGenerator(["crowd"]);
    let n = 0;
    for (const s of this.spots) {
      const take = s.kind === "audience" ? rnd.frac() < 0.35 : s.kind === "seat" ? rnd.frac() < 0.3 : s.kind === "lounge" || s.kind === "wander" ? rnd.frac() < 0.7 : false;
      if (!take) continue;
      const c = (n++ * 5 + 3) % CHAR_COUNT;
      const role = n === 3 ? " · Judge" : n === 7 ? " · Admin" : "";
      const npc = this.npc(c, s.x, s.y, s.kind === "audience" || s.kind === "seat" ? "up" : "down", s.kind !== "seat", `${NAMES[c]}${role}`);
      npc.target = s;
      s.taken = true;
      this.npcs.push(npc);
    }
  }

  // ---------- update ----------
  update(_t: number, delta: number) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const dir = new Phaser.Math.Vector2(
      Number(this.cursors.right.isDown || this.wasd.D.isDown) - Number(this.cursors.left.isDown || this.wasd.A.isDown),
      Number(this.cursors.down.isDown || this.wasd.S.isDown) - Number(this.cursors.up.isDown || this.wasd.W.isDown),
    );
    if (dir.lengthSq() > 0) { this.path = []; this.fast = false; }
    else if (this.path.length) {
      const to = new Phaser.Math.Vector2(this.path[0].x - this.player.x, this.path[0].y - this.player.y);
      if (to.length() < (this.fast ? 8 : 4)) { this.path.shift(); if (!this.path.length) this.fast = false; }
      else dir.copy(to);
    }
    const moving = dir.lengthSq() > 0;
    if (moving) {
      dir.normalize().scale(this.fast ? SPEED * FAST : SPEED);
      body.setVelocity(dir.x, dir.y);
      this.playerDir = Math.abs(dir.x) > Math.abs(dir.y) ? (dir.x > 0 ? "right" : "left") : dir.y > 0 ? "down" : "up";
    } else body.setVelocity(0, 0);
    this.animate(this.player, this.avatar, this.playerDir, moving);
    this.player.setDepth(this.player.y);
    this.playerLabel.setPosition(this.player.x, this.player.y - 50).setDepth(100002);
    this.bubble?.text.setPosition(this.player.x, this.player.y - 64 - this.bubble.lift);
    this.ring.setPosition(this.player.x, this.player.y - 8);

    for (const n of this.npcs) this.updateNpc(n, delta);

    // booth: stop on the carpet (or arrive from the booth list) → join at once · keep walking on it → join after WALK_DWELL · step off → leave at once
    const carpet = this.slots.find((s) => s.project && s.rect.contains(this.player.x, this.player.y)) ?? null;
    if (carpet !== this.onCarpet?.slot) {
      this.onCarpet = carpet ? { slot: carpet, since: this.time.now } : null;
      if (this.current && this.current !== carpet) { this.current = null; this.game.events.emit(HallEvents.LEAVE); }
    }
    const stopped = !moving && !this.path.length; // between waypoints of a path isn't a stop
    if (this.onCarpet && !this.current && (stopped || this.time.now - this.onCarpet.since >= WALK_DWELL)) {
      const s = this.onCarpet.slot;
      this.current = s;
      this.game.events.emit(HallEvents.ENTER, { ...s.project!, people: this.inSlot(s).length + 1 } satisfies BoothInfo);
    }
    this.ring.setVisible(!this.current);
    this.updatePeek(carpet);
    this.updateHearing();
  }

  private inSlot(s: Slot) { return this.npcs.filter((n) => s.rect.contains(n.sprite.x, n.sprite.y)); }

  // near a booth but not on it: tell the page which one (name, Live, how many inside) before you step in
  private updatePeek(carpet: Slot | null) {
    const dist = (r: Phaser.Geom.Rectangle) => Math.hypot(Math.max(r.x - this.player.x, 0, this.player.x - r.right), Math.max(r.y - this.player.y, 0, this.player.y - r.bottom));
    const near = carpet ? null : this.slots.filter((s) => s.project && dist(s.rect) < PEEK).sort((a, b) => dist(a.rect) - dist(b.rect))[0] ?? null;
    const n = near ? this.inSlot(near).length : 0;
    const key = near ? `${near.id}:${n}` : "";
    if (key === this.peekKey) return;
    this.peekKey = key;
    this.game.events.emit(HallEvents.PEEK, near ? ({ ...near.project!, people: n } satisfies BoothInfo) : null);
  }

  // inside a booth: everyone in that booth, nobody outside · outside: people in range who aren't in a booth
  private updateHearing() {
    const zoneOf = (x: number, y: number) => this.slots.find((s) => s.project && s.rect.contains(x, y)) ?? null;
    const people = this.current
      ? this.inSlot(this.current).map((n) => n.name)
      : this.npcs.filter((n) => !zoneOf(n.sprite.x, n.sprite.y) && Phaser.Math.Distance.Between(n.sprite.x, n.sprite.y, this.player.x, this.player.y) < RANGE).map((n) => n.name);
    const key = `${this.current?.id}:${people.join(",")}`;
    if (key === this.hearingKey) return;
    this.hearingKey = key;
    this.game.events.emit(HallEvents.HEARING, { people, inBooth: this.current?.project?.no ?? null } satisfies Hearing);
  }

  private updateNpc(n: Npc, delta: number) {
    if (n.path.length) {
      const next = n.path[0];
      const dx = next.x - n.sprite.x, dy = next.y - n.sprite.y, d = Math.hypot(dx, dy);
      const step = (NPC_SPEED * delta) / 1000;
      if (d <= step) { n.sprite.setPosition(next.x, next.y); n.path.shift(); if (!n.path.length && n.target?.kind === "audience") n.dir = "up"; }
      else { n.sprite.x += (dx / d) * step; n.sprite.y += (dy / d) * step; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up"; }
      this.animate(n.sprite, n.char, n.dir, true);
    } else {
      this.animate(n.sprite, n.char, n.dir, false);
      if (n.roam) {
        n.wait -= delta;
        if (n.wait < 0) {
          n.wait = Phaser.Math.Between(5000, 14000);
          const free = this.spots.filter((s) => !s.taken && s.kind !== "seat");
          const t = Phaser.Utils.Array.GetRandom(free);
          const path = t && this.nav.find(n.sprite.x, n.sprite.y - 4, t.x, t.y);
          if (t && path) { if (n.target) n.target.taken = false; t.taken = true; n.target = t; n.path = path; }
        }
      }
    }
    n.sprite.setDepth(n.sprite.y);
    n.label.setPosition(n.sprite.x, n.sprite.y - 50).setDepth(100001 + n.sprite.y / 10000);
  }

  // ---------- helpers ----------
  private animate(s: Phaser.GameObjects.Sprite, char: number, dir: Dir, moving: boolean) {
    const key = `c${char}-${dir}`;
    if (moving) { if (s.anims.currentAnim?.key !== key || !s.anims.isPlaying) s.play(key); }
    else { s.stop(); s.setFrame(DIRS.indexOf(dir) * 4); }
  }

  private npc(char: number, x: number, y: number, dir: Dir, roam: boolean, name: string): Npc {
    const sprite = this.add.sprite(x, y, `c${char}`, DIRS.indexOf(dir) * 4).setOrigin(0.5, 0.92).setScale(SCALE);
    return { sprite, label: this.label(name, false), char, dir, path: [], wait: Phaser.Math.Between(800, 9000), roam, target: null, name };
  }

  private label(text: string, you: boolean) {
    const t = this.add.text(0, 0, text, {
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: "10px", fontStyle: "600", color: "#ffffff", resolution: 4,
      backgroundColor: you ? "#1d5cf5" : "rgba(15,26,58,0.87)", padding: { left: 5, right: 5, top: 1, bottom: 1 },
    }).setOrigin(0.5, 1);
    t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return t;
  }

  private plate(x: number, y: number, s: string, bg: number, size: number) {
    const t = this.add.text(x, y, s, { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", fontSize: `${size + 2}px`, fontStyle: "700", color: "#ffffff", resolution: 4, padding: { left: 7, right: 7, top: 3, bottom: 3 } }).setOrigin(0.5).setDepth(100000);
    t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.graphics().setDepth(99999).fillStyle(bg, 1).fillRoundedRect(x - t.width / 2, y - t.height / 2, t.width, t.height, t.height / 2);
  }

  private addProp(key: string, x: number, bottom: number, solids: Phaser.Physics.Arcade.StaticGroup) {
    const frame = this.textures.getFrame("hall-props", key);
    if (!frame) return;
    this.add.image(x, bottom, "hall-props", key).setOrigin(0.5, 1).setDepth(bottom);
    const box = (this.cache.json.get("hall-boxes") as Record<string, number[]>)[key];
    if (!box) return;
    const [bx, by, bw, bh] = box;
    const left = x - frame.width / 2 + bx, top = bottom - frame.height + by;
    solids.add(this.add.zone(left + bw / 2, top + bh / 2, bw, bh));
    this.nav.mark(left - 6, top - 4, bw + 12, bh + 8);
  }
}
