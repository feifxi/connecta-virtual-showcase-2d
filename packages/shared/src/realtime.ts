// Colyseus protocol (docs/api.md → Realtime) · 1 room per hall, room name "hall", filtered by eventId
import type { EventRole, ZoneColor } from './constants.js';

export const HALL_ROOM = 'hall';
export type Dir = 'down' | 'up' | 'left' | 'right';

/** Synced state shapes (the server's @colyseus/schema classes match these) */
export interface PlayerView {
  userId: string;
  name: string;
  avatar: number;
  x: number;
  y: number;
  dir: Dir;
  /** comma-separated EventRole badges, from the server only */
  badges: string;
  /** projectId of the booth this player is inside ('' = walking the hall) */
  booth: string;
}
export interface BoothView {
  projectId: string;
  slotKey: string;
  title: string;
  zone: ZoneColor | 'neutral';
  categoryName: string;
  /** a presenter of this project is inside the booth */
  live: boolean;
  count: number;
}
export interface HallStateView {
  players: Map<string, PlayerView>;
  booths: Map<string, BoothView>;
  entryPaused: boolean;
}

export type ChatMessage = {
  id: string;
  scope: 'nearby' | 'all';
  fromUserId: string;
  fromName: string;
  text: string;
  at: number;
  announcement?: boolean;
};

export type PosterView = { fileId: string; page: number; zoom: number; x: number; y: number };

/** client → server */
export type ClientMessages = {
  move: { x: number; y: number; dir: Dir };
  goToBooth: { projectId: string };
  'chat:nearby': { text: string };
  'chat:all': { text: string };
  'poster:view': PosterView;
  react: { emoji: string };
};

/** server → client */
export type ServerMessages = {
  correct: { x: number; y: number };
  chat: ChatMessage;
  chatHistory: ChatMessage[];
  'poster:view': PosterView & { projectId: string };
  react: { sessionId: string; emoji: string };
  roleChanged: { roles: EventRole[] };
  boothUpdated: { projectId: string };
  announcement: { text: string };
  kicked: { reason: string; banned: boolean };
  muted: { by: string };
  eventEnded: Record<string, never>;
};

export const REACTIONS = ['👏', '❤️', '😂', '❓', '🔥'] as const;

/** api → realtime over Redis pub/sub (channel `hall:<eventId>`) after the DB write */
export type HallSignal =
  | { type: 'roleChanged'; userId: string; roles: EventRole[] }
  | { type: 'boothsChanged' }
  | { type: 'boothUpdated'; projectId: string }
  | { type: 'kick'; userId: string; reason: string; banned: boolean }
  | { type: 'announcement'; text: string; byUserId: string; byName: string }
  | { type: 'settings'; entryPaused: boolean }
  | { type: 'muted'; userId: string; by: string }
  | { type: 'statusChanged'; status: string };
export const hallChannel = (eventId: string) => `hall:${eventId}`;

/** Hall ticket JWT claims (signed by the api, verified by realtime) */
export type HallTicketClaims = { sub: string; eventId: string; jti: string };

/** Proximity volume (S4): 100% within 2 tiles → linear down to 15% at 5 tiles → stays 15% until cut at 7 */
export function proximityVolume(tiles: number, full = 2, enter = 5, min = 0.15) {
  return Math.max(min, Math.min(1, 1 - (tiles - full) / (enter - full)));
}
