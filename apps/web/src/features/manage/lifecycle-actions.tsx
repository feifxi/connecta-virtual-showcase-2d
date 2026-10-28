'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Clock, Rocket, Square } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { EventDetail, EventStatus } from '@connecta/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { formatTime } from '@/lib/format';

/** Status changes go through PATCH {status} · the server checks the transition (Draft → Published → Live → Exhibition → Archived) */
export function LifecycleActions({ event }: { event: EventDetail }) {
  const router = useRouter();
  const client = useQueryClient();
  const patch = useMutation({
    mutationFn: (body: { status?: EventStatus; endsAt?: string }) => api.PATCH('/api/v1/events/{eventId}', { params: { path: { eventId: event.id } }, body }),
    onSuccess: (_d, body) => {
      client.invalidateQueries({ queryKey: qk.event(event.id) });
      router.refresh();
      toast.success(body.status === 'PUBLISHED' ? 'Published · invitations are on their way' : body.status === 'LIVE' ? 'The hall is open' : body.status === 'EXHIBITION' ? 'Event ended · judging and voting are closed' : body.endsAt ? `Extended to ${formatTime(body.endsAt)}` : 'Saved');
    },
    onError: (e) => toastError(e),
  });
  const extend = () => patch.mutate({ endsAt: new Date(new Date(event.endsAt).getTime() + 30 * 60_000).toISOString() });
  return (
    <div className="flex flex-wrap gap-2">
      {event.status === 'DRAFT' && (
        <>
          <ConfirmDialog trigger={<Button size="sm" variant="secondary">Publish</Button>} danger={false} title="Publish the event?" description="The event page opens in Explore and invitations are emailed to everyone you invited." confirmLabel="Publish" onConfirm={() => patch.mutate({ status: 'PUBLISHED' })} />
          <ConfirmDialog trigger={<Button size="sm"><Rocket /> Start now</Button>} danger={false} title="Open the hall now?" description="The event goes live immediately and invitations are sent." confirmLabel="Open the hall" onConfirm={() => patch.mutate({ status: 'LIVE' })} />
        </>
      )}
      {event.status === 'PUBLISHED' && <ConfirmDialog trigger={<Button size="sm"><Rocket /> Open the hall</Button>} danger={false} title="Open the hall now?" description={`It would open by itself at ${formatTime(event.startsAt)}${event.hallOpenMode === 'MANUAL' ? ' — this event is set to open manually' : ''}.`} confirmLabel="Open the hall" onConfirm={() => patch.mutate({ status: 'LIVE' })} />}
      {event.status === 'LIVE' && (
        <>
          <Button size="sm" variant="secondary" onClick={extend}>
            <Clock /> +30 min
          </Button>
          <ConfirmDialog trigger={<Button size="sm" variant="danger"><Square /> End event</Button>} title="End the event now?" description="Judging and Popular Vote close. Complete score drafts count, incomplete ones don't. The hall stays open as an exhibition." confirmLabel="End event" onConfirm={() => patch.mutate({ status: 'EXHIBITION' })} />
        </>
      )}
      {event.status === 'EXHIBITION' && <ConfirmDialog trigger={<Button size="sm" variant="secondary">Close the exhibition</Button>} title="Close the exhibition?" description="The hall closes for good. Results, analytics and files stay." confirmLabel="Close" onConfirm={() => patch.mutate({ status: 'ARCHIVED' })} />}
      {(event.status === 'LIVE' || event.status === 'EXHIBITION') && (
        <Button asChild size="sm">
          <Link href={`/e/${event.slug}/hall` as Route}>
            Visit the hall <ArrowRight />
          </Link>
        </Button>
      )}
    </div>
  );
}
