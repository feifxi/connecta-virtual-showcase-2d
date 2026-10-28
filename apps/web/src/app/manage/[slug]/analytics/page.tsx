import type { Metadata } from 'next';
import { AdminHeader } from '@/features/manage/admin-header';
import { Report } from '@/features/manage/report';
import { getEventBySlug } from '@/lib/api/server-data';

export const metadata: Metadata = { title: 'Event report' };

export default async function Page({ params }: PageProps<'/manage/[slug]/analytics'>) {
  const event = await getEventBySlug((await params).slug);
  return (
    <>
      <AdminHeader event={event} title="Event report" text="Who came, where they went, and what they thought." />
      <Report event={event} />
    </>
  );
}
