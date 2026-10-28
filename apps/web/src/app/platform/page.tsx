import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageTitle } from '@/components/brand/bits';
import { SiteHeader } from '@/components/layout/site-header';
import { PlatformConsole } from '@/features/manage/platform-console';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Platform console' };

export default async function PlatformPage() {
  const session = await requireUser('/platform');
  if ((session.user as { appRole?: string }).appRole !== 'PLATFORM_ADMIN') notFound();
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page animate-page-in pb-24 pt-9">
        <PageTitle title="Platform console" text="Every event on Connecta. Suspend what breaks the rules; upgrade plans for testing." />
        <PlatformConsole />
      </main>
    </>
  );
}
