// Boots the real api against the dev database (npm run infra:up first) with a fake token verifier:
// `Bearer user:<id>` signs in as that user. Every test builds its own event and cleans up after.
import '../src/load-env.js';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createPrisma } from '@connecta/db';
import { AppModule } from '../src/app.module.js';
import { TokenVerifier, type AuthUser } from '../src/common/auth/auth.guard.js';

export const db = createPrisma(process.env.DATABASE_URL, 3);
let app: INestApplication;
const created = { users: [] as string[], events: [] as string[] };

export async function boot() {
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenVerifier)
    .useValue({ verify: async (t: string): Promise<AuthUser | null> => (t.startsWith('user:') ? { id: t.slice(5), appRole: 'USER' } : null) })
    .compile();
  app = mod.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  await app.init();
}

export async function shutdown() {
  if (created.events.length) await db.event.deleteMany({ where: { id: { in: created.events } } });
  if (created.users.length) await db.user.deleteMany({ where: { id: { in: created.users } } });
  await app?.close();
  await db.$disconnect();
}

export async function user(email = `t-${crypto.randomUUID().slice(0, 8)}@test.local`) {
  const u = await db.user.create({ data: { email, name: 'Tester', displayName: email.split('@')[0], avatarPreset: 1, visitorType: 'STUDENT', province: 'Bangkok', onboardedAt: new Date(), emailVerified: true } });
  created.users.push(u.id);
  return u;
}

/** Signed-in request helper */
export const as = (userId?: string) => {
  const r = request(app.getHttpServer());
  const auth = (t: request.Test) => (userId ? t.set('Authorization', `Bearer user:${userId}`) : t);
  return {
    get: (p: string) => auth(r.get(`/api/v1${p}`)),
    post: (p: string, body?: object) => auth(r.post(`/api/v1${p}`)).send(body),
    put: (p: string, body?: object) => auth(r.put(`/api/v1${p}`)).send(body),
    patch: (p: string, body?: object) => auth(r.patch(`/api/v1${p}`)).send(body),
    delete: (p: string) => auth(r.delete(`/api/v1${p}`)),
  };
};

/** An event created through the api (Draft, hall from preset, creator = Admin) */
export async function event(adminId: string, extra: Record<string, unknown> = {}) {
  const start = new Date(Date.now() - 60_000);
  const res = await as(adminId).post('/events', { title: 'Test showcase', startsAt: start.toISOString(), endsAt: new Date(Date.now() + 3_600_000).toISOString(), capacity: 50, preset: 'room', categories: [], ...extra });
  if (res.status !== 201) throw new Error(`create event: ${res.status} ${JSON.stringify(res.body)}`);
  created.events.push(res.body.id);
  return res.body.id as string;
}

export async function attend(eventId: string, userId: string) {
  await db.eventAttendee.create({ data: { eventId, userId, displayName: 'Tester', visitorType: 'STUDENT', province: 'Bangkok' } });
}
