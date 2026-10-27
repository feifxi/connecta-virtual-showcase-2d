import { PLAN_LIMITS } from '@connecta/shared';
import type { Event } from '@connecta/db';
import type { Db } from '../infra/db.js';

/** Plan limits are enforced here, server-side (docs/features.md → Plan) */
export async function planLimits(db: Db, event: Pick<Event, 'id' | 'plan'>) {
  const base = PLAN_LIMITS[event.plan];
  const addons = await db.eventAddon.aggregate({ where: { eventId: event.id }, _sum: { extraCapacity: true, extraExhibitionDays: true } });
  return {
    ...base,
    capacity: base.capacity + (addons._sum.extraCapacity ?? 0),
    exhibitionDays: base.exhibitionDays + (addons._sum.extraExhibitionDays ?? 0),
  };
}

/** Seats held for invited people (pending + accepted) · Visitors get capacity − reserved */
export function reservedSeats(db: Db, eventId: string) {
  return db.eventInvite.count({ where: { eventId, OR: [{ status: 'ACCEPTED' }, { status: 'PENDING', expiresAt: { gt: new Date() } }] } });
}

export async function judgeCount(db: Db, eventId: string) {
  const [members, invites] = await Promise.all([
    db.eventMember.count({ where: { eventId, roles: { has: 'JUDGE' } } }),
    db.eventInvite.count({ where: { eventId, status: 'PENDING', roles: { has: 'JUDGE' }, expiresAt: { gt: new Date() } } }),
  ]);
  return members + invites;
}
