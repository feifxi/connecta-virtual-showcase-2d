import type { EventDetail } from '@connecta/shared';
import { CalendarDays, LayoutDashboard, Map as MapIcon, Monitor, Trophy } from 'lucide-react';
import { LivePill, Pill } from '@/components/ui/pill';
import { formatDay, formatTime } from '@/lib/format';
import { SiteHeader } from './site-header';
import { WorkspaceShell, type WorkspaceLink } from './workspace';

/** Presenter / Judge workspace: links follow the roles you hold in this event */
export function EventWorkspace({ event, children }: { event: EventDetail; children: React.ReactNode }) {
  const base = `/e/${event.slug}`;
  const links: WorkspaceLink[] = [
    ...(event.myRoles.includes('PRESENTER') ? [{ label: 'My booth', href: `${base}/my-booth`, icon: <Monitor /> }] : []),
    ...(event.myRoles.includes('JUDGE') && event.modules.judging ? [{ label: 'Judging list', href: `${base}/judge`, icon: <Trophy /> }] : []),
    ...(event.status === 'LIVE' || event.status === 'EXHIBITION' ? [{ label: 'Enter the hall', href: `${base}/hall`, icon: <MapIcon /> }] : []),
    { label: 'Event page', href: base, icon: <CalendarDays />, exact: true },
    ...(event.myRoles.includes('ADMIN') ? [{ label: 'Dashboard', href: `/manage/${event.slug}`, icon: <LayoutDashboard /> }] : []),
  ];
  return (
    <>
      <SiteHeader active="My events" />
      <WorkspaceShell
        caption={event.title}
        links={links}
        aside={
          <>
            {event.status === 'LIVE' ? <LivePill>Event is live</LivePill> : <Pill tone="light">{event.status === 'PUBLISHED' ? 'Upcoming' : event.status.toLowerCase()}</Pill>}
            <p className="mt-2 text-xs leading-[1.6]">
              <strong className="font-semibold text-ink">{event.title}</strong>
              <br />
              {formatDay(event.startsAt)}, {formatTime(event.startsAt)}–{formatTime(event.endsAt)}
            </p>
          </>
        }
      >
        {children}
      </WorkspaceShell>
    </>
  );
}
