import { BarChart3, LayoutGrid, Monitor, Settings, Shield, Trophy, Users } from 'lucide-react';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { WorkspaceShell } from '@/components/layout/workspace';
import { LivePill, Pill } from '@/components/ui/pill';
import { getEventBySlug } from '@/lib/api/server-data';
import { formatDay, formatTime } from '@/lib/format';
import { requireUser } from '@/lib/session';

/** Admin dashboard · every page under /manage/[slug] is Admin-only (checked again by the api) */
export default async function ManageLayout({ params, children }: LayoutProps<'/manage/[slug]'>) {
  const { slug } = await params;
  await requireUser(`/manage/${slug}`);
  const event = await getEventBySlug(slug);
  if (!event.myRoles.includes('ADMIN')) redirect(`/e/${slug}` as Route);
  const base = `/manage/${slug}`;
  return (
    <>
      <SiteHeader active="Host an event" />
      <WorkspaceShell
        caption="Your showcase"
        links={[
          { label: 'Overview', href: base, icon: <LayoutGrid />, exact: true },
          { label: 'Projects & hall', href: `${base}/projects`, icon: <Monitor /> },
          { label: 'People & roles', href: `${base}/people`, icon: <Users /> },
          ...(event.modules.judging ? [{ label: 'Judging', href: `${base}/judging`, icon: <Trophy /> }] : []),
          { label: 'Event report', href: `${base}/analytics`, icon: <BarChart3 /> },
          { label: 'Moderation', href: `${base}/moderation`, icon: <Shield /> },
          { label: 'Settings', href: `${base}/settings`, icon: <Settings /> },
        ]}
        aside={
          <>
            {event.status === 'LIVE' ? <LivePill>Event is live</LivePill> : <Pill tone="light">{event.status.toLowerCase()}</Pill>}
            <p className="mt-2 text-xs leading-[1.6]">
              <strong className="font-semibold text-ink">{event.title}</strong>
              <br />
              {formatDay(event.startsAt)}, {formatTime(event.startsAt)}
              <br />
              Ends by itself at {formatTime(event.endsAt)}
            </p>
          </>
        }
      >
        {children}
      </WorkspaceShell>
    </>
  );
}
