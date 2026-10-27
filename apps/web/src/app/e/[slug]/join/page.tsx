import { ChevronRight } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { JoinForm } from '@/features/attendance/join-form';
import { serverApi } from '@/lib/api/server';
import { getEventBySlug, getMe } from '@/lib/api/server-data';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Before you go in' };

export default async function JoinPage({ params }: PageProps<'/e/[slug]/join'>) {
  const { slug } = await params;
  await requireUser(`/e/${slug}/join`);
  const event = await getEventBySlug(slug);
  if (event.attended) redirect(`/e/${slug}/hall` as Route);
  const [me, form] = await Promise.all([getMe(), serverApi().GET('/api/v1/events/{eventId}/forms/{kind}', { params: { path: { eventId: event.id, kind: 'join' } } })]);
  return (
    <>
      <SiteHeader active="Events" />
      <main id="main" className="container-page max-w-[1040px] animate-page-in pb-24 pt-9">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2.5 text-sm text-muted">
          <Link href={`/e/${slug}` as Route} className="hover:text-blue">
            {event.title}
          </Link>
          <ChevronRight className="size-4" />
          <span>Before you go in</span>
        </nav>
        <JoinForm eventId={event.id} slug={slug} me={me} fields={form.data?.fields ?? []} />
      </main>
    </>
  );
}
