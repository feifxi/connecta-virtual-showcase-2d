import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/brand/bits';
import { EventWorkspace } from '@/components/layout/event-workspace';
import { BoothEditor } from '@/features/booth/booth-editor';
import { getEventBySlug } from '@/lib/api/server-data';
import { requireUser } from '@/lib/session';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'My booth' };

export default async function MyBoothPage({ params, searchParams }: PageProps<'/e/[slug]/my-booth'>) {
  const { slug } = await params;
  const { project } = await searchParams;
  await requireUser(`/e/${slug}/my-booth`);
  const event = await getEventBySlug(slug);
  if (!event.myRoles.includes('PRESENTER')) redirect(`/e/${slug}` as Route);
  const selected = (typeof project === 'string' && event.myProjectIds.includes(project) ? project : event.myProjectIds[0]) ?? null;
  return (
    <EventWorkspace event={event}>
      {event.myProjectIds.length > 1 && (
        <nav className="mb-6 flex flex-wrap gap-2" aria-label="Your booths">
          {event.myProjectIds.map((id, i) => (
            <Link key={id} href={`/e/${slug}/my-booth?project=${id}` as Route} className={cn('rounded-full border border-border px-4 py-2 text-sm font-semibold', id === selected && 'border-ink bg-ink text-white')}>
              Booth {i + 1}
            </Link>
          ))}
        </nav>
      )}
      {selected ? <BoothEditor key={selected} event={event} projectId={selected} /> : <EmptyState title="No booth yet" text="Ask the organizer to add you to a project." />}
    </EventWorkspace>
  );
}
