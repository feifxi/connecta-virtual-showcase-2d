import type { Metadata, Route } from 'next';
import { redirect } from 'next/navigation';
import { HallView } from '@/features/hall/hall-view';
import { getEventBySlug, getMe } from '@/lib/api/server-data';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Hall' };

/** Full-screen hall · the gate (capacity, domain, ban) runs when the client asks for a hall ticket */
export default async function HallPage({ params }: PageProps<'/e/[slug]/hall'>) {
  const { slug } = await params;
  await requireUser(`/e/${slug}/hall`);
  const event = await getEventBySlug(slug);
  if (event.status !== 'LIVE' && event.status !== 'EXHIBITION') redirect(`/e/${slug}` as Route);
  if (!event.attended) redirect(`/e/${slug}/join` as Route);
  const me = await getMe();
  return <HallView event={event} avatar={me.avatarPreset ?? 0} />;
}
