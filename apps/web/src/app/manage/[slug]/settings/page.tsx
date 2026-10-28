import type { Metadata } from 'next';
import { AdminHeader } from '@/features/manage/admin-header';
import { SettingsForm } from '@/features/manage/settings-form';
import { getEventBySlug } from '@/lib/api/server-data';

export const metadata: Metadata = { title: 'Settings' };

export default async function Page({ params }: PageProps<'/manage/[slug]/settings'>) {
  const event = await getEventBySlug((await params).slug);
  return (
    <>
      <AdminHeader event={event} title="Settings" />
      <SettingsForm initial={event} />
    </>
  );
}
