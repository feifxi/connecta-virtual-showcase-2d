import type { BoothSlot, Event, EventCategory, Prisma, Project, User } from '@connecta/db';
import type { Category, EventCard, Person, ProjectCard, ZoneColor } from '@connecta/shared';
import type { Storage } from '../infra/storage.js';

export const iso = (d: Date) => d.toISOString();
export const isoOrNull = (d: Date | null | undefined) => (d ? d.toISOString() : null);

type PersonRow = Pick<User, 'id' | 'displayName' | 'name' | 'avatarPreset' | 'organization' | 'position' | 'deletedAt'>;
export const personSelect = { id: true, displayName: true, name: true, avatarPreset: true, organization: true, position: true, deletedAt: true } as const;

/** Deleted accounts stay referenced (scores, feedback) but show as "Deleted user" (docs/data-model.md → Lifecycle) */
export function toPerson(u: PersonRow): Person {
  if (u.deletedAt) return { userId: u.id, displayName: 'Deleted user', avatarPreset: null, organization: null, position: null };
  return { userId: u.id, displayName: u.displayName || u.name || 'Guest', avatarPreset: u.avatarPreset, organization: u.organization, position: u.position };
}

export function toCategory(c: EventCategory & { _count?: { projects: number } }): Category {
  return { id: c.id, name: c.name, color: c.color as ZoneColor, sort: c.sort, projectCount: c._count?.projects ?? 0 };
}

export const eventCardInclude = {
  createdBy: { select: { displayName: true, name: true, organization: true } },
  _count: { select: { projects: true, interests: true } },
} satisfies Prisma.EventInclude;
type EventCardRow = Event & Prisma.EventGetPayload<{ include: typeof eventCardInclude }>;

export async function toEventCard(e: EventCardRow, storage: Storage): Promise<EventCard> {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    coverUrl: e.coverKey ? await storage.signedUrl(e.coverKey) : null,
    status: e.status,
    startsAt: iso(e.startsAt),
    endsAt: iso(e.endsAt),
    exhibitionUntil: isoOrNull(e.exhibitionUntil),
    allowedDomain: e.allowedDomain,
    hostName: e.createdBy.organization || e.createdBy.displayName || e.createdBy.name,
    boothCount: e._count.projects,
    interestedCount: e._count.interests,
  };
}

export const projectCardInclude = {
  category: true,
  boothSlot: { select: { label: true } },
  members: { include: { user: { select: personSelect } } },
} satisfies Prisma.ProjectInclude;
type ProjectCardRow = Project & { category: EventCategory | null; boothSlot: Pick<BoothSlot, 'label'> | null; members: { user: PersonRow }[] };

export async function toProjectCard(p: ProjectCardRow, storage: Storage): Promise<ProjectCard> {
  return {
    id: p.id,
    eventId: p.eventId,
    title: p.title,
    summary: p.summary,
    tags: p.tags,
    coverUrl: p.coverKey ? await storage.signedUrl(p.coverKey) : null,
    category: p.category ? { id: p.category.id, name: p.category.name, color: p.category.color as ZoneColor } : null,
    boothSlotId: p.boothSlotId,
    boothLabel: p.boothSlot?.label ?? null,
    members: p.members.map((m) => toPerson(m.user)),
  };
}

/** Offset cursor · enough for event-sized lists (hundreds of rows) */
export function paginate<T>(rows: T[], limit: number, offset: number) {
  const hasMore = rows.length > limit;
  return { data: rows.slice(0, limit), nextCursor: hasMore ? String(offset + limit) : null };
}
export const cursorOffset = (cursor?: string) => Math.max(0, Number.parseInt(cursor ?? '0', 10) || 0);

/** k***@kmutt.ac.th */
export function maskEmail(email: string) {
  const [name = '', domain = ''] = email.split('@');
  return `${name.slice(0, 1)}***@${domain}`;
}
