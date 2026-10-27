import type { EventCard as EventCardData, EventRole } from '@connecta/shared';
import { ArrowRight, LayoutGrid, Lock } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { RoleChip } from '@/components/brand/bits';
import { LivePill, Pill } from '@/components/ui/pill';
import { formatRange, plural } from '@/lib/format';
import { EventArt } from './event-art';

export function StatusBadge({ status }: { status: EventCardData['status'] }) {
  if (status === 'LIVE') return <LivePill />;
  if (status === 'PUBLISHED') return <Pill tone="light">Upcoming</Pill>;
  if (status === 'EXHIBITION') return <Pill tone="green">Exhibition</Pill>;
  if (status === 'DRAFT') return <Pill tone="light">Draft</Pill>;
  return <Pill tone="light">Closed</Pill>;
}

export function AccessBadge({ domain }: { domain: string | null }) {
  return domain ? (
    <Pill tone="lavender">
      <Lock className="size-3.5" aria-hidden />@{domain} only
    </Pill>
  ) : (
    <Pill tone="green">Open to everyone</Pill>
  );
}

const CTA: Record<EventCardData['status'], string> = { DRAFT: 'Set up', PUBLISHED: 'Interested', LIVE: 'Join', EXHIBITION: 'Visit', ARCHIVED: 'View' };

export function EventCard({ event, roles, href }: { event: EventCardData; roles?: EventRole[]; href?: string }) {
  const to = (href ?? `/e/${event.slug}`) as Route;
  return (
    <article className="overflow-hidden rounded-card border border-border bg-white transition-[transform,box-shadow] duration-200 ease-out-soft hover:-translate-y-1 hover:shadow-card">
      <Link href={to} className="relative block h-[172px] overflow-hidden" aria-label={`Open ${event.title}`}>
        <EventArt id={event.id} title={event.title} coverUrl={event.coverUrl} host={event.hostName} />
        <span className="absolute left-3 top-3">
          <StatusBadge status={event.status} />
        </span>
      </Link>
      <div className="px-[23px] py-[21px]">
        <span className="text-sm text-muted">{formatRange(event.startsAt, event.endsAt)}</span>
        <h3 className="my-[7px] text-base">{event.title}</h3>
        <p className="text-sm">{event.hostName}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {roles?.map((r) => <RoleChip key={r} role={r} />)}
          <AccessBadge domain={event.allowedDomain} />
        </div>
        <div className="mt-[22px] flex items-center justify-between border-t border-border pt-3.5 text-sm text-muted">
          <span className="flex items-center gap-1.5">
            <LayoutGrid className="size-3.5" />
            {plural(event.boothCount, 'booth')}
          </span>
          <Link href={to} className="inline-flex items-center gap-2 font-bold text-blue hover:text-blue-hover">
            {CTA[event.status]} <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
