'use client';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Bell, CalendarPlus, CheckCircle2, Settings } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ERROR_MESSAGES, type EventDetail } from '@connecta/shared';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { formatTime } from '@/lib/format';
import { withBase } from '@/lib/utils';

const googleCalendar = (e: EventDetail) => {
  const f = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${f(e.startsAt)}/${f(e.endsAt)}`, details: `${location.origin}${withBase(`/e/${e.slug}`)}` });
  return `https://calendar.google.com/calendar/render?${p}`;
};

/** Main button by status: Interested (before · not a seat booking) · Join (live) · Visit (exhibition) */
export function EventCta({ event, signedIn }: { event: EventDetail; signedIn: boolean }) {
  const router = useRouter();
  const [interested, setInterested] = useState(event.interested);
  const toggle = useMutation({
    mutationFn: (on: boolean) => (on ? api.PUT('/api/v1/events/{eventId}/interest', { params: { path: { eventId: event.id } } }) : api.DELETE('/api/v1/events/{eventId}/interest', { params: { path: { eventId: event.id } } })),
    onMutate: (on) => setInterested(on),
    onError: (e, on) => {
      setInterested(!on);
      toastError(e);
    },
  });
  const login = `/login?next=${encodeURIComponent(`/e/${event.slug}`)}` as Route;
  const manage = event.myRoles.includes('ADMIN') && (
    <Button asChild variant="secondary">
      <Link href={`/manage/${event.slug}` as Route}>
        <Settings /> Manage event
      </Link>
    </Button>
  );

  if (event.status === 'DRAFT') return <>{manage}<p className="text-center text-sm">Draft · only Admins can see this page.</p></>;

  if (event.status === 'PUBLISHED') {
    if (!signedIn)
      return (
        <>
          <Button asChild>
            <Link href={login}>
              <Bell /> I&rsquo;m interested
            </Link>
          </Button>
          <span className="text-center text-sm text-muted">Get a reminder. Not a seat booking.</span>
        </>
      );
    return (
      <>
        <Button variant={interested ? 'secondary' : 'primary'} aria-pressed={interested} onClick={() => toggle.mutate(!interested)}>
          {interested ? <CheckCircle2 /> : <Bell />}
          {interested ? 'Interested' : 'I’m interested'}
        </Button>
        {interested && (
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="secondary" size="sm">
              <a href={withBase(`/api/v1/events/${event.id}/calendar.ics`)}>
                <CalendarPlus /> .ics file
              </a>
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.open(googleCalendar(event), '_blank', 'noopener')}>
              <CalendarPlus /> Google
            </Button>
          </div>
        )}
        <span className="text-center text-sm text-green">{interested ? `We'll remind you in the app when the hall opens at ${formatTime(event.startsAt)}.` : 'Get a reminder. Not a seat booking.'}</span>
        {manage}
      </>
    );
  }

  if (event.status === 'ARCHIVED') return <>{manage}<p className="text-center text-sm">This event has closed.</p></>;

  // LIVE or EXHIBITION
  const label = event.status === 'LIVE' ? 'Join' : 'Visit the exhibition';
  if (!signedIn)
    return (
      <Button asChild>
        <Link href={login}>
          {label} <ArrowRight />
        </Link>
      </Button>
    );
  const reason = event.canJoin.reason as keyof typeof ERROR_MESSAGES | null;
  const blocked = reason && !['JOIN_FORM_REQUIRED', 'HALL_FULL', 'ENTRY_PAUSED'].includes(reason);
  return (
    <>
      <Button disabled={!!blocked} onClick={() => router.push(`/e/${event.slug}/${event.attended ? 'hall' : 'join'}` as Route)}>
        {label} <ArrowRight />
      </Button>
      {blocked && <span className="text-center text-sm text-red">{reason === 'DOMAIN_NOT_ALLOWED' ? `Visitors need an @${event.allowedDomain} account. Log in with it to join.` : ERROR_MESSAGES[reason]}</span>}
      {manage}
    </>
  );
}
