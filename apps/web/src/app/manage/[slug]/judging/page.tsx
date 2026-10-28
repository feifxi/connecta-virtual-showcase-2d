import type { Metadata } from 'next';
import { AdminHeader } from '@/features/manage/admin-header';
import { JudgingAdmin } from '@/features/manage/judging-admin';
import { getEventBySlug } from '@/lib/api/server-data';

export const metadata: Metadata = { title: 'Judging' };

export default async function Page({ params }: PageProps<'/manage/[slug]/judging'>) {
  const event = await getEventBySlug((await params).slug);
  return (
    <>
      <AdminHeader event={event} title="Judging" />
      <JudgingAdmin event={event} />
    </>
  );
}
