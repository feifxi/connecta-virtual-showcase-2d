'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Lock, Plus, Trash2, Trophy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { EventDetail } from '@connecta/shared';
import { BoothCode } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { Skeleton, Surface } from '@/components/ui/surface';
import { Switch } from '@/components/ui/switch';
import { ExportCsv } from '@/features/booth/booth-editor';
import { api } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';

type Row = { id?: string; name: string; description: string; maxScore: number; weight: number };

export function JudgingAdmin({ event }: { event: EventDetail }) {
  const ended = event.status === 'EXHIBITION' || event.status === 'ARCHIVED';
  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid items-start gap-[22px] xl:grid-cols-[1fr_1fr]">
        <RubricEditor eventId={event.id} />
        <Progress eventId={event.id} live={event.status === 'LIVE'} />
      </div>
      <Assignments eventId={event.id} />
      <Results event={event} ended={ended} />
    </div>
  );
}

function RubricEditor({ eventId }: { eventId: string }) {
  const client = useQueryClient();
  const q = useQuery({ queryKey: qk.rubric(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/rubric', { params: { path: { eventId } } })).data! });
  // edits live in a draft until saved; without one, show what the server has
  const [draft, setRows] = useState<Row[] | null>(null);
  const rows: Row[] = draft ?? (q.data?.criteria.length ? q.data.criteria.map(({ id, name, description, maxScore, weight }) => ({ id, name, description, maxScore, weight })) : [{ name: '', description: '', maxScore: 10, weight: 25 }]);
  const save = useMutation({
    mutationFn: () => api.PUT('/api/v1/events/{eventId}/rubric', { params: { path: { eventId } }, body: { criteria: rows.filter((r) => r.name.trim()) } }),
    onSuccess: () => {
      toast.success('Rubric saved');
      setRows(null);
      client.invalidateQueries({ queryKey: qk.rubric(eventId) });
    },
    onError: (e) => toastError(e),
  });
  if (!q.data) return <Skeleton className="h-72 rounded-card" />;
  const locked = !!q.data.lockedAt;
  const total = rows.reduce((a, r) => a + (Number(r.weight) || 0), 0);
  const set = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Surface className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg">Rubric</h2>
        {locked ? (
          <Pill>
            <Lock className="size-3.5" /> Locked · scoring started
          </Pill>
        ) : (
          <span className="text-sm text-muted">Weights total {total}</span>
        )}
      </div>
      {rows.map((r, i) => (
        <div key={r.id ?? i} className="mb-3 grid grid-cols-[1fr_70px_70px_32px] gap-2 border-b border-border pb-3">
          <Input aria-label="Criterion" placeholder="e.g. Technical depth" value={r.name} disabled={locked} onChange={(e) => set(i, { name: e.target.value })} className="py-2 text-sm" />
          <Input aria-label="Max score" type="number" min={1} max={100} value={r.maxScore} disabled={locked} onChange={(e) => set(i, { maxScore: Number(e.target.value) })} className="px-2 py-2 text-sm" />
          <Input aria-label="Weight" type="number" min={1} max={100} value={r.weight} disabled={locked} onChange={(e) => set(i, { weight: Number(e.target.value) })} className="px-2 py-2 text-sm" />
          <Button variant="ghost" size="icon" className="size-8 self-center" aria-label="Remove criterion" disabled={locked || rows.length === 1} onClick={() => setRows(rows.filter((_, j) => j !== i))}>
            <Trash2 />
          </Button>
          <Input aria-label="Description" placeholder="What judges look for" value={r.description} onChange={(e) => set(i, { description: e.target.value })} className="col-span-4 py-2 text-sm" />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {!locked && rows.length < 20 && (
          <Button variant="ghost" size="sm" onClick={() => setRows([...rows, { name: '', description: '', maxScore: 10, weight: 10 }])}>
            <Plus /> Add criterion
          </Button>
        )}
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          Save rubric
        </Button>
      </div>
      <p className="mt-3 text-sm">Columns: criterion · max score · weight. Criteria and weights lock after the first score; descriptions can still change.</p>
    </Surface>
  );
}

function Progress({ eventId, live }: { eventId: string; live: boolean }) {
  const q = useQuery({ queryKey: qk.progress(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/judging-progress', { params: { path: { eventId } } })).data!, refetchInterval: live ? 30_000 : false });
  const remind = useMutation({
    mutationFn: async () => (await api.POST('/api/v1/events/{eventId}/judging-reminders', { params: { path: { eventId } } })).data!,
    onSuccess: (r) => toast.success(r.reminded ? `Reminded ${r.reminded} judge(s)` : 'Everyone is done'),
    onError: (e) => toastError(e),
  });
  return (
    <Surface className="p-6">
      <h2 className="mb-3 text-lg">Scoring progress</h2>
      {q.data?.judges.map((j) => (
        <div key={j.userId} className="mb-2.5 grid grid-cols-[120px_1fr_48px] items-center gap-3 text-sm">
          <span className="truncate">{j.displayName}</span>
          <div className="h-2 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-blue" style={{ width: `${j.assigned ? (j.submitted / j.assigned) * 100 : 0}%` }} />
          </div>
          <strong className="text-right tabular-nums">
            {j.submitted}/{j.assigned}
          </strong>
        </div>
      ))}
      {q.data?.judges.length === 0 && <p className="text-sm">No judges yet. Invite them from People &amp; roles.</p>}
      {live && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => remind.mutate()} disabled={remind.isPending}>
          <Bell /> Remind judges who aren&rsquo;t done
        </Button>
      )}
    </Surface>
  );
}

function Assignments({ eventId }: { eventId: string }) {
  const client = useQueryClient();
  const q = useQuery({ queryKey: qk.assignments(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/judge-assignments', { params: { path: { eventId } } })).data! });
  const projects = useQuery({ queryKey: qk.projects(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/projects', { params: { path: { eventId }, query: { limit: 200 } } })).data! });
  const [draft, setPairs] = useState<Set<string> | null>(null);
  const pairs = draft ?? new Set((q.data?.assignments ?? []).map((a) => `${a.judgeId}:${a.projectId}`));
  const save = useMutation({
    mutationFn: (set: Set<string>) => api.PUT('/api/v1/events/{eventId}/judge-assignments', { params: { path: { eventId } }, body: { assignments: [...set].map((k) => ({ judgeId: k.split(':')[0]!, projectId: k.split(':')[1]! })) } }),
    onSuccess: () => {
      toast.success('Assignments saved');
      client.invalidateQueries({ queryKey: ['event', eventId] });
    },
    onError: (e) => toastError(e),
  });
  if (!q.data || !projects.data) return <Skeleton className="h-40 rounded-card" />;
  const judges = q.data.judges;
  const list = projects.data.data;
  const allToAll = pairs.size === 0;
  const toggle = (k: string) => {
    const next = new Set(pairs);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setPairs(next);
  };
  return (
    <Surface className="p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Who judges what</h2>
        <label className="flex items-center gap-2 text-sm">
          Every judge scores every project
          <Switch checked={allToAll} onCheckedChange={(on) => setPairs(on ? new Set() : new Set(judges.flatMap((j) => list.map((p) => `${j.userId}:${p.id}`))))} />
        </label>
      </div>
      {!allToAll && judges.length > 0 && (
        <div className="max-h-[420px] overflow-auto rounded-control border border-border">
          <table className="text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs text-muted">
              <tr>
                <th className="px-3 py-2">Project</th>
                {judges.map((j) => (
                  <th key={j.userId} className="px-3 py-2 font-semibold">
                    {j.displayName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    {p.boothLabel && <BoothCode>{p.boothLabel}</BoothCode>} {p.title}
                  </td>
                  {judges.map((j) => (
                    <td key={j.userId} className="px-3 py-2 text-center">
                      <input type="checkbox" className="accent-blue" aria-label={`${j.displayName} judges ${p.title}`} checked={pairs.has(`${j.userId}:${p.id}`)} onChange={() => toggle(`${j.userId}:${p.id}`)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button size="sm" className="mt-3" onClick={() => save.mutate(pairs)} disabled={save.isPending}>
        Save assignments
      </Button>
    </Surface>
  );
}

function Results({ event, ended }: { event: EventDetail; ended: boolean }) {
  const client = useQueryClient();
  const eventId = event.id;
  const q = useQuery({ queryKey: qk.results(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/results', { params: { path: { eventId } } })).data! });
  const [top, setTop] = useState(3);
  const announce = useMutation({
    mutationFn: () => api.POST('/api/v1/events/{eventId}/awards', { params: { path: { eventId } }, body: { judgesTop: top, audienceTop: top } }),
    onSuccess: () => {
      toast.success('Results announced · teams are emailed');
      client.invalidateQueries({ queryKey: ['event', eventId] });
    },
    onError: (e) => toastError(e),
  });
  const visible = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => api.PATCH('/api/v1/score-sheets/{sheetId}', { params: { path: { sheetId: id } }, body: { commentVisible: on } }),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.results(eventId) }),
    onError: (e) => toastError(e),
  });
  if (q.error instanceof ApiError) return null;
  const r = q.data;
  return (
    <Surface>
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-5">
        <div>
          <h2 className="text-lg">Results</h2>
          <p className="mt-1 text-sm">Weighted average of submitted score sheets · teams and visitors see nothing until you announce.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportCsv path={`/api/v1/events/${eventId}/results.csv`} filename="results.csv" />
          <label className="flex items-center gap-2 text-sm">
            Show top
            <Input type="number" min={1} max={10} value={top} onChange={(e) => setTop(Number(e.target.value))} className="w-16 px-2 py-1.5 text-sm" />
          </label>
          <ConfirmDialog
            trigger={
              <Button size="sm" disabled={!ended}>
                <Trophy /> {event.resultsAnnouncedAt ? 'Announce again' : 'Announce results'}
              </Button>
            }
            danger={false}
            title="Announce the results?"
            description="Winners appear on the event page (judges' and audience awards). Each team gets an email and sees its own scores and visible comments."
            confirmLabel="Announce"
            onConfirm={() => announce.mutate()}
          />
        </div>
      </div>
      {!ended && <p className="mx-6 mb-3 text-sm text-muted">You can announce once the event has ended.</p>}
      {r && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-5 py-3">#</th>
                <th className="px-5 py-3">Project</th>
                <th className="px-5 py-3">Score</th>
                {r.criteria.map((c) => (
                  <th key={c.id} className="px-5 py-3">
                    {c.name}
                  </th>
                ))}
                <th className="px-5 py-3">Sheets</th>
                {event.modules.popularVote && <th className="px-5 py-3">Votes</th>}
              </tr>
            </thead>
            <tbody>
              {r.projects.map((p, i) => (
                <tr key={p.projectId} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-bold">{i + 1}</td>
                  <td className="px-5 py-3">
                    {p.boothLabel && <BoothCode>{p.boothLabel}</BoothCode>} <span className="font-semibold text-ink">{p.title}</span>
                  </td>
                  <td className="px-5 py-3 font-bold tabular-nums">{p.percent?.toFixed(1) ?? '–'}</td>
                  {r.criteria.map((c) => (
                    <td key={c.id} className="px-5 py-3 tabular-nums text-muted">
                      {p.perCriterion[c.id]?.toFixed(0) ?? '–'}
                    </td>
                  ))}
                  <td className="px-5 py-3">{p.sheets}</td>
                  {event.modules.popularVote && <td className="px-5 py-3">{p.votes}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {r && r.sheets.some((s) => s.comment) && (
        <div className="border-t border-border px-6 py-5">
          <h3 className="mb-2 text-md">Judges&rsquo; comments · hide any before teams see them</h3>
          {r.sheets
            .filter((s) => s.comment)
            .map((s) => (
              <div key={s.id} className="flex items-start gap-3 border-b border-border py-2.5 text-sm last:border-0">
                <span className="flex-1">
                  <strong className="text-ink">{s.judge.displayName}</strong> on {r.projects.find((p) => p.projectId === s.projectId)?.title}: “{s.comment}”
                </span>
                <label className="flex shrink-0 items-center gap-2 text-xs">
                  Visible
                  <Switch checked={s.commentVisible} onCheckedChange={(on) => visible.mutate({ id: s.id, on })} />
                </label>
              </div>
            ))}
        </div>
      )}
    </Surface>
  );
}
