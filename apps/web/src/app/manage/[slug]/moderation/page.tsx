import type { Metadata } from 'next';
import { AdminHeader } from '@/features/manage/admin-header';
import { Moderation } from '@/features/manage/moderation';
import { getEventBySlug } from '@/lib/api/server-data';

export const metadata: Metadata = { title: 'Moderation' };

export default async function Page({ params }: PageProps<'/manage/[slug]/moderation'>) {
  const event = await getEventBySlug((await params).slug);
  return (
    <>
      <AdminHeader event={event} title="Moderation" />
      <Moderation initial={event} />
    </>
  );
}
