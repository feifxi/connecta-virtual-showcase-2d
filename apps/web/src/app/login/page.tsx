/* eslint-disable @next/next/no-img-element */
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Route } from 'next';
import { AvatarStack } from '@/components/brand/avatar';
import { Brand } from '@/components/brand/brand';
import { Pill } from '@/components/ui/pill';
import { LoginForm } from '@/features/auth/login-form';
import { env } from '@/lib/server/env';
import { getSession } from '@/lib/session';
import { safeNext } from '@/lib/safe-next';
import { withBase } from '@/lib/utils';

export const metadata: Metadata = { title: 'Log in' };

// Everyone logs in (no guests): Microsoft for university accounts · Google · email link as the fallback
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next as Route);
  return (
    <main id="main" className="grid min-h-dvh bg-white lg:grid-cols-2">
      <section className="relative hidden flex-col gap-[30px] bg-lavender px-12 py-9 lg:flex">
        <Brand />
        <div className="h-[min(43vh,390px)] overflow-hidden rounded-[20px]">
          <img src={withBase('/assets/images/lobby.png')} width={1104} height={1424} alt="Students and lecturers talking in a sunlit university lobby" className="size-full object-cover [object-position:50%_55%]" />
        </div>
        <div>
          <Pill tone="light">Your next connection starts here</Pill>
          <h2 className="mt-4 max-w-[420px] text-[1.85rem] leading-[1.35]">One account for every showcase you visit, present at or judge.</h2>
          <p className="mt-3.5 text-md text-[#685a86]">Roles come from invitations, not from sign-up.</p>
        </div>
        <div className="mt-auto flex items-center gap-3.5 pt-3 text-sm text-[#685a86]">
          <AvatarStack avatars={[8, 9, 12]} />
          <span>A little closer, wherever you are.</span>
        </div>
      </section>
      <section className="flex items-center justify-center px-4 pb-24 pt-12 sm:px-16">
        <div className="w-full max-w-[390px]">
          <Link href="/" className="mb-7 inline-flex items-center gap-2 text-md font-bold text-blue">
            <ArrowLeft className="size-4" /> Back to Connecta
          </Link>
          <h1 className="text-[2rem]">Log in to Connecta</h1>
          <p className="mb-6 mt-2 text-md">Everyone logs in — it keeps the hall safe and your votes and scores tied to you.</p>
          <LoginForm next={next} providers={{ microsoft: !!env.MICROSOFT_CLIENT_ID, google: !!env.GOOGLE_CLIENT_ID }} />
          <p className="mt-6 text-center text-sm">People in an event see your name, character, organization and position.</p>
        </div>
      </section>
    </main>
  );
}
