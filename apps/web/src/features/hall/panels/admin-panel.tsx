'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Megaphone } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { useHallCtx } from '../context';
import { useHall } from '../store';
import { Frame, SectionTitle } from './frame';

/** Things that must happen now · settings, analytics and results live in the dashboard outside */
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const { event } = useHallCtx();
  const client = useQueryClient();
  const people = useHall((s) => Object.keys(s.people).length);
  const live = useHall((s) => Object.values(s.booths).filter((b) => b.live).length);
  const paused = useHall((s) => s.entryPaused);
  const [text, setText] = useState('');
  const eventId = event.id;
  const reports = useQuery({ queryKey: qk.reports(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/reports', { params: { path: { eventId }, query: { status: 'OPEN' } } })).data!, refetchInterval: 30_000 });
  const announce = useMutation({
    mutationFn: () => api.POST('/api/v1/events/{eventId}/announcements', { params: { path: { eventId } }, body: { text: text.trim() } }),
    onSuccess: () => {
      setText('');
      toast.success('Sent to everyone in the hall');
    },
    onError: (e) => toastError(e),
  });
  const settings = useMutation({
    mutationFn: (body: { entryPaused?: boolean; muteAll?: boolean }) => api.PATCH('/api/v1/events/{eventId}/hall/settings', { params: { path: { eventId } }, body }),
    onSuccess: (_d, body) => body.muteAll && toast.success('Everyone was muted. People can unmute themselves.'),
    onError: (e) => toastError(e),
  });
  const resolve = useMutation({
    mutationFn: (reportId: string) => api.PATCH('/api/v1/events/{eventId}/reports/{reportId}', { params: { path: { eventId, reportId } }, body: { status: 'RESOLVED' } }),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.reports(eventId) }),
  });
  return (
    <Frame title="Admin tools" onClose={onClose}>
      <div className="mb-3.5 grid grid-cols-3 gap-2">
        {[
          [people, 'in hall'],
          [live, 'Live'],
          [reports.data?.length ?? 0, 'reports'],
        ].map(([v, k]) => (
          <div key={k} className="rounded-control border border-border px-2 py-2 text-center">
            <strong className="text-lg">{v}</strong>
            <div className="text-xs text-muted">{k}</div>
          </div>
        ))}
      </div>
      <Field label="Announce to everyone" htmlFor="announce" note="Shows on everyone's screen and stays in the Everyone chat.">
        <Textarea id="announce" maxLength={280} placeholder="e.g. Judging closes in 30 minutes" className="min-h-[60px]" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <Button size="sm" className="mt-2" disabled={!text.trim() || announce.isPending} onClick={() => announce.mutate()}>
        <Megaphone /> Send
      </Button>

      <SectionTitle>Reports</SectionTitle>
      {reports.data?.map((r) => (
        <div key={r.id} className="mb-2 rounded-control bg-yellow-tint p-3 text-sm">
          <strong className="block text-ink">
            {r.target.displayName} · {r.targetKind.toLowerCase()}
          </strong>
          <p className="mt-1">{r.reason}</p>
          {r.snapshot && <p className="mt-1 italic">“{r.snapshot}”</p>}
          <p className="mt-1 text-xs">Reported by {r.reporter.displayName}</p>
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => resolve.mutate(r.id)}>
            Mark handled
          </Button>
        </div>
      ))}
      {reports.data?.length === 0 && <p className="text-sm">No open reports.</p>}
      <p className="mt-2 text-sm">Kick = removed, can come back · Ban = can&rsquo;t enter this event again. Use the menu next to a person in People.</p>

      <SectionTitle>Emergency switches</SectionTitle>
      <label className="flex items-center justify-between border-b border-border py-3 text-md">
        Stop new arrivals
        <Switch checked={paused} onCheckedChange={(v) => settings.mutate({ entryPaused: v })} aria-label="Stop new arrivals" />
      </label>
      <div className="flex items-center justify-between py-3 text-md">
        Mute everyone once
        <Button size="sm" variant="secondary" onClick={() => settings.mutate({ muteAll: true })}>
          Mute all
        </Button>
      </div>
      <Button asChild variant="ghost" size="sm" className="mt-2">
        <Link href={`/manage/${event.slug}` as Route} target="_blank">
          Open the dashboard <ExternalLink />
        </Link>
      </Button>
    </Frame>
  );
}
