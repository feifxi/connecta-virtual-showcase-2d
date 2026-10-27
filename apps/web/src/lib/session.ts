import 'server-only';
import type { Route } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { auth } from './auth';

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Server-side gate for pages that need an account · onboarding is enforced once, then you go where you meant to */
export async function requireUser(next: string, { allowNotOnboarded = false } = {}) {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(next)}` as Route);
  const user = session.user as typeof session.user & { onboardedAt?: Date | null; deletedAt?: Date | null };
  if (!allowNotOnboarded && !user.onboardedAt) redirect(`/onboarding?next=${encodeURIComponent(next)}` as Route);
  return session;
}
