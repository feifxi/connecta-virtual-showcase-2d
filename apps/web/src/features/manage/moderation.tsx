'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { EventDetail } from '@connecta/shared';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { formatDateTime } from '@/lib/format';
import { useAdminEvent } from './use-event';

const ACTION: Record<string, string> = {
  'member.roles': 'changed roles of',
  'member.remove': 'removed',
  'member.leave': 'left the event',
  'member.ban': 'banned',
  'member.unban': 'lifted the ban on',
  'hall.kick': 'kicked',
  'hall.mute': 'muted',
  'hall.mute_all': 'muted everyone',
  'hall.pause': 'paused new arrivals',
  'hall.resume': 'resumed arrivals',
  'hall.announce': 'announced',
  'project.update': 'edited a booth during the event',
  'feedback.remove': 'removed feedback',
};

export function Moderation({ initial }: { initial: EventDetail }) {
  const { event, refresh } = useAdminEvent(initial);
  const client = useQueryClient();
  const eventId = event.id;
  const reports = useQuery({ queryKey: qk.reports(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/reports', { params: { path: { eventId } } })).data! });
  const audit = useQuery({ queryKey: qk.audit(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/audit-logs', { params: { path: { eventId } } })).data! });
  const done = () => {
    client.invalidateQueries({ queryKey: qk.reports(eventId) });
    client.invalidateQueries({ queryKey: qk.audit(eventId) });
  };
  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: 'RESOLVED' | 'DISMISSED' }) => api.PATCH('/api/v1/events/{eventId}/reports/{reportId}', { params: { path: { eventId, reportId: id } }, body: { status: s } }),
    onSuccess: done,
    onError: (e) => toastError(e),
  });
  const act = useMutation({
    mutationFn: async ({ userId, what }: { userId: string; what: 'kick' | 'ban' }) =>
      what === 'kick' ? api.DELETE('/api/v1/events/{eventId}/hall/participants/{userId}', { params: { path: { eventId, userId } } }) : api.PUT('/api/v1/events/{eventId}/bans/{userId}', { params: { path: { eventId, userId } }, body: { reason: 'Reported and reviewed by an organizer' } }),
    onSuccess: (_d, v) => {
      toast.success(v.what === 'kick' ? 'Removed from the hall' : 'Banned from this event');
      done();
    },
    onError: (e) => toastError(e),
  });
  const settings = useMutation({
    mutationFn: (body: { entryPaused?: boolean; muteAll?: boolean }) => api.PATCH('/api/v1/events/{eventId}/hall/settings', { params: { path: { eventId } }, body }),
    onSuccess: (_d, b) => {
      refresh();
      done();
      if (b.muteAll) toast.success('Everyone muted');
    },
    onError: (e) => toastError(e),
  });
  return (
    <div className="grid items-start gap-[22px] xl:grid-cols-[1.4fr_1fr]">
      <Surface className="p-6">
        <h2 className="mb-3 text-lg">Reports to review</h2>
        {reports.data?.map((r) => (
          <div key={r.id} className={`mb-2.5 rounded-control p-4 text-sm ${r.status === 'OPEN' ? 'bg-yellow-tint' : 'bg-subtle opacity-70'}`}>
            <strong className="block text-ink">
              {r.target.displayName} · {r.targetKind.toLowerCase()} · {r.status.toLowerCase()}
            </strong>
            <p className="mt-1">{r.reason}</p>
            {r.snapshot && <p className="mt-1 italic">“{r.snapshot}”</p>}
            <p className="mt-1 text-xs">
              by {r.reporter.displayName} · {formatDateTime(r.createdAt)}
            </p>
            {r.status === 'OPEN' && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => status.mutate({ id: r.id, s: 'DISMISSED' })}>
                  Dismiss
                </Button>
                <Button size="sm" variant="secondary" onClick={() => act.mutate({ userId: r.target.userId, what: 'kick' })}>
                  Kick
                </Button>
                <Button size="sm" variant="dark" onClick={() => act.mutate({ userId: r.target.userId, what: 'ban' })}>
                  Ban
                </Button>
                <Button size="sm" variant="ghost" onClick={() => status.mutate({ id: r.id, s: 'RESOLVED' })}>
                  Mark handled
                </Button>
              </div>
            )}
          </div>
        ))}
        {reports.data?.length === 0 && <p className="text-sm">No reports.</p>}
        <h3 className="mb-2 mt-6 text-md">Audit log</h3>
        <ul className="flex flex-col gap-1.5 text-sm">
          {audit.data?.map((l) => (
            <li key={l.id}>
              <span className="text-muted">{formatDateTime(l.createdAt)}</span> · <strong className="text-ink">{l.actor?.displayName ?? 'System'}</strong> {ACTION[l.action] ?? l.action}
              {l.reason && <> · “{l.reason}”</>}
            </li>
          ))}
        </ul>
      </Surface>
      <Surface className="p-6">
        <h2 className="mb-3 text-lg">Emergency switches</h2>
        <label className="flex items-center justify-between gap-3 border-b border-border py-3">
          <span>
            <strong className="block text-md">Stop new arrivals</strong>
            <span className="text-sm text-muted">Nobody new can enter the hall</span>
          </span>
          <Switch checked={event.entryPaused} onCheckedChange={(v) => settings.mutate({ entryPaused: v })} aria-label="Stop new arrivals" />
        </label>
        <div className="flex items-center justify-between gap-3 py-3">
          <span>
            <strong className="block text-md">Mute everyone</strong>
            <span className="text-sm text-muted">People can unmute themselves afterwards</span>
          </span>
          <Button size="sm" variant="secondary" onClick={() => settings.mutate({ muteAll: true })}>
            Mute all
          </Button>
        </div>
        <p className="mt-2 text-sm">Kick removes someone for now. Ban keeps them out of this event.</p>
      </Surface>
    </div>
  );
}
