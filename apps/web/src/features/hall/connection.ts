'use client';
import { Callbacks, Client, type Room } from '@colyseus/sdk';
import { HALL_ROOM, NEARBY_CHAT_TTL_MS, type BoothView, type ChatMessage, type ClientMessages, type EventRole, type HallTicket, type PlayerView, type PosterView, type REACTIONS } from '@connecta/shared';
import { api } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { useHall, type HallPerson } from './store';

type RoomState = { players: Map<string, PlayerView>; booths: Map<string, BoothView & { sharing: boolean }>; entryPaused: boolean };
export type HallRoom = Room<RoomState>;

const badges = (s: string) => (s ? (s.split(',') as EventRole[]) : []);
const person = (sessionId: string, p: PlayerView): HallPerson => ({ sessionId, userId: p.userId, name: p.name, avatar: p.avatar, badges: badges(p.badges), booth: p.booth });

/** Browser URL for Colyseus · relative/empty = same host (nginx path) */
function realtimeUrl(fromTicket: string) {
  const u = process.env.NEXT_PUBLIC_REALTIME_URL || fromTicket;
  return u.replace(/^ws/, 'http');
}

type Listeners = {
  poster: (v: PosterView & { projectId: string }) => void;
  react: (v: { sessionId: string; emoji: string }) => void;
  bubble: (m: ChatMessage) => void;
  correct: (p: { x: number; y: number }) => void;
  boothUpdated: (projectId: string) => void;
  roleChanged: (roles: EventRole[]) => void;
  muted: (by: string) => void;
  eventEnded: () => void;
};

/**
 * One hall session: ticket from the api → Colyseus room → store updates.
 * Positions are NOT mirrored into React; Phaser reads them straight from room.state.
 */
export class HallConnection {
  room: HallRoom | null = null;
  ticket: HallTicket | null = null;
  private listeners: { [K in keyof Listeners]: Set<Listeners[K]> } = {
    poster: new Set(), react: new Set(), bubble: new Set(), correct: new Set(), boothUpdated: new Set(), roleChanged: new Set(), muted: new Set(), eventEnded: new Set(),
  };
  private unbind: (() => void)[] = [];
  private disposed = false;

  constructor(readonly eventId: string) {}

  on<K extends keyof Listeners>(event: K, fn: Listeners[K]) {
    this.listeners[event].add(fn);
    return () => void this.listeners[event].delete(fn);
  }
  private emit<K extends keyof Listeners>(event: K, ...args: Parameters<Listeners[K]>) {
    for (const fn of this.listeners[event]) (fn as (...a: Parameters<Listeners[K]>) => void)(...args);
  }

  /** The gate runs in the api (capacity, domain, ban, join form) · realtime only trusts the 60-second ticket */
  async connect() {
    const set = useHall.getState().set;
    set({ phase: 'ticket', blockedBy: null });
    try {
      this.ticket = (await api.POST('/api/v1/events/{eventId}/hall-tickets', { params: { path: { eventId: this.eventId } } })).data!;
    } catch (e) {
      if (e instanceof ApiError) set({ phase: 'blocked', blockedBy: e.code });
      else set({ phase: 'failed' });
      return false;
    }
    set({ phase: 'joining' });
    try {
      const room = await new Client(realtimeUrl(this.ticket.realtimeUrl)).joinOrCreate<RoomState>(HALL_ROOM, { eventId: this.eventId, ticket: this.ticket.ticket });
      if (this.disposed) {
        void room.leave();
        return false;
      }
      this.room = room;
      this.bind(room);
      set({ mySessionId: room.sessionId, phase: 'media' });
      return true;
    } catch {
      set({ phase: 'failed' });
      return false;
    }
  }

  private bind(room: HallRoom) {
    const s = useHall.getState().set;
    const cb = Callbacks.get(room as never) as unknown as {
      onAdd: (path: string, fn: (v: unknown, key: string) => void) => () => void;
      onRemove: (path: string, fn: (v: unknown, key: string) => void) => () => void;
      onChange: (target: unknown, fn: () => void) => () => void;
      listen: (path: string, fn: (v: unknown) => void) => () => void;
    };
    const upsertPerson = (key: string, p: PlayerView) => {
      const st = useHall.getState();
      const next = person(key, p);
      const prev = st.people[key];
      if (prev && prev.booth === next.booth && prev.name === next.name && prev.badges.join() === next.badges.join()) return;
      s({ people: { ...st.people, [key]: next }, ...(key === room.sessionId && { myUserId: next.userId, roles: next.badges }) });
    };
    const upsertBooth = (key: string, b: BoothView & { sharing: boolean }) => s({ booths: { ...useHall.getState().booths, [key]: { ...b } } });
    this.unbind.push(
      cb.onAdd('players', (v, key) => {
        const p = v as PlayerView;
        upsertPerson(key, p);
        // only identity / booth / badges matter to React · position changes are filtered out in upsertPerson
        this.unbind.push(cb.onChange(p, () => upsertPerson(key, p)));
      }),
      cb.onRemove('players', (_v, key) => {
        const { [key]: _gone, ...rest } = useHall.getState().people;
        s({ people: rest });
      }),
      cb.onAdd('booths', (v, key) => {
        const b = v as BoothView & { sharing: boolean };
        upsertBooth(key, b);
        this.unbind.push(cb.onChange(b, () => upsertBooth(key, b)));
      }),
      cb.onRemove('booths', (_v, key) => {
        const { [key]: _gone, ...rest } = useHall.getState().booths;
        s({ booths: rest });
      }),
      cb.listen('entryPaused', (v) => s({ entryPaused: !!v })),
    );

    room.onMessage('chatHistory', (msgs: ChatMessage[]) => s({ everyone: msgs }));
    // ask for the Everyone history only once our handlers exist
    room.send('chat:history', {});
    room.onMessage('chat', (m: ChatMessage) => {
      const st = useHall.getState();
      if (m.scope === 'all') s({ everyone: [...st.everyone, m].slice(-200) });
      else {
        // Nearby has no history: bubbles fade after ~5 s
        s({ nearby: [...st.nearby.filter((x) => x.expiresAt > Date.now()), { ...m, expiresAt: Date.now() + NEARBY_CHAT_TTL_MS }] });
        this.emit('bubble', m);
      }
    });
    room.onMessage('announcement', ({ text }: { text: string }) => s({ banner: text }));
    room.onMessage('correct', (p: { x: number; y: number }) => this.emit('correct', p));
    room.onMessage('poster:view', (v: PosterView & { projectId: string }) => this.emit('poster', v));
    room.onMessage('react', (v: { sessionId: string; emoji: string }) => this.emit('react', v));
    room.onMessage('boothUpdated', ({ projectId }: { projectId: string }) => this.emit('boothUpdated', projectId));
    room.onMessage('roleChanged', ({ roles }: { roles: EventRole[] }) => {
      s({ roles });
      this.emit('roleChanged', roles);
    });
    room.onMessage('muted', ({ by }: { by: string }) => this.emit('muted', by));
    room.onMessage('kicked', (k: { reason: string; banned: boolean }) => s({ kicked: k, phase: 'kicked' }));
    room.onMessage('eventEnded', () => this.emit('eventEnded'));
    room.onDrop(() => s({ reconnecting: true }));
    room.onReconnect(() => s({ reconnecting: false }));
    room.onLeave((code) => {
      if (this.disposed) return;
      if (code === 4001) s({ kicked: { reason: 'You opened the hall in another tab.', banned: false }, phase: 'kicked' });
      else if (code === 4003 && !useHall.getState().kicked) s({ kicked: { reason: 'An organizer removed you from the hall.', banned: false }, phase: 'kicked' });
      else if (code === 4004) s({ kicked: { reason: 'The hall is closed.', banned: false }, phase: 'kicked' });
      else if (code !== 1000) s({ phase: 'failed', reconnecting: false });
    });
  }

  send<K extends keyof ClientMessages>(type: K, msg: ClientMessages[K]) {
    this.room?.send(type, msg);
  }
  posterOpen(projectId: string) {
    this.room?.send('poster:open', { projectId });
  }
  share(on: boolean) {
    this.room?.send('share', { on });
  }
  react(emoji: (typeof REACTIONS)[number]) {
    this.room?.send('react', { emoji });
  }

  async dispose() {
    this.disposed = true;
    for (const off of this.unbind) off();
    this.unbind = [];
    await this.room?.leave(true).catch(() => undefined);
    this.room = null;
  }
}
