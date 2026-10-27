import type { Metadata } from 'next';
import { PageTitle } from '@/components/brand/bits';
import { SiteHeader } from '@/components/layout/site-header';
import { DeleteAccount } from '@/features/account/delete-account';
import { ProfileForm } from '@/features/account/profile-form';
import { getMe } from '@/lib/api/server-data';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Profile' };

export default async function ProfilePage() {
  await requireUser('/profile');
  const me = await getMe();
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page max-w-[1040px] animate-page-in pb-24 pt-9">
        <PageTitle title="Your profile" text={`Signed in as ${me.email}. One profile for every event.`} />
        <ProfileForm me={me} submitLabel="Save profile" />
        <DeleteAccount />
      </main>
    </>
  );
}
