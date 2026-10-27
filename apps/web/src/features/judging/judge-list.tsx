'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Map as MapIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import type { EventDetail } from '@connecta/shared';
import { BoothCode, EmptyState } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { Pill } from '@/components/ui/pill';
import { Skeleton, Surface } from '@/components/ui/surface';
import { ZoneDot } from '@/features/projects/project-card';
import { api } from '@/lib/api/browser';
import { qk } from '@/lib/api/keys';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ScoreSheetEditor } from './score-sheet';

const STATUS = { SUBMITTED: { label: 'Submitted', tone: 'green' }, DRAFT: { label: 'Draft', tone: 'live' }, NONE: { label: 'Not started', tone: 'neutral' } } as const;

/** Assigned projects + my status · score here or from the booth panel in the hall (same API) */
export function JudgeList({ event }: { event: EventDetail }) {
  const list = useQuery({ queryKey: qk.judgeList(event.id), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/score-sheets/me', { params: { path: { eventId: event.id } } })).data! });
  const [open, setOpen] = useState<string | null>(null);
  const items = list.data?.items ?? [];
  const current = items.find((i) => i.project.id === open) ?? items[0];
  const done = items.filter((i) => i.status === 'SUBMITTED').length;
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Pill tone="blue">Judge</Pill>
            <span className="text-sm text-muted">
              {done} of {items.length} submitted
            </span>
          </div>
          <h1 className="text-[2.1rem]">Your judging list</h1>
          <p className="mt-2">
            {list.data?.judgingOpen ? `Scoring closes when the event ends at ${formatTime(event.endsAt)}.` : event.status === 'LIVE' ? '' : event.status === 'PUBLISHED' ? 'Scoring opens when the hall opens. You can read the rubric now.' : 'Judging is closed.'} Complete drafts count; incomplete ones don&rsquo;t.
          </p>
        </div>
        {event.status === 'LIVE' && (
          <Button asChild>
            <Link href={`/e/${event.slug}/hall` as Route}>
              Enter the hall <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
      {list.isPending && <Skeleton className="h-96 rounded-card" />}
      {list.isSuccess && !items.length && <EmptyState title="No projects assigned yet" text="The organizer hasn’t assigned projects to you." />}
      {current && (
        <div className="grid items-start gap-[22px] xl:grid-cols-[1.4fr_1fr]">
          <Surface className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-5 py-3 font-bold">Booth</th>
                  <th className="px-5 py-3 font-bold">Project</th>
                  <th className="px-5 py-3 font-bold">Your score</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.project.id} onClick={() => setOpen(i.project.id)} className={cn('cursor-pointer border-b border-border last:border-0 hover:bg-subtle', current.project.id === i.project.id && 'bg-blue-tint hover:bg-blue-tint')}>
                    <td className="px-5 py-3.5">{i.project.boothLabel && <BoothCode>{i.project.boothLabel}</BoothCode>}</td>
                    <td className="px-5 py-3.5">
                      <button type="button" className="text-left font-semibold text-ink" onClick={() => setOpen(i.project.id)}>
                        {i.project.title}
                      </button>
                      {i.project.category && (
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          <ZoneDot color={i.project.category.color} />
                          {i.project.category.name}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Pill tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Pill>
                      {i.percent !== null && <span className="ml-2 tabular-nums text-muted">{i.percent.toFixed(1)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
          <Surface className="p-6">
            <div className="mb-2 flex items-center justify-between">
              {current.project.boothLabel && <BoothCode>Booth {current.project.boothLabel}</BoothCode>}
              {event.status === 'LIVE' && (
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/e/${event.slug}/hall` as Route}>
                    <MapIcon /> Go to the booth
                  </Link>
                </Button>
              )}
            </div>
            <h2 className="mb-4 text-base">{current.project.title}</h2>
            <ScoreSheetEditor key={current.project.id} eventId={event.id} projectId={current.project.id} open={!!list.data?.judgingOpen} />
          </Surface>
        </div>
      )}
    </>
  );
}
