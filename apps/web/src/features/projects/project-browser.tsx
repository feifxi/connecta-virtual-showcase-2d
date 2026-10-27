'use client';
/* eslint-disable @next/next/no-img-element -- signed URLs */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, Search } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import type { Category, ProjectCard as ProjectCardData } from '@connecta/shared';
import { BoothCode, EmptyState } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/surface';
import { api } from '@/lib/api/browser';
import { qk } from '@/lib/api/keys';
import { cn } from '@/lib/utils';
import { ProjectCard, ZoneDot } from './project-card';

/** Browse before you go in · search title / team / tag · filter by category · preview without walking there */
export function ProjectBrowser({ eventId, categories, enterHref, enterLabel }: { eventId: string; categories: Category[]; enterHref?: string; enterLabel?: string }) {
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());
  const [open, setOpen] = useState<ProjectCardData | null>(null);
  const list = useQuery({
    queryKey: qk.projects(eventId, query, cat),
    queryFn: async () => (await api.GET('/api/v1/events/{eventId}/projects', { params: { path: { eventId }, query: { q: query || undefined, categoryId: cat || undefined, limit: 200 } } })).data!,
    placeholderData: keepPreviousData,
  });
  const projects = list.data?.data ?? [];
  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-center justify-between gap-4">
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {[{ id: '', name: 'All projects', color: null }, ...categories].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={cat === c.id}
                onClick={() => setCat(c.id)}
                className={cn('flex items-center gap-2 rounded-full border border-border bg-white px-[15px] py-2 text-sm font-semibold text-muted hover:border-blue-light hover:text-blue', cat === c.id && 'border-ink bg-ink text-white hover:text-white')}
              >
                {c.color && <ZoneDot color={c.color} />}
                {c.name}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 size-[17px] text-faint" />
          <Input type="search" aria-label="Search projects" placeholder="Search title, team or tag…" value={q} onChange={(e) => setQ(e.target.value)} className="py-[11px] pl-10 text-sm" />
        </div>
      </div>
      <div className="grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {list.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[192px] rounded-2xl" />)}
        {projects.map((p) => <ProjectCard key={p.id} project={p} onOpen={() => setOpen(p)} />)}
        {list.isSuccess && !projects.length && <EmptyState title="No projects found" text="Try another word or category." />}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        {open && (
          <DialogContent title={open.title} wide>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {open.boothLabel && <BoothCode>Booth {open.boothLabel}</BoothCode>}
              {open.category && (
                <span className="flex items-center gap-2 text-sm text-muted">
                  <ZoneDot color={open.category.color} />
                  {open.category.name}
                </span>
              )}
            </div>
            {open.coverUrl && <img src={open.coverUrl} alt="" className="mb-4 aspect-[1.6] w-full rounded-control object-cover" />}
            <p className="text-md leading-[1.8]">{open.summary || 'The team hasn’t written a summary yet.'}</p>
            {open.tags.length > 0 && <p className="mt-3 text-sm text-blue">{open.tags.map((t) => `#${t}`).join(' ')}</p>}
            <p className="mt-4 text-sm">Team: {open.members.map((m) => m.displayName).join(', ') || '—'}</p>
            {enterHref && (
              <div className="mt-6 flex justify-end">
                <Button asChild>
                  <Link href={enterHref as Route}>
                    {enterLabel ?? 'Go to this booth'} <ArrowRight />
                  </Link>
                </Button>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
