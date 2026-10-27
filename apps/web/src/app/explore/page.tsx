import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/site-header';
import { PageTitle } from '@/components/brand/bits';
import { ExploreList } from '@/features/events/explore-list';

export const metadata: Metadata = { title: 'Explore events' };

export default function ExplorePage() {
  return (
    <>
      <SiteHeader active="Events" />
      <main id="main" className="container-page animate-page-in pb-24 pt-9">
        <PageTitle title="Explore events" text="Every event on Connecta. A lock badge means only one university’s accounts can join as visitors." />
        <ExploreList />
      </main>
    </>
  );
}
