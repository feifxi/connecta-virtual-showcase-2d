import { randomUUID } from 'node:crypto';
import { Room, ServerError, validate, type Client } from 'colyseus';
import { z } from 'zod';
import type { EventRole } from '@connecta/db';
import {
  boothStandPoint,
  BOOTH_DWELL_MS,
  buildCollision,
  CHAT_HISTORY_LIMIT,
  CHAT_MAX_LENGTH,
  contains,
  HEAR_LEAVE_TILES,
  HEATMAP_CELL_TILES,
  HEATMAP_FLUSH_MS,
  HEATMAP_SAMPLE_MS,
  hallChannel,
  MAX_MOVE_BUDGET_PX,
  parseHallMap,
  REACTIONS,
  SPEED_TOLERANCE,
  TICK_HZ,
  TILE,
  WALK_SPEED,
  FAST_WALK,
  type ChatMessage,
  type HallLayout,
  type HallSignal,
  type MapSlot,
  type TiledMap,
} from '@connecta/shared';
import { Booth, HallState, Player } from './schema.js';
import { boothKey, db, redis, redisSub, setPresenterMedia, verifyTicket } from './services.js';

const PEEK_PX = 2.5 * TILE; // standing this close to a booth (outside it) counts as "saw it"
const STOP_MS = 250; // no move message for this long = standing still
const dirSchema = z.enum(['down', 'up', 'left', 'right']);

type Auth = { userId: string; name: string; avatar: number; roles: EventRole[]; presenterOf: string[] };
type Meta = {
  budget: { px: number; at: number };
  lastMoveAt: number;
  carpet: { projectId: string; since: number } | null;
  visitId: bigint | null;
  presenceId: bigint;
  peeked: Set<string>;
  shareSeen: Set<string>;
  posterSeen: Set<string>;
  chatTimes: number[];
  reactTimes: number[];
};

type HallClient = Client<{ userData: Meta; auth: Auth }>;

export const live = { rooms: 0, clients: 0 };

/**
 * One room per hall (= per event). Positions are client-predicted and server-validated (S3);
 * booth membership, Live badges and booth-scoped permissions are decided here, never by the client.
 */
export class HallRoom extends Room<{ state: HallState; client: HallClient }> {
  state = new HallState();
  patchRate = 1000 / TICK_HZ;
  maxMessagesPerSecond = 60;

  private eventId = '';
  private layout!: HallLayout;
  private collision!: ReturnType<typeof buildCollision>;
  private slots = new Map<string, MapSlot & { projectId: string }>(); // projectId → slot
  private chatAll: ChatMessage[] = [];
  private heat = new Map<string, number>();
  private onSignal = (channel: string, raw: string) => {
    if (channel === hallChannel(this.eventId)) void this.signal(JSON.parse(raw) as HallSignal);
  };

  // ---------- lifecycle ----------

  async onCreate(options: { eventId?: string }) {
    if (!options.eventId) throw new ServerError(400, 'eventId required');
    this.eventId = options.eventId;
    this.maxClients = Number(process.env.MAX_CLIENTS_PER_HALL ?? 1000);
    await this.loadHall();
    const ev = await db.event.findUniqueOrThrow({ where: { id: this.eventId }, select: { entryPaused: true } });
    this.state.entryPaused = ev.entryPaused;
    await redisSub.subscribe(hallChannel(this.eventId));
    redisSub.on('message', this.onSignal);
    this.clock.setInterval(() => this.tickBooths(), 200);
    this.clock.setInterval(() => this.sampleHeat(), HEATMAP_SAMPLE_MS);
    this.clock.setInterval(() => void this.flushHeat(), HEATMAP_FLUSH_MS);
    live.rooms++;
  }

  async onDispose() {
    redisSub.off('message', this.onSignal);
    await redisSub.unsubscribe(hallChannel(this.eventId));
    await this.flushHeat();
    await redis.del(boothKey(this.eventId));
    live.rooms--;
  }

  /** The api's hall ticket is the only way in · the gate itself (capacity, domain, ban, form) ran in the api */
  async onAuth(_client: Client, options: { ticket?: string }): Promise<Auth> {
    const claims = options.ticket ? await verifyTicket(options.ticket, this.eventId) : null;
    if (!claims) throw new ServerError(401, 'Invalid or expired hall ticket');
    const [user, attendee, member, ban, presenterOf] = await Promise.all([
      db.user.findUnique({ where: { id: claims.sub }, select: { avatarPreset: true, deletedAt: true } }),
      db.eventAttendee.findUnique({ where: { eventId_userId: { eventId: this.eventId, userId: claims.sub } }, select: { displayName: true } }),
      db.eventMember.findUnique({ where: { eventId_userId: { eventId: this.eventId, userId: claims.sub } }, select: { roles: true } }),
      db.eventBan.findUnique({ where: { eventId_userId: { eventId: this.eventId, userId: claims.sub } } }),
      this.presenterProjects(claims.sub),
    ]);
    if (!user || user.deletedAt || !attendee || ban) throw new ServerError(403, 'Not allowed in this hall');
    return { userId: claims.sub, name: attendee.displayName, avatar: user.avatarPreset ?? 0, roles: member?.roles ?? [], presenterOf };
  }

  async onJoin(client: HallClient) {
    const auth = client.auth!;
    // one avatar per person: a second tab replaces the first
    for (const other of this.clients) if (other !== client && other.auth?.userId === auth.userId) other.leave(4001, 'Opened in another tab');
    // a dropped tab waiting to reconnect still has an avatar → the new session replaces it now
    for (const [key, p] of this.state.players) if (p.userId === auth.userId) this.state.players.delete(key);

    const p = new Player();
    p.userId = auth.userId;
    p.name = auth.name;
    p.avatar = auth.avatar;
    p.badges = auth.roles.join(',');
    p.booth = '';
    p.dir = 'down';
    const spawn = this.freePointNear(this.layout.spawn.x + Math.round((Math.random() - 0.5) * 64), this.layout.spawn.y + Math.round((Math.random() - 0.5) * 32));
    p.x = spawn.x;
    p.y = spawn.y;
    this.state.players.set(client.sessionId, p);

    const presence = await db.presenceSession.create({ data: { eventId: this.eventId, userId: auth.userId }, select: { id: true } });
    client.userData = {
      budget: { px: MAX_MOVE_BUDGET_PX, at: Date.now() },
      lastMoveAt: 0,
      carpet: null,
      visitId: null,
      presenceId: presence.id,
      peeked: new Set(),
      shareSeen: new Set(),
      posterSeen: new Set(),
      chatTimes: [],
      reactTimes: [],
    };
    await redis.hset(boothKey(this.eventId), auth.userId, '');
    live.clients++;
  }

  /** Network blip: keep the avatar for a while so the client can reconnect without losing its spot */
  async onDrop(client: HallClient) {
    await this.allowReconnection(client, 20);
  }

  async onLeave(client: HallClient) {
    const p = this.state.players.get(client.sessionId);
    if (p?.booth) await this.leaveBooth(client, p);
    this.state.players.delete(client.sessionId);
    live.clients--;
    if (client.userData) await db.presenceSession.update({ where: { id: client.userData.presenceId }, data: { leftAt: new Date() } }).catch(() => undefined);
    if (client.auth && !this.clients.some((c) => c !== client && c.auth?.userId === client.auth!.userId)) await redis.hdel(boothKey(this.eventId), client.auth!.userId);
    this.refreshBooths();
  }

  // ---------- messages ----------

  messages = {
    /** Client-predicted movement · the server accepts plausible positions only (distance budget + walls/tables) */
    move: validate(z.object({ x: z.number().finite(), y: z.number().finite(), dir: dirSchema }), (client: HallClient, { x, y, dir }) => {
      const p = this.state.players.get(client.sessionId);
      const m = client.userData;
      if (!p || !m) return;
      const now = Date.now();
      m.budget.px = Math.min(m.budget.px + ((now - m.budget.at) / 1000) * WALK_SPEED * FAST_WALK * SPEED_TOLERANCE, MAX_MOVE_BUDGET_PX);
      m.budget.at = now;
      const nx = Math.round(x);
      const ny = Math.round(y);
      const dist = Math.hypot(nx - p.x, ny - p.y);
      if (dist > m.budget.px || !this.collision.isWalkable(nx, ny)) {
        client.send('correct', { x: p.x, y: p.y });
        return;
      }
      p.x = nx;
      p.y = ny;
      p.dir = dir;
      m.budget.px -= dist;
      if (dist > 0) m.lastMoveAt = now;
    }),

    /** From the booth list: the server moves you (a client can't teleport) and you're in the booth at once */
    goToBooth: validate(z.object({ projectId: z.string().uuid() }), (client: HallClient, { projectId }) => {
      const p = this.state.players.get(client.sessionId);
      const slot = this.slots.get(projectId);
      if (!p || !slot || !client.userData) return;
      const to = boothStandPoint(slot);
      p.x = to.x;
      p.y = to.y;
      p.dir = 'up';
      client.userData.lastMoveAt = 0;
      client.userData.budget = { px: MAX_MOVE_BUDGET_PX, at: Date.now() };
      client.send('correct', to);
    }),

    'chat:nearby': validate(z.object({ text: z.string().trim().min(1).max(CHAT_MAX_LENGTH) }), (client: HallClient, { text }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || !this.allowChat(client)) return;
      const msg = this.chatMessage(client, 'nearby', text);
      // in a booth: the booth only · outside: people within hearing range who aren't inside a booth
      for (const c of this.clients) {
        const o = this.state.players.get(c.sessionId);
        if (!o) continue;
        const near = p.booth ? o.booth === p.booth : !o.booth && Math.hypot(o.x - p.x, o.y - p.y) <= HEAR_LEAVE_TILES * TILE;
        if (near) c.send('chat', msg);
      }
    }),

    'chat:all': validate(z.object({ text: z.string().trim().min(1).max(CHAT_MAX_LENGTH) }), (client: HallClient, { text }) => {
      if (!this.allowChat(client)) return;
      this.pushAll(this.chatMessage(client, 'all', text));
    }),

    /** Presenter drives the poster (page/zoom/pan) for everyone in their booth · anyone else's message is dropped */
    'poster:view': validate(
      z.object({ fileId: z.string().uuid(), page: z.number().int().min(1).max(200), zoom: z.number().min(0.5).max(8), x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
      (client: HallClient, view) => {
        const p = this.state.players.get(client.sessionId);
        if (!p?.booth || !client.auth!.presenterOf.includes(p.booth)) return;
        for (const c of this.clients) if (c !== client && this.state.players.get(c.sessionId)?.booth === p.booth) c.send('poster:view', { ...view, projectId: p.booth });
      },
    ),

    /** A visitor opened the poster viewer (analytics: poster_view, once per person per booth) */
    'poster:open': validate(z.object({ projectId: z.string().uuid() }), (client: HallClient, { projectId }) => {
      if (!client.userData || client.userData.posterSeen.has(projectId) || !this.slots.has(projectId)) return;
      client.userData.posterSeen.add(projectId);
      void this.track('poster_view', client.auth!.userId, projectId);
    }),

    /** Presenter tells the room they started/stopped sharing (LiveKit already limits who may publish a screen) */
    share: validate(z.object({ on: z.boolean() }), (client: HallClient, { on }) => {
      const p = this.state.players.get(client.sessionId);
      if (!p?.booth || !client.auth!.presenterOf.includes(p.booth)) return;
      const booth = this.state.booths.get(p.booth);
      if (!booth || booth.sharing === on) return;
      booth.sharing = on;
      void this.track(on ? 'screen_share_start' : 'screen_share_end', client.auth!.userId, p.booth);
      if (on) for (const c of this.clients) if (this.state.players.get(c.sessionId)?.booth === p.booth) this.seeShare(c, p.booth);
    }),

    react: validate(z.object({ emoji: z.enum(REACTIONS) }), (client: HallClient, { emoji }) => {
      const p = this.state.players.get(client.sessionId);
      const m = client.userData;
      if (!p || !m) return;
      const now = Date.now();
      m.reactTimes = m.reactTimes.filter((t: number) => now - t < 1000);
      if (m.reactTimes.length >= 3) return;
      m.reactTimes.push(now);
      for (const c of this.clients) {
        const o = this.state.players.get(c.sessionId);
        if (o && Math.hypot(o.x - p.x, o.y - p.y) <= HEAR_LEAVE_TILES * TILE) c.send('react', { sessionId: client.sessionId, emoji });
      }
    }),

    'chat:history': (client: HallClient) => client.send('chatHistory', this.chatAll),

    ping: () => Date.now(),
  };

  // ---------- booths ----------

  private async presenterProjects(userId: string) {
    const rows = await db.projectMember.findMany({ where: { userId, project: { eventId: this.eventId } }, select: { projectId: true } });
    const member = await db.eventMember.findUnique({ where: { eventId_userId: { eventId: this.eventId, userId } }, select: { roles: true } });
    return member?.roles.includes('PRESENTER') ? rows.map((r) => r.projectId) : [];
  }

  /** Booths from the DB (projects placed in slots) · rebuilt when the api says booths changed */
  private async loadHall() {
    const hall = await db.hall.findUniqueOrThrow({ where: { eventId: this.eventId }, include: { slots: { include: { project: { include: { category: true } } } } } });
    this.layout = parseHallMap(hall.mapJson as unknown as TiledMap);
    const byOrder = new Map(this.layout.slots.map((s) => [s.fillOrder, s]));
    this.slots.clear();
    const seen = new Set<string>();
    for (const s of hall.slots) {
      const proj = s.project;
      const mapSlot = byOrder.get(s.fillOrder);
      if (!proj || !mapSlot) continue;
      this.slots.set(proj.id, { ...mapSlot, projectId: proj.id });
      seen.add(proj.id);
      const b = this.state.booths.get(proj.id) ?? new Booth();
      b.projectId = proj.id;
      b.slotKey = mapSlot.key;
      b.title = proj.title;
      b.zone = proj.category?.color ?? 'neutral';
      b.categoryName = proj.category?.name ?? '';
      if (!this.state.booths.has(proj.id)) this.state.booths.set(proj.id, b);
    }
    for (const id of [...this.state.booths.keys()]) if (!seen.has(id)) this.state.booths.delete(id);
    this.collision = buildCollision(this.layout, new Set([...this.slots.values()].map((s) => s.key)));
  }

  /** Stop on a carpet (or arrive from the list) = in · keep walking on it = in after the dwell · step off = out */
  private tickBooths() {
    const now = Date.now();
    for (const client of this.clients) {
      const p = this.state.players.get(client.sessionId);
      const m = client.userData;
      if (!p || !m) continue;
      const on = [...this.slots.values()].find((s) => contains(s, p.x, p.y)) ?? null;
      if (on?.projectId !== m.carpet?.projectId) m.carpet = on ? { projectId: on.projectId, since: now } : null;
      if (p.booth && p.booth !== on?.projectId) void this.leaveBooth(client, p);
      const stopped = now - m.lastMoveAt > STOP_MS;
      if (on && !p.booth && (stopped || now - m.carpet!.since >= BOOTH_DWELL_MS)) void this.enterBooth(client, p, on.projectId);
      if (!on) this.peek(client, p);
    }
    this.refreshBooths();
  }

  private async enterBooth(client: HallClient, p: Player, projectId: string) {
    p.booth = projectId;
    this.refreshBooths();
    await redis.hset(boothKey(this.eventId), client.auth!.userId, projectId);
    if (client.auth!.presenterOf.includes(projectId)) void setPresenterMedia(this.eventId, client.auth!.userId, true);
    if (this.state.booths.get(projectId)?.sharing) this.seeShare(client, projectId);
    const visit = await db.boothVisit.create({ data: { eventId: this.eventId, projectId, userId: client.auth!.userId }, select: { id: true } });
    if (client.userData) client.userData.visitId = visit.id;
  }

  private async leaveBooth(client: HallClient, p: Player) {
    const projectId = p.booth;
    p.booth = '';
    const booth = this.state.booths.get(projectId);
    if (client.auth!.presenterOf.includes(projectId)) {
      void setPresenterMedia(this.eventId, client.auth!.userId, false);
      // the last presenter sharing walks out → the share ends
      if (booth?.sharing && !this.presentersIn(projectId).length) {
        booth.sharing = false;
        void this.track('screen_share_end', client.auth!.userId, projectId);
      }
    }
    this.refreshBooths();
    await redis.hset(boothKey(this.eventId), client.auth!.userId, '');
    const visitId = client.userData?.visitId;
    if (visitId) {
      client.userData!.visitId = null;
      await db.boothVisit.update({ where: { id: visitId }, data: { leftAt: new Date() } }).catch(() => undefined);
    }
  }

  private presentersIn(projectId: string) {
    return this.clients.filter((c) => this.state.players.get(c.sessionId)?.booth === projectId && c.auth?.presenterOf.includes(projectId));
  }

  /** ● Live = at least one of the team is inside · count = everyone inside */
  private refreshBooths() {
    const counts = new Map<string, number>();
    const liveSet = new Set<string>();
    for (const c of this.clients) {
      const p = this.state.players.get(c.sessionId);
      if (!p?.booth) continue;
      counts.set(p.booth, (counts.get(p.booth) ?? 0) + 1);
      if (c.auth?.presenterOf.includes(p.booth)) liveSet.add(p.booth);
    }
    for (const [id, b] of this.state.booths) {
      const n = counts.get(id) ?? 0;
      if (b.count !== n) b.count = n;
      if (b.live !== liveSet.has(id)) b.live = liveSet.has(id);
    }
  }

  private peek(client: HallClient, p: Player) {
    const m = client.userData!;
    for (const s of this.slots.values()) {
      if (m.peeked.has(s.projectId)) continue;
      const dx = Math.max(s.x - p.x, 0, p.x - (s.x + s.w));
      const dy = Math.max(s.y - p.y, 0, p.y - (s.y + s.h));
      if (Math.hypot(dx, dy) < PEEK_PX) {
        m.peeked.add(s.projectId);
        void this.track('booth_peek', client.auth!.userId, s.projectId);
      }
    }
  }

  private seeShare(client: HallClient, projectId: string) {
    const m = client.userData;
    if (!m || m.shareSeen.has(projectId) || client.auth!.presenterOf.includes(projectId)) return;
    m.shareSeen.add(projectId);
    void this.track('screen_share_view', client.auth!.userId, projectId);
  }

  /** After a booth table appears, anyone now standing inside furniture is nudged to the nearest free spot */
  private freePointNear(x: number, y: number) {
    if (this.collision.isWalkable(x, y)) return { x, y };
    for (let r = 8; r < 20 * TILE; r += 8)
      for (let a = 0; a < 16; a++) {
        const nx = Math.round(x + Math.cos((a / 16) * Math.PI * 2) * r);
        const ny = Math.round(y + Math.sin((a / 16) * Math.PI * 2) * r);
        if (this.collision.isWalkable(nx, ny)) return { x: nx, y: ny };
      }
    return { x: Math.round(this.layout.spawn.x), y: Math.round(this.layout.spawn.y) };
  }

  // ---------- chat ----------

  private allowChat(client: HallClient) {
    const m = client.userData;
    if (!m) return false;
    const now = Date.now();
    m.chatTimes = m.chatTimes.filter((t: number) => now - t < 5000);
    if (m.chatTimes.length >= 5) return false;
    m.chatTimes.push(now);
    return true;
  }

  private chatMessage(client: HallClient, scope: 'nearby' | 'all', text: string): ChatMessage {
    return { id: randomUUID(), scope, fromUserId: client.auth!.userId, fromName: client.auth!.name, text, at: Date.now() };
  }

  /** Everyone tab: memory only, for the duration of the event (never written to the DB) */
  private pushAll(msg: ChatMessage) {
    this.chatAll.push(msg);
    if (this.chatAll.length > CHAT_HISTORY_LIMIT) this.chatAll.shift();
    this.broadcast('chat', msg);
  }

  // ---------- analytics (aggregated, no raw positions) ----------

  private track(type: string, userId: string, projectId: string | null) {
    return db.analyticsEvent.create({ data: { eventId: this.eventId, type, userId, projectId } }).catch(() => undefined);
  }

  private sampleHeat() {
    const cell = HEATMAP_CELL_TILES * TILE;
    for (const p of this.state.players.values()) {
      const key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
      this.heat.set(key, (this.heat.get(key) ?? 0) + 1);
    }
  }

  private async flushHeat() {
    if (!this.heat.size) return;
    const minute = new Date(Math.floor(Date.now() / 60_000) * 60_000);
    const rows = [...this.heat];
    this.heat.clear();
    for (const [key, samples] of rows) {
      const [cellX, cellY] = key.split(':').map(Number) as [number, number];
      await db.heatmapCount
        .upsert({ where: { eventId_cellX_cellY_minute: { eventId: this.eventId, cellX, cellY, minute } }, create: { eventId: this.eventId, cellX, cellY, minute, samples }, update: { samples: { increment: samples } } })
        .catch(() => undefined);
    }
  }

  // ---------- signals from the api (after its DB write) ----------

  private async signal(s: HallSignal) {
    const clientsOf = (userId: string) => this.clients.filter((c) => userId === '*' || c.auth?.userId === userId);
    switch (s.type) {
      case 'roleChanged': {
        for (const c of clientsOf(s.userId)) {
          const presenterOf = await this.presenterProjects(s.userId);
          const p = this.state.players.get(c.sessionId);
          const wasOnStage = p?.booth && c.auth!.presenterOf.includes(p.booth);
          c.auth!.roles = s.roles;
          c.auth!.presenterOf = presenterOf;
          if (p) p.badges = s.roles.join(',');
          // removed as presenter while presenting → screen share and camera cut at once
          if (p?.booth && wasOnStage && !presenterOf.includes(p.booth)) {
            void setPresenterMedia(this.eventId, s.userId, false);
            const booth = this.state.booths.get(p.booth);
            if (booth?.sharing && !this.presentersIn(p.booth).length) booth.sharing = false;
          }
          if (p?.booth && !wasOnStage && presenterOf.includes(p.booth)) void setPresenterMedia(this.eventId, s.userId, true);
          c.send('roleChanged', { roles: s.roles });
        }
        this.refreshBooths();
        break;
      }
      case 'boothsChanged': {
        await this.loadHall();
        for (const c of this.clients) {
          const p = this.state.players.get(c.sessionId);
          if (!p || this.collision.isWalkable(p.x, p.y)) continue;
          const to = this.freePointNear(p.x, p.y);
          p.x = to.x;
          p.y = to.y;
          c.send('correct', to);
        }
        this.broadcast('boothUpdated', { projectId: '*' });
        break;
      }
      case 'boothUpdated': {
        const proj = await db.project.findUnique({ where: { id: s.projectId }, include: { category: true } });
        const b = this.state.booths.get(s.projectId);
        if (proj && b) {
          b.title = proj.title;
          b.zone = proj.category?.color ?? 'neutral';
          b.categoryName = proj.category?.name ?? '';
        }
        this.broadcast('boothUpdated', { projectId: s.projectId });
        break;
      }
      case 'kick':
        for (const c of clientsOf(s.userId)) {
          c.send('kicked', { reason: s.reason, banned: s.banned });
          c.leave(4003, s.reason);
        }
        break;
      case 'announcement':
        this.pushAll({ id: randomUUID(), scope: 'all', fromUserId: s.byUserId, fromName: s.byName, text: s.text, at: Date.now(), announcement: true });
        this.broadcast('announcement', { text: s.text });
        break;
      case 'settings':
        this.state.entryPaused = s.entryPaused;
        break;
      case 'muted':
        for (const c of clientsOf(s.userId)) c.send('muted', { by: s.by });
        break;
      case 'statusChanged':
        if (s.status === 'ARCHIVED') for (const c of this.clients) c.leave(4004, 'The hall is closed');
        else if (s.status === 'EXHIBITION') {
          this.chatAll = []; // the Everyone tab is cleared when the event ends
          this.broadcast('eventEnded', {});
        }
        break;
    }
  }
}
