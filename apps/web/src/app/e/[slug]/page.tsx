import { Calendar, ChevronRight, Clock, Globe, Heart, LayoutGrid, Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AvatarStack } from '@/components/brand/avatar';
import { SectionHeading } from '@/components/brand/bits';
import { SiteHeader } from '@/components/layout/site-header';
import { Surface } from '@/components/ui/surface';
import { AccessBadge, StatusBadge } from '@/features/events/event-card';
import { EventCta } from '@/features/events/event-cta';
import { ProjectBrowser } from '@/features/projects/project-browser';
import { serverApi } from '@/lib/api/server';
import { getEventBySlug } from '@/lib/api/server-data';
import { formatDate, formatDay, formatTime, plural } from '@/lib/format';
import { getSession } from '@/lib/session';

export async function generateMetadata({ params }: PageProps<'/e/[slug]'>): Promise<Metadata> {
  const e = await getEventBySlug((await params).slug);
  return { title: e.title, description: e.description.slice(0, 160), openGraph: { title: e.title, description: e.description.slice(0, 160), images: e.coverUrl ? [e.coverUrl] : undefined } };
}

/** Public event page · no login needed to look (docs/features.md → Auth → ใครเห็น) */
export default async function EventPage({ params }: PageProps<'/e/[slug]'>) {
  const { slug } = await params;
  const [event, session] = await Promise.all([getEventBySlug(slug), getSession()]);
  const awards = event.resultsAnnouncedAt ? ((await serverApi().GET('/api/v1/events/{eventId}/awards', { params: { path: { eventId: event.id } } })).data ?? []) : [];
  const zones = event.categories.length;
  const meta = [
    { icon: <Calendar />, text: formatDate(event.startsAt) },
    { icon: <Clock />, text: `${formatTime(event.startsAt)}–${formatTime(event.endsAt)} ICT · ends by itself at ${formatTime(event.endsAt)}` },
    { icon: <LayoutGrid />, text: `${plural(event.boothCount, 'booth')}${zones ? ` in ${plural(zones, 'zone')}` : ''}` },
    { icon: <Globe />, text: event.allowedDomain ? `Online · visitors log in with @${event.allowedDomain}` : 'Online · open to everyone with an account' },
  ];
  const attending = event.status === 'LIVE' || event.status === 'EXHIBITION';

  return (
    <>
      <SiteHeader active="Events" />
      <main id="main" className="container-page animate-page-in pb-24 pt-9">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2.5 text-sm text-muted">
          <Link href="/explore" className="hover:text-blue">
            Events
          </Link>
          <ChevronRight className="size-4" />
          <span className="truncate">{event.title}</span>
        </nav>
        <section className="mb-8 grid overflow-hidden rounded-[24px] border border-border bg-white lg:grid-cols-[1.65fr_1fr]">
          <div className="px-6 py-8 sm:px-9">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={event.status} />
              {event.status === 'EXHIBITION' && event.exhibitionUntil && <span className="self-center text-sm text-muted">open until {formatDay(event.exhibitionUntil)}</span>}
              <AccessBadge domain={event.allowedDomain} />
            </div>
            <h1 className="mb-3.5 mt-[18px] max-w-[590px] text-[clamp(2rem,4vw,2.6rem)]">{event.title}</h1>
            <p className="max-w-[530px] whitespace-pre-line text-md">{event.description}</p>
            <div className="mt-6 flex items-center gap-3">
              <AvatarStack avatars={[8, 9, 12, 4]} extra={Math.max(0, event.interestedCount - 4)} />
              <span className="text-sm text-muted">{plural(event.interestedCount, 'person', 'people')} interested · by {event.hostName}</span>
            </div>
          </div>
          <div className="flex flex-col gap-3.5 border-t border-border bg-blue-wash px-6 py-8 sm:px-8 lg:border-l lg:border-t-0">
            {meta.map((m) => (
              <div key={m.text} className="flex items-center gap-[11px] text-sm [&_svg]:size-[17px] [&_svg]:shrink-0 [&_svg]:text-blue">
                {m.icon}
                {m.text}
              </div>
            ))}
            <div className="mt-2 flex flex-col gap-3">
              <EventCta event={event} signedIn={!!session} />
            </div>
          </div>
        </section>

        {awards.length > 0 && (
          <div className="mb-8 grid gap-5 md:grid-cols-2">
            {(['JUDGES', 'AUDIENCE'] as const).map((kind) => {
              const list = awards.filter((a) => a.kind === kind);
              if (!list.length) return null;
              return (
                <Surface key={kind} className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-base [&_svg]:size-5 [&_svg]:text-orange">
                    {kind === 'JUDGES' ? <Trophy /> : <Heart />}
                    {kind === 'JUDGES' ? "Judges' award" : 'Audience award · Popular Vote'}
                  </h3>
                  <ol className="flex flex-col gap-3">
                    {list.map((a) => (
                      <li key={a.rank} className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-orange-tint text-sm font-extrabold text-live-ink">{a.rank}</span>
                        <span>
                          <strong className="block text-md">{a.project.title}</strong>
                          {a.project.boothLabel && <small className="text-xs text-muted">Booth {a.project.boothLabel}</small>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </Surface>
              );
            })}
          </div>
        )}

        <SectionHeading title="Projects" text="Browse before you go in." aside={<span className="text-sm text-muted">{plural(event.boothCount, 'project')}</span>} />
        <ProjectBrowser eventId={event.id} categories={event.categories} enterHref={attending && session ? `/e/${event.slug}/${event.attended ? 'hall' : 'join'}` : undefined} />

        {event.agenda.length > 0 && (
          <section className="mt-11 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div>
              <h2 className="mb-1.5">Agenda</h2>
              <p className="text-md">Booths are open all day. Walk in whenever you like.</p>
            </div>
            <ol className="grid gap-2.5">
              {event.agenda.map((a) => (
                <li key={`${a.time}-${a.title}`} className="flex items-baseline gap-6 rounded-[14px] border border-border bg-white px-5 py-[15px] text-md">
                  <time className="min-w-12 font-bold tabular-nums text-ink">{a.time}</time>
                  <span>{a.title}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </>
  );
}
