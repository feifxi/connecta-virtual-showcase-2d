import { Injectable } from '@nestjs/common';
import type { Me, MyEvent, UpdateMeInput } from '@connecta/shared';
import type { AuthUser } from '../../common/auth/auth.guard.js';
import { eventCardInclude, iso, isoOrNull, toEventCard } from '../../common/mappers.js';
import { AppError } from '../../common/problem.js';
import { Db } from '../../infra/db.js';
import { Storage } from '../../infra/storage.js';

const REQUIRED = ['displayName', 'avatarPreset', 'visitorType', 'province'] as const;

@Injectable()
export class MeService {
  constructor(
    private readonly db: Db,
    private readonly storage: Storage,
  ) {}

  private async user(id: string) {
    const u = await this.db.user.findUnique({ where: { id } });
    if (!u || u.deletedAt) throw new AppError('UNAUTHENTICATED');
    return u;
  }

  async get(auth: AuthUser): Promise<Me> {
    const u = await this.user(auth.id);
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName || u.name,
      avatarPreset: u.avatarPreset,
      visitorType: u.visitorType,
      province: u.province,
      organization: u.organization,
      position: u.position,
      appRole: u.appRole,
      needsOnboarding: !u.onboardedAt,
    };
  }

  /** Profile edit and onboarding share this · all required fields present → onboarded */
  async update(auth: AuthUser, input: UpdateMeInput) {
    const u = await this.user(auth.id);
    const next = { ...u, ...input };
    const complete = REQUIRED.every((k) => next[k] !== null && next[k] !== undefined && next[k] !== '');
    await this.db.user.update({ where: { id: u.id }, data: { ...input, ...(complete && !u.onboardedAt && { onboardedAt: new Date() }) } });
    return this.get(auth);
  }

  /** Refused while this account is the only Admin of an event (docs/features.md → กฎร่วม) */
  async delete(auth: AuthUser) {
    const adminOf = await this.db.eventMember.findMany({ where: { userId: auth.id, roles: { has: 'ADMIN' } }, select: { eventId: true, event: { select: { title: true } } } });
    const blocking: string[] = [];
    for (const m of adminOf) {
      const admins = await this.db.eventMember.count({ where: { eventId: m.eventId, roles: { has: 'ADMIN' } } });
      if (admins === 1) blocking.push(m.event.title);
    }
    if (blocking.length) throw new AppError('LAST_ADMIN', `You're the only Admin of: ${blocking.join(', ')}`, { events: blocking });
    // keep the row (scores, feedback stay) but wipe personal data and sign out everywhere
    await this.db.$transaction([
      this.db.session.deleteMany({ where: { userId: auth.id } }),
      this.db.account.deleteMany({ where: { userId: auth.id } }),
      this.db.userEmail.deleteMany({ where: { userId: auth.id } }),
      this.db.eventMember.deleteMany({ where: { userId: auth.id } }),
      this.db.user.update({
        where: { id: auth.id },
        data: { deletedAt: new Date(), email: `deleted-${auth.id}@deleted.invalid`, name: 'Deleted user', displayName: null, organization: null, position: null, image: null, province: null },
      }),
    ]);
  }

  /** Home: events where I hold a role, attended, or marked Interested */
  async events(auth: AuthUser, role?: string): Promise<MyEvent[]> {
    const [members, attended, interests] = await Promise.all([
      this.db.eventMember.findMany({ where: { userId: auth.id }, select: { eventId: true, roles: true } }),
      this.db.eventAttendee.findMany({ where: { userId: auth.id }, select: { eventId: true } }),
      this.db.eventInterest.findMany({ where: { userId: auth.id }, select: { eventId: true } }),
    ]);
    const roles = new Map(members.map((m) => [m.eventId, m.roles]));
    const attendedSet = new Set(attended.map((a) => a.eventId));
    const interestedSet = new Set(interests.map((i) => i.eventId));
    let ids = [...new Set([...roles.keys(), ...attendedSet, ...interestedSet])];
    if (role === 'VISITOR') ids = ids.filter((id) => !roles.get(id)?.length);
    else if (role) ids = ids.filter((id) => roles.get(id)?.includes(role as 'ADMIN'));
    const events = await this.db.event.findMany({ where: { id: { in: ids }, suspendedAt: null }, include: eventCardInclude, orderBy: { startsAt: 'desc' } });
    return Promise.all(
      events
        // Draft events are visible to their Admins only
        .filter((e) => e.status !== 'DRAFT' || roles.get(e.id)?.includes('ADMIN'))
        .map(async (e) => ({ ...(await toEventCard(e, this.storage)), myRoles: roles.get(e.id) ?? [], attended: attendedSet.has(e.id), interested: interestedSet.has(e.id) })),
    );
  }

  async notifications(auth: AuthUser, unread: boolean) {
    const rows = await this.db.notification.findMany({ where: { userId: auth.id, ...(unread && { readAt: null }) }, orderBy: { createdAt: 'desc' }, take: 50 });
    return rows.map((n) => ({ id: n.id, kind: n.kind, payload: (n.payload ?? {}) as Record<string, unknown>, readAt: isoOrNull(n.readAt), createdAt: iso(n.createdAt) }));
  }

  async readNotification(auth: AuthUser, id: string) {
    const { count } = await this.db.notification.updateMany({ where: { id, userId: auth.id }, data: { readAt: new Date() } });
    if (!count) throw new AppError('NOT_FOUND');
  }
}
