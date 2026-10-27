'use client';
import { Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BoothCode } from '@/components/brand/bits';
import { Input } from '@/components/ui/field';
import { LivePill } from '@/components/ui/pill';
import { ZoneDot } from '@/features/projects/project-card';
import { useHallCtx } from '../context';
import { useHall } from '../store';
import { Frame } from './frame';

/** Overview on entry: every booth by zone, search by title / member / tag, walk straight there (the server moves you) */
export function BoothsPanel({ onClose }: { onClose: () => void }) {
  const { hall, conn } = useHallCtx();
  const booths = useHall((s) => s.booths);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const projects = (hall?.projects ?? []).filter((p) => p.boothLabel && (!term || [p.title, p.summary ?? '', ...p.tags, ...p.members.map((m) => m.displayName)].join(' ').toLowerCase().includes(term)));
    const cats = hall?.categories.length ? hall.categories : [{ id: '', name: 'Booths', color: 'sky' as const, sort: 0, projectCount: 0 }];
    return cats.map((c) => ({ cat: c, list: projects.filter((p) => !hall?.categories.length || p.category?.id === c.id).sort((a, b) => (a.boothLabel ?? '').localeCompare(b.boothLabel ?? '')) }));
  }, [hall, q]);
  return (
    <Frame title="All booths" onClose={onClose}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-3 size-4 text-faint" />
        <Input type="search" placeholder="Search projects, people, tags" aria-label="Search booths" value={q} onChange={(e) => setQ(e.target.value)} className="py-2.5 pl-9 text-sm" />
      </div>
      <p className="mb-1.5 text-sm">Pick one to walk straight there.</p>
      {groups.map(({ cat, list }) =>
        list.length ? (
          <section key={cat.id} className="mt-3.5">
            <h3 className="mb-0.5 flex items-center gap-2 text-sm">
              <ZoneDot color={cat.color} />
              {cat.name}
              <small className="ml-auto text-xs font-medium text-muted">{list.length} booths</small>
            </h3>
            {list.map((p) => {
              const live = booths[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    conn.send('goToBooth', { projectId: p.id });
                    if (window.matchMedia('(max-width: 767px)').matches) onClose();
                  }}
                  className="flex w-full items-center gap-3 border-b border-border py-2.5 text-left last:border-0 hover:bg-subtle"
                >
                  <BoothCode>{p.boothLabel}</BoothCode>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-ink">{p.title}</strong>
                    <small className="block truncate text-xs text-muted">{p.members.map((m) => m.displayName).join(', ') || 'Team joining soon'}</small>
                  </span>
                  {live?.live ? (
                    <LivePill className="px-2 text-xs">{live.count}</LivePill>
                  ) : live?.count ? (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Users className="size-3" />
                      {live.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </section>
        ) : null,
      )}
    </Frame>
  );
}
