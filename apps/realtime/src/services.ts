import { Redis } from 'ioredis';
import { jwtVerify } from 'jose';
import { RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { createPrisma } from '@connecta/db';
import { hallBoothKey, type HallTicketClaims } from '@connecta/shared';
import { env } from './env.js';

/** One DB pool, one Redis publisher and one LiveKit client per process, shared by every hall room */
export const db = createPrisma(env.DATABASE_URL, 10);
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 2 });
/** Subscriber connection (a Redis connection in subscribe mode can't run other commands) */
export const redisSub = new Redis(env.REDIS_URL);

const ticketKey = new TextEncoder().encode(env.HALL_TICKET_SECRET);
const usedJti = new Map<string, number>(); // jti → expiry (ms) · single use

export async function verifyTicket(ticket: string, eventId: string): Promise<HallTicketClaims | null> {
  try {
    const { payload } = await jwtVerify(ticket, ticketKey, { audience: 'connecta-realtime', algorithms: ['HS256'] });
    if (payload.eventId !== eventId || !payload.sub || !payload.jti) return null;
    const now = Date.now();
    for (const [k, exp] of usedJti) if (exp < now) usedJti.delete(k);
    if (usedJti.has(payload.jti)) return null;
    usedJti.set(payload.jti, (payload.exp ?? 0) * 1000);
    return { sub: payload.sub, eventId, jti: payload.jti };
  } catch {
    return null;
  }
}

const lk = new RoomServiceClient(env.LIVEKIT_URL.replace(/^ws/, 'http'), env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
export const mediaRoom = (eventId: string) => `hall-${eventId}`;

/**
 * Camera + screen share only while a presenter stands in their own booth (3rd place roles are enforced)
 * The participant may not have joined LiveKit yet → a few retries
 */
export async function setPresenterMedia(eventId: string, userId: string, onStage: boolean, attempt = 0): Promise<void> {
  const sources = onStage ? [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : [TrackSource.MICROPHONE];
  try {
    await lk.updateParticipant(mediaRoom(eventId), userId, { permission: { canPublish: true, canSubscribe: true, canPublishData: false, canPublishSources: sources } });
  } catch {
    if (attempt < 3) setTimeout(() => void setPresenterMedia(eventId, userId, onStage, attempt + 1), 2000);
  }
}

export const boothKey = hallBoothKey;
