import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/site-header';
import { CreateEvent } from '@/features/manage/create-event';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Create an event' };

export default async function NewEventPage() {
  await requireUser('/manage/new');
  return (
    <>
      <SiteHeader active="Host an event" />
      <main id="main" className="container-page animate-page-in pb-24 pt-9">
        <CreateEvent />
      </main>
    </>
  );
}
