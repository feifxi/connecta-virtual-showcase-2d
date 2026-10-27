'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { sheetPercent, type Rubric, type ScoreSheet } from '@connecta/shared';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { Skeleton } from '@/components/ui/surface';
import { api } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { cn } from '@/lib/utils';

const SAVE_DELAY_MS = 600;

/**
 * Score per criterion + comment · autosaves as a draft on every change (If-Match guards a second tab)
 * Submit when every criterion has a score · editable until the event ends
 */
export function ScoreSheetEditor({ eventId, projectId, open }: { eventId: string; projectId: string; open: boolean }) {
  const client = useQueryClient();
  const rubric = useQuery({ queryKey: qk.rubric(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/rubric', { params: { path: { eventId } } })).data! });
  const sheet = useQuery({
    queryKey: qk.sheet(projectId),
    queryFn: async () => {
      const r = await api.GET('/api/v1/projects/{projectId}/score-sheets/me', { params: { path: { projectId } } });
      return { ...r.data!, etag: r.response.headers.get('etag') };
    },
    retry: false,
  });
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const etag = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!sheet.data || loaded.current) return;
    loaded.current = true;
    setScores(Object.fromEntries(sheet.data.scores.map((s) => [s.criterionId, s.score])));
    setComment(sheet.data.comment ?? '');
    etag.current = sheet.data.etag;
  }, [sheet.data]);

  const save = useMutation({
    mutationFn: async (body: { scores: { criterionId: string; score: number }[]; comment: string }) => {
      const r = await api.PUT('/api/v1/projects/{projectId}/score-sheets/me', { params: { path: { projectId } }, body, headers: etag.current ? { 'If-Match': etag.current } : {} });
      etag.current = r.response.headers.get('etag');
      return r.data!;
    },
    onSuccess: (d) => client.setQueryData(qk.sheet(projectId), { ...d, etag: etag.current }),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'STALE_VERSION') {
        loaded.current = false;
        client.invalidateQueries({ queryKey: qk.sheet(projectId) });
      }
      toastError(e);
    },
  });
  const submit = useMutation({
    mutationFn: async () => (await api.PATCH('/api/v1/projects/{projectId}/score-sheets/me', { params: { path: { projectId } }, body: { status: 'SUBMITTED' } })).data!,
    onSuccess: (d) => {
      client.setQueryData(qk.sheet(projectId), { ...d, etag: etag.current });
      client.invalidateQueries({ queryKey: qk.judgeList(eventId) });
    },
    onError: (e) => toastError(e),
  });

  const queueSave = (nextScores: Record<string, number>, nextComment: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate({ scores: Object.entries(nextScores).map(([criterionId, score]) => ({ criterionId, score })), comment: nextComment }), SAVE_DELAY_MS);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  if (sheet.error instanceof ApiError && sheet.error.code === 'NOT_ASSIGNED') return <p className="text-md">You&rsquo;re not assigned to judge this project.</p>;
  if (rubric.isPending || sheet.isPending) return <Skeleton className="h-64" />;
  const r: Rubric | undefined = rubric.data;
  if (!r?.criteria.length) return <p className="text-md">The organizer hasn&rsquo;t set up the rubric yet.</p>;
  const s: ScoreSheet | undefined = sheet.data;
  const criteria = r.criteria.map((c) => ({ id: c.id, maxScore: c.maxScore, weight: c.weight }));
  const list = Object.entries(scores).map(([criterionId, score]) => ({ criterionId, score }));
  const percent = sheetPercent(criteria, list);
  const complete = r.criteria.every((c) => scores[c.id] !== undefined);
  const totalWeight = r.criteria.reduce((a, c) => a + c.weight, 0);
  const disabled = !open;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Pill tone={s?.status === 'SUBMITTED' ? 'green' : 'blue'}>{s?.status === 'SUBMITTED' ? 'Submitted' : save.isPending ? 'Saving…' : s?.status === 'DRAFT' ? 'Draft · saved' : 'Not scored yet'}</Pill>
        {!open && <Pill tone="red">Judging closed</Pill>}
      </div>
      {r.criteria.map((c) => (
        <div key={c.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm font-bold text-ink">
            <span>
              {c.name} · {Math.round((c.weight / totalWeight) * 100)}%
            </span>
            <span className="tabular-nums text-muted">
              {scores[c.id] ?? '–'} / {c.maxScore}
            </span>
          </div>
          {c.description && <p className="mb-2 text-xs">{c.description}</p>}
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(c.maxScore + 1, 11)}, minmax(0, 1fr))` }} role="group" aria-label={c.name}>
            {Array.from({ length: c.maxScore + 1 }, (_, n) => n)
              .filter((n) => c.maxScore <= 10 || n % Math.ceil(c.maxScore / 10) === 0 || n === c.maxScore)
              .map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  aria-label={`${c.name}: ${n} out of ${c.maxScore}`}
                  aria-pressed={scores[c.id] === n}
                  onClick={() => {
                    const next = { ...scores, [c.id]: n };
                    setScores(next);
                    queueSave(next, comment);
                  }}
                  className={cn('h-9 rounded-[8px] border border-border text-sm font-bold text-muted transition-colors hover:border-blue-light disabled:opacity-50', scores[c.id] !== undefined && n <= scores[c.id]! && 'border-blue bg-blue-tint text-blue', scores[c.id] === n && 'bg-blue text-white')}
                >
                  {n}
                </button>
              ))}
          </div>
        </div>
      ))}
      <Field label="Comment for the team" htmlFor={`comment-${projectId}`} note="The team sees it after results are announced (organizers may hide it).">
        <Textarea
          id={`comment-${projectId}`}
          disabled={disabled}
          maxLength={2000}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            queueSave(scores, e.target.value);
          }}
        />
      </Field>
      <div className="flex items-baseline justify-between rounded-control bg-subtle px-4 py-3">
        <span className="text-sm text-muted">Weighted score</span>
        <strong className="text-2xl tabular-nums">
          {percent === null ? '–' : percent.toFixed(1)}
          <small className="text-sm text-muted"> / 100</small>
        </strong>
      </div>
      <Button wide disabled={disabled || !complete || submit.isPending || s?.status === 'SUBMITTED'} onClick={() => submit.mutate()}>
        {s?.status === 'SUBMITTED' ? <CheckCircle2 /> : <Check />}
        {s?.status === 'SUBMITTED' ? 'Score submitted · you can still edit' : 'Submit score'}
      </Button>
      <p className="text-center text-xs">When the event ends, complete drafts count; incomplete ones don&rsquo;t.</p>
    </div>
  );
}
