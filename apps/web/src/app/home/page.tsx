import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageTitle } from '@/components/brand/bits';
import { SiteHeader } from '@/components/layout/site-header';
import { Button } from '@/components/ui/button';
import { MyEvents } from '@/features/account/my-events';
import { getMe } from '@/lib/api/server-data';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'My events' };

export default async function HomePage() {
  await requireUser('/home');
  const me = await getMe();
  return (
    <>
      <SiteHeader active="My events" />
      <main id="main" className="container-page animate-page-in pb-24 pt-9">
        <PageTitle
          title={`Hi ${me.displayName}, here are your events.`}
          text="Everything you run, present at, judge or are interested in."
          actions={
            <Button asChild>
              <Link href="/manage/new">
                <Plus /> Create event
              </Link>
            </Button>
          }
        />
        <MyEvents />
      </main>
    </>
  );
}
