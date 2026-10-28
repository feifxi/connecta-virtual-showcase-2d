'use client';
import { useQuery } from '@tanstack/react-query';
import { Bell, Clock, Heart, MessageSquare, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { VISITOR_TYPE_LABELS, type EventDetail, type VisitorType } from '@connecta/shared';
import { BoothCode, Kpi } from '@/components/brand/bits';
import { Skeleton, Surface } from '@/components/ui/surface';
import { ExportCsv } from '@/features/booth/booth-editor';
import { api } from '@/lib/api/browser';
import { qk } from '@/lib/api/keys';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

// One hue throughout (brand blue): every chart here is a single series, so the title names it and no legend is needed
const BLUE = '#1d5cf5';
const GRID = '#e3e7f2';

export function Report({ event }: { event: EventDetail }) {
  const eventId = event.id;
  const summary = useQuery({ queryKey: qk.analytics(eventId, 'summary'), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/analytics/summary', { params: { path: { eventId } } })).data! });
  const attendance = useQuery({ queryKey: qk.analytics(eventId, 'attendance'), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/analytics/attendance', { params: { path: { eventId }, query: { interval: '5m' } } })).data! });
  const booths = useQuery({ queryKey: qk.analytics(eventId, 'booths'), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/analytics/booths', { params: { path: { eventId } } })).data! });
  const heat = useQuery({ queryKey: qk.analytics(eventId, 'heatmap'), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/analytics/heatmap', { params: { path: { eventId } } })).data! });
  const audience = useQuery({ queryKey: qk.analytics(eventId, 'audience'), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/analytics/audience', { params: { path: { eventId } } })).data! });
  const s = summary.data;
  const pct = s && s.interested ? Math.round((s.attendedFromInterested / s.interested) * 100) : null;

  return (
    <div className="flex flex-col gap-[22px]">
      {s ? (
        <div className="grid gap-[17px] sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Interested → came" value={pct === null ? '–' : `${pct}%`} note={`${s.attendedFromInterested} of ${s.interested} · ${s.walkIns} came without tapping Interested`} icon={<Bell />} />
          <Kpi label="Peak in the hall" value={s.peakConcurrent} note={s.peakAt ? `at ${formatTime(s.peakAt)}` : 'nobody yet'} icon={<Users />} />
          <Kpi label="Average stay" value={s.avgMinutes ? `${s.avgMinutes.toFixed(0)} min` : '–'} note={`${s.attended} people joined`} icon={<Clock />} />
          <Kpi label="Feedback · votes" value={`${s.feedbackCount} · ${s.voteCount}`} note={`${s.boothVisits} booth visits`} icon={event.modules.popularVote ? <Heart /> : <MessageSquare />} />
        </div>
      ) : (
        <Skeleton className="h-28 rounded-card" />
      )}

      <Surface className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg">People in the hall</h2>
            <p className="text-sm">People in the hall during each 5 minutes</p>
          </div>
          <ExportCsv path={`/api/v1/events/${eventId}/analytics/attendance.csv`} filename="attendance.csv" />
        </div>
        {attendance.data ? <LineChart points={attendance.data.map((p) => ({ x: p.at, y: p.online }))} /> : <Skeleton className="h-56" />}
      </Surface>

      <Surface>
        <div className="flex items-center justify-between px-6 pb-3 pt-5">
          <div>
            <h2 className="text-lg">Booths</h2>
            <p className="text-sm">Visitors per booth · “passed by” = stood next to it but never stepped in</p>
          </div>
          <ExportCsv path={`/api/v1/events/${eventId}/analytics/booths.csv`} filename="booths.csv" />
        </div>
        {booths.data ? <BoothTable rows={booths.data} showVotes={event.modules.popularVote} showScore={event.modules.judging} /> : <Skeleton className="m-6 h-40" />}
      </Surface>

      <div className="grid items-start gap-[22px] xl:grid-cols-2">
        <Surface className="p-6">
          <h2 className="text-lg">Where people spent time</h2>
          <p className="mb-3 text-sm">Darker = more people over the event (sampled every 5 s · no individual positions are stored)</p>
          {heat.data ? <Heatmap cells={heat.data} /> : <Skeleton className="h-56" />}
        </Surface>
        <Surface className="p-6">
          <h2 className="mb-3 text-lg">Who came</h2>
          {audience.data ? (
            <>
              <HBars title="Visitor type" rows={audience.data.visitorTypes.map((r) => ({ label: VISITOR_TYPE_LABELS[r.key as VisitorType] ?? r.key, value: r.count }))} />
              <HBars title="Province" rows={audience.data.provinces.slice(0, 8).map((r) => ({ label: r.key, value: r.count }))} footnote={audience.data.provinces.length > 8 ? `${audience.data.provinces.length} provinces in total` : undefined} />
              {audience.data.survey.map((q) => (
                <HBars key={q.fieldId} title={`Survey · ${q.label}`} rows={q.answers.map((a) => ({ label: q.type === 'rating' ? `${a.key} ★` : a.key, value: a.count }))} />
              ))}
            </>
          ) : (
            <Skeleton className="h-56" />
          )}
        </Surface>
      </div>
    </div>
  );
}

/** Single-series line + area wash · crosshair tooltip on hover */
function LineChart({ points }: { points: { x: string; y: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800;
  const H = 220;
  const pad = { l: 36, r: 12, t: 12, b: 28 };
  if (points.length < 2) return <p className="py-12 text-center text-sm">The curve appears once people have been in the hall.</p>;
  const max = Math.max(4, ...points.map((p) => p.y));
  const step = max <= 10 ? 2 : Math.ceil(max / 4 / 5) * 5;
  const top = Math.ceil(max / step) * step;
  const sx = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const sy = (v: number) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(p.y)}`).join('');
  const area = `${line}L${sx(points.length - 1)},${sy(0)}L${sx(0)},${sy(0)}Z`;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const xTicks = points.map((_, i) => i).filter((i) => i % Math.max(1, Math.ceil(points.length / 6)) === 0);
  const h = hover === null ? null : points[hover]!;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`People online over time, peak ${max}`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(points.length - 1, Math.round(((x - pad.l) / (W - pad.l - pad.r)) * (points.length - 1)))));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(t)} y2={sy(t)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 8} y={sy(t) + 4} textAnchor="end" className="fill-muted text-[11px]">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((i) => (
          <text key={i} x={sx(i)} y={H - 8} textAnchor="middle" className="fill-muted text-[11px]">
            {formatTime(points[i]!.x)}
          </text>
        ))}
        <path d={area} fill={BLUE} opacity={0.1} />
        <path d={line} fill="none" stroke={BLUE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <>
            <line x1={sx(hover)} x2={sx(hover)} y1={pad.t} y2={sy(0)} stroke="#8a93ad" strokeWidth={1} />
            <circle cx={sx(hover)} cy={sy(h!.y)} r={5} fill={BLUE} stroke="#fff" strokeWidth={2} />
          </>
        )}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 rounded-[8px] bg-ink px-2.5 py-1.5 text-xs text-white" style={{ left: `${(sx(hover!) / W) * 100}%`, transform: 'translateX(-50%)' }}>
          {formatTime(h.x)} · <strong>{h.y}</strong> online
        </div>
      )}
    </div>
  );
}

/** Horizontal bars, value at the tip · the label sits in text ink, never the bar colour */
function HBars({ title, rows, footnote }: { title: string; rows: { label: string; value: number }[]; footnote?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="mb-5">
      <h3 className="mb-2 text-sm">{title}</h3>
      {rows.length === 0 && <p className="text-sm">No answers yet.</p>}
      {rows.map((r) => (
        <div key={r.label} className="mb-1.5 grid grid-cols-[140px_1fr] items-center gap-3 text-sm" title={`${r.label}: ${r.value}`}>
          <span className="truncate text-ink-2">{r.label}</span>
          <div className="flex items-center gap-2">
            <div className="h-3.5 rounded-r-[4px]" style={{ width: `${(r.value / max) * 85}%`, minWidth: 2, background: BLUE }} />
            <span className="tabular-nums text-muted">{r.value}</span>
          </div>
        </div>
      ))}
      {footnote && <p className="text-xs text-muted">{footnote}</p>}
    </div>
  );
}

type BoothRow = { projectId: string; title: string; boothLabel: string | null; visitors: number; avgMinutes: number | null; passedBy: number; screenShareViews: number; posterViews: number; feedback: number; votes: number; percent: number | null };

function BoothTable({ rows, showVotes, showScore }: { rows: BoothRow[]; showVotes: boolean; showScore: boolean }) {
  const [sort, setSort] = useState<keyof BoothRow>('visitors');
  const sorted = useMemo(() => [...rows].sort((a, b) => Number(b[sort] ?? -1) - Number(a[sort] ?? -1)), [rows, sort]);
  const max = Math.max(1, ...rows.map((r) => r.visitors));
  const cols: { key: keyof BoothRow; label: string }[] = [
    { key: 'visitors', label: 'Visitors' },
    { key: 'avgMinutes', label: 'Avg min' },
    { key: 'passedBy', label: 'Passed by' },
    { key: 'posterViews', label: 'Poster' },
    { key: 'screenShareViews', label: 'Screen' },
    { key: 'feedback', label: 'Feedback' },
    ...(showVotes ? [{ key: 'votes' as const, label: 'Votes' }] : []),
    ...(showScore ? [{ key: 'percent' as const, label: 'Score' }] : []),
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-y border-border text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-5 py-3">Booth</th>
            {cols.map((c) => (
              <th key={c.key} className="px-4 py-3">
                <button type="button" onClick={() => setSort(c.key)} className={cn('uppercase', sort === c.key && 'text-blue')} aria-pressed={sort === c.key}>
                  {c.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.projectId} className="border-b border-border last:border-0">
              <td className="px-5 py-3">
                <span className="flex items-center gap-2">
                  {r.boothLabel && <BoothCode>{r.boothLabel}</BoothCode>}
                  <span className="max-w-[260px] truncate font-semibold text-ink">{r.title}</span>
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 rounded-r-[4px]" style={{ width: `${(r.visitors / max) * 64}px`, minWidth: 2, background: BLUE }} aria-hidden />
                  <span className="tabular-nums">{r.visitors}</span>
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums">{r.avgMinutes?.toFixed(1) ?? '–'}</td>
              <td className="px-4 py-3 tabular-nums">{r.passedBy}</td>
              <td className="px-4 py-3 tabular-nums">{r.posterViews}</td>
              <td className="px-4 py-3 tabular-nums">{r.screenShareViews}</td>
              <td className="px-4 py-3 tabular-nums">{r.feedback}</td>
              {showVotes && <td className="px-4 py-3 tabular-nums">{r.votes}</td>}
              {showScore && <td className="px-4 py-3 tabular-nums">{r.percent?.toFixed(1) ?? '–'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sequential single-hue grid (2×2-tile cells) · value in the tooltip */
function Heatmap({ cells }: { cells: { cellX: number; cellY: number; samples: number }[] }) {
  if (!cells.length) return <p className="py-12 text-center text-sm">No movement recorded yet.</p>;
  const w = Math.max(...cells.map((c) => c.cellX)) + 1;
  const h = Math.max(...cells.map((c) => c.cellY)) + 1;
  const max = Math.max(...cells.map((c) => c.samples));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full rounded-control bg-subtle" role="img" aria-label="Heatmap of where people stood in the hall">
      {cells.map((c) => (
        <rect key={`${c.cellX}:${c.cellY}`} x={c.cellX} y={c.cellY} width={0.94} height={0.94} rx={0.12} fill={BLUE} opacity={0.12 + 0.88 * Math.sqrt(c.samples / max)}>
          <title>{`${c.samples} samples`}</title>
        </rect>
      ))}
    </svg>
  );
}
