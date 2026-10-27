import type { Metadata } from 'next';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { PageTitle } from '@/components/brand/bits';
import { SiteHeader } from '@/components/layout/site-header';
import { ProfileForm } from '@/features/account/profile-form';
import { getMe } from '@/lib/api/server-data';
import { safeNext } from '@/lib/safe-next';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Set up your profile' };

export default async function OnboardingPage({ searchParams }: PageProps<'/onboarding'>) {
  const next = safeNext((await searchParams).next);
  await requireUser('/onboarding', { allowNotOnboarded: true });
  const me = await getMe();
  if (!me.needsOnboarding) redirect(next as Route);
  return (
    <>
      <SiteHeader />
      <main id="main" className="container-page max-w-[1040px] animate-page-in pb-24 pt-9">
        <PageTitle title="Set up your profile" text="One-time setup, about 30 seconds. Every event you join uses it." />
        <ProfileForm me={me} next={next} submitLabel="Continue" />
      </main>
    </>
  );
}
