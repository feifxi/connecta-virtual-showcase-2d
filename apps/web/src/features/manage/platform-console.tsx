'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import Link from 'next/link';
import { toast } from 'sonner';
import { Kpi } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { NativeSelect } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { Surface } from '@/components/ui/surface';
import { StatusBadge } from '@/features/events/event-card';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { formatDay } from '@/lib/format';

/** Platform team only · looks after events from outside (never enters a hall) · every action lands in that event's audit log */
export function PlatformConsole() {
  const client = useQueryClient();
  const health = useQuery({ queryKey: ['platform', 'health'], queryFn: async () => (await api.GET('/api/v1/platform/health')).data!, refetchInterval: 30_000 });
  const events = useQuery({ queryKey: ['platform', 'events'], queryFn: async () => (await api.GET('/api/v1/platform/events')).data! });
  const patch = useMutation({
    mutationFn: ({ eventId, body }: { eventId: string; body: { suspended?: boolean; plan?: 'FREE' | 'PRO' } }) => api.PATCH('/api/v1/platform/events/{eventId}', { params: { path: { eventId } }, body: { ...body, reason: '' } }),
    onSuccess: () => {
      toast.success('Updated');
      client.invalidateQueries({ queryKey: ['platform'] });
    },
    onError: (e) => toastError(e),
  });
  const h = health.data;
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid gap-[17px] sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Online now" value={h?.online ?? '–'} note={`${h?.rooms ?? 0} halls in use`} />
        <Kpi label="Live events" value={h?.liveEvents ?? '–'} />
        <Kpi label="Media server" value={h ? (h.livekit.ok ? 'OK' : 'Down') : '–'} note={h ? `${h.livekit.rooms} rooms · database ${h.db.ok ? 'OK' : 'down'}` : undefined} />
        <Kpi label="Storage" value={h ? `${(h.storageBytes / 1048576).toFixed(0)} MB` : '–'} />
      </div>
      <Surface className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-5 py-3">Event</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Admins</th>
              <th className="px-5 py-3">Plan</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {events.data?.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3">
                  <Link href={`/e/${e.slug}` as Route} className="font-semibold text-ink hover:text-blue">
                    {e.title}
                  </Link>
                  <small className="block text-xs text-muted">
                    {formatDay(e.startsAt)} · {e.boothCount} booths
                  </small>
                </td>
                <td className="px-5 py-3">{e.suspendedAt ? <Pill tone="red">Suspended</Pill> : <StatusBadge status={e.status} />}</td>
                <td className="px-5 py-3 text-xs text-muted">{e.adminEmails.join(', ')}</td>
                <td className="px-5 py-3">
                  <NativeSelect aria-label={`Plan of ${e.title}`} className="w-24 px-2 py-1.5 text-sm" defaultValue={undefined} onChange={(ev) => patch.mutate({ eventId: e.id, body: { plan: ev.target.value as 'FREE' | 'PRO' } })}>
                    <option value="">Change…</option>
                    <option value="FREE">Free</option>
                    <option value="PRO">Pro</option>
                  </NativeSelect>
                </td>
                <td className="px-5 py-3 text-right">
                  <ConfirmDialog
                    trigger={<Button size="sm" variant={e.suspendedAt ? 'secondary' : 'danger'}>{e.suspendedAt ? 'Unsuspend' : 'Suspend'}</Button>}
                    title={e.suspendedAt ? 'Unsuspend this event?' : 'Suspend this event?'}
                    description={e.suspendedAt ? 'It becomes visible again.' : 'It disappears for everyone but its Admins and anyone in the hall is sent out. The Admins see this in their audit log.'}
                    confirmLabel={e.suspendedAt ? 'Unsuspend' : 'Suspend'}
                    onConfirm={() => patch.mutate({ eventId: e.id, body: { suspended: !e.suspendedAt } })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
    </div>
  );
}
