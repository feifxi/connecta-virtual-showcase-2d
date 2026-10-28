import { ArrowRight, Bell, CheckCircle2, Clock, LayoutGrid, Trophy, Users } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { BoothCode, Kpi } from '@/components/brand/bits';
import { Surface } from '@/components/ui/surface';
import { AdminHeader } from '@/features/manage/admin-header';
import { ZoneDot } from '@/features/projects/project-card';
import { serverApi } from '@/lib/api/server';
import { getEventBySlug } from '@/lib/api/server-data';
import { HALL_PRESET_INFO, type HallPreset } from '@connecta/shared';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function OverviewPage({ params }: PageProps<'/manage/[slug]'>) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  const api = serverApi();
  const path = { params: { path: { eventId: event.id } } };
  const [projects, members, summary, progress, rubric] = await Promise.all([
    api.GET('/api/v1/events/{eventId}/projects', { params: { path: { eventId: event.id }, query: { limit: 200 } } }),
    api.GET('/api/v1/events/{eventId}/members', path),
    api.GET('/api/v1/events/{eventId}/analytics/summary', path),
    event.modules.judging ? api.GET('/api/v1/events/{eventId}/judging-progress', path) : Promise.resolve({ data: undefined }),
    event.modules.judging ? api.GET('/api/v1/events/{eventId}/rubric', path) : Promise.resolve({ data: undefined }),
  ]);
  const list = projects.data?.data ?? [];
  const withTeam = list.filter((p) => p.members.length > 0).length;
  const judges = members.data?.data.filter((m) => m.roles.includes('JUDGE')).length ?? 0;
  const submitted = progress.data?.projects.reduce((a, p) => a + p.submitted, 0) ?? 0;
  const expected = progress.data?.projects.reduce((a, p) => a + p.expected, 0) ?? 0;
  const preset = event.hallPreset as HallPreset | null;
  const checks: [string, boolean][] = [
    ['Details, time and access', true],
    [`Hall preset · ${preset ? `${HALL_PRESET_INFO[preset].label} (${HALL_PRESET_INFO[preset].booths} booths)` : '—'}`, !!preset],
    [`${list.length} projects added`, list.length > 0],
    [`Presenters joined · ${withTeam} of ${list.length} booths`, list.length > 0 && withTeam === list.length],
    ...(event.modules.judging ? ([[`Rubric (${rubric.data?.criteria.length ?? 0} criteria) and ${judges} judges`, !!rubric.data?.criteria.length && judges > 0]] as [string, boolean][]) : []),
    ['Published', event.status !== 'DRAFT'],
  ];
  return (
    <>
      <AdminHeader event={event} title="Overview" />
      <div className="mb-7 grid gap-[17px] sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Interested" value={event.interestedCount} note="before the event" icon={<Bell />} />
        <Kpi label="Joined" value={summary.data?.attended ?? 0} note={`${summary.data?.attendedFromInterested ?? 0} tapped Interested first`} icon={<Users />} />
        <Kpi label="Booths with a team" value={`${withTeam} / ${list.length}`} note="presenters accepted their invite" icon={<LayoutGrid />} />
        {event.modules.judging && <Kpi label="Scores submitted" value={`${submitted} / ${expected}`} note="close when the event ends" icon={<Trophy />} />}
      </div>
      <div className="grid items-start gap-[22px] xl:grid-cols-[1.4fr_1fr]">
        <Surface>
          <div className="flex items-center justify-between px-6 pb-3 pt-5">
            <h2 className="text-lg">Booths</h2>
            <Link className="inline-flex items-center gap-2 text-md font-bold text-blue" href={`/manage/${slug}/projects` as Route}>
              All {list.length} projects <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-6 py-3">Booth</th>
                  <th className="px-6 py-3">Project</th>
                  <th className="px-6 py-3">Zone</th>
                  <th className="px-6 py-3">Team</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 12).map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-3">{p.boothLabel ? <BoothCode>{p.boothLabel}</BoothCode> : <span className="text-xs text-red">Not placed</span>}</td>
                    <td className="px-6 py-3 font-semibold text-ink">{p.title}</td>
                    <td className="px-6 py-3">
                      {p.category && (
                        <span className="flex items-center gap-1.5">
                          <ZoneDot color={p.category.color} />
                          {p.category.name}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-muted">{p.members.map((m) => m.displayName).join(', ') || 'Invite pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
        <Surface className="p-6">
          <h2 className="mb-3 text-lg">Setup checklist</h2>
          {checks.map(([k, ok]) => (
            <div key={k} className={`flex items-center gap-2.5 border-b border-border py-2.5 text-sm last:border-0 ${ok ? 'text-ink' : 'text-muted'}`}>
              {ok ? <CheckCircle2 className="size-4 text-green" /> : <Clock className="size-4" />}
              {k}
            </div>
          ))}
        </Surface>
      </div>
    </>
  );
}
