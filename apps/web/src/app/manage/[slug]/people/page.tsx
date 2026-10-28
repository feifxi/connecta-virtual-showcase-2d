import type { Metadata } from 'next';
import { AdminHeader } from '@/features/manage/admin-header';
import { PeopleManager } from '@/features/manage/people-manager';
import { getEventBySlug } from '@/lib/api/server-data';

export const metadata: Metadata = { title: 'People & roles' };

export default async function Page({ params }: PageProps<'/manage/[slug]/people'>) {
  const event = await getEventBySlug((await params).slug);
  return (
    <>
      <AdminHeader event={event} title="People & roles" />
      <PeopleManager event={event} />
    </>
  );
}
