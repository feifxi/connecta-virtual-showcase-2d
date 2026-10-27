import type { Metadata, Route } from 'next';
import { redirect } from 'next/navigation';
import { EventWorkspace } from '@/components/layout/event-workspace';
import { JudgeList } from '@/features/judging/judge-list';
import { getEventBySlug } from '@/lib/api/server-data';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Judging list' };

export default async function JudgePage({ params }: PageProps<'/e/[slug]/judge'>) {
  const { slug } = await params;
  await requireUser(`/e/${slug}/judge`);
  const event = await getEventBySlug(slug);
  if (!event.myRoles.includes('JUDGE') || !event.modules.judging) redirect(`/e/${slug}` as Route);
  return (
    <EventWorkspace event={event}>
      <JudgeList event={event} />
    </EventWorkspace>
  );
}
