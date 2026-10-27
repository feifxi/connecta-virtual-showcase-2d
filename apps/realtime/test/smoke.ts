// Manual end-to-end check of the hall room (needs: infra up, seeded DB, realtime running)
import { Client } from '@colyseus/sdk';
import { SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { createPrisma } from '@connecta/db';
import '../src/env.js';

const db = createPrisma();
const key = new TextEncoder().encode(process.env.HALL_TICKET_SECRET!);
const ev = await db.event.findUniqueOrThrow({ where: { slug: 'senior-design-2026' } });
const visitor = await db.user.findUniqueOrThrow({ where: { email: 'visitor@connecta.local' } });
const mika = await db.user.findUniqueOrThrow({ where: { email: 'mika@connecta.local' } });
for (const u of [visitor, mika])
  await db.eventAttendee.upsert({ where: { eventId_userId: { eventId: ev.id, userId: u.id } }, create: { eventId: ev.id, userId: u.id, displayName: u.displayName!, visitorType: 'STUDENT', province: 'Bangkok' }, update: {} });
const ticket = (sub: string, eventId = ev.id) => new SignJWT({ eventId }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setJti(randomUUID()).setAudience('connecta-realtime').setExpirationTime('60s').sign(key);

const client = new Client('http://localhost:2567');
const results: [string, boolean][] = [];
const t1 = await ticket(visitor.id);
const room = await client.joinOrCreate('hall', { eventId: ev.id, ticket: t1 });
await new Promise((r) => setTimeout(r, 500));
const st = room.state as any;
results.push(['joined + spawned', st.players.size === 1]);
results.push(['booths loaded from DB', st.booths.size === 10]);
await client.joinOrCreate('hall', { eventId: ev.id, ticket: t1 }).then(() => results.push(['reused ticket rejected', false]), () => results.push(['reused ticket rejected', true]));
await client.joinOrCreate('hall', { eventId: ev.id, ticket: 'forged' }).then(() => results.push(['forged ticket rejected', false]), () => results.push(['forged ticket rejected', true]));

const mikaProject = await db.projectMember.findFirstOrThrow({ where: { userId: mika.id } });
const presenter = await client.joinOrCreate('hall', { eventId: ev.id, ticket: await ticket(mika.id) });
presenter.send('goToBooth', { projectId: mikaProject.projectId });
room.send('goToBooth', { projectId: mikaProject.projectId });
await new Promise((r) => setTimeout(r, 800));
const booth = st.booths.get(mikaProject.projectId);
results.push(['both in booth (count 2)', booth.count === 2]);
results.push(['● Live when presenter inside', booth.live === true]);
const inBooth = await db.boothVisit.count({ where: { projectId: mikaProject.projectId, leftAt: null } });
results.push(['booth visits recorded', inBooth === 2]);
const got: string[] = [];
presenter.onMessage('chat', (m: any) => got.push(m.text));
room.onMessage('chat', () => {});
room.onMessage('chatHistory', () => {});
room.send('chat:nearby', { text: 'hello booth' });
await new Promise((r) => setTimeout(r, 300));
results.push(['nearby chat reaches the booth', got.includes('hello booth')]);
const me = [...st.players.values()].find((p: any) => p.userId === visitor.id);
room.send('move', { x: me.x + 400, y: me.y, dir: 'right' });
let corrected = false;
room.onMessage('correct', () => (corrected = true));
await new Promise((r) => setTimeout(r, 300));
results.push(['teleport move rejected', corrected]);
await presenter.leave();
await new Promise((r) => setTimeout(r, 500));
results.push(['Live off after presenter leaves', booth.live === false]);
await room.leave();
await new Promise((r) => setTimeout(r, 300));
results.push(['presence closed on leave', (await db.presenceSession.count({ where: { eventId: ev.id, leftAt: null } })) === 0]);
for (const [n, ok] of results) console.log(ok ? 'PASS' : 'FAIL', n);
await db.$disconnect();
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
