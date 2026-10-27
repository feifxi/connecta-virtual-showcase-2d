import { WebSocketTransport } from '@colyseus/ws-transport';
import { defineRoom, defineServer } from 'colyseus';
import { HALL_ROOM } from '@connecta/shared';
import { env } from './env.js';
import { HallRoom, live } from './HallRoom.js';
import { db } from './services.js';

// One process, one room per hall · a restart means nobody is connected: close sessions left open by a crash (ghosts)
await db.presenceSession.updateMany({ where: { leftAt: null }, data: { leftAt: new Date() } });
await db.boothVisit.updateMany({ where: { leftAt: null }, data: { leftAt: new Date() } });

const server = defineServer({
  // explicit: the default transport is loaded with a dynamic require that breaks under ESM
  transport: new WebSocketTransport({ pingInterval: 5000, pingMaxRetries: 2 }),
  rooms: {
    // joinOrCreate(HALL_ROOM, { eventId, ticket }) only matches the room of that event
    [HALL_ROOM]: defineRoom(HallRoom).filterBy(['eventId']),
  },
});

await server.listen(env.REALTIME_PORT);
console.log(`realtime listening on :${env.REALTIME_PORT}`);

if (process.env.STATS) setInterval(() => console.log(`[stats] rooms ${live.rooms} · clients ${live.clients} · rss ${Math.round(process.memoryUsage().rss / 1048576)} MB`), 5000);
