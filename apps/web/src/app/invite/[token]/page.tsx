import type { Metadata } from 'next';
import { SiteHeader } from '@/components/layout/site-header';
import { InviteCard } from '@/features/account/invite-card';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Invitation' };

export default async function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  const { token } = await params;
  const session = await requireUser(`/invite/${token}`);
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page max-w-[560px] animate-page-in pb-24 pt-9">
        <InviteCard token={token} signedInAs={session.user.email} />
      </main>
    </>
  );
}
