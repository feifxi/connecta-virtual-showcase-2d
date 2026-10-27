'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { EmptyState } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/surface';
import { api } from '@/lib/api/browser';
import { qk } from '@/lib/api/keys';
import { cn } from '@/lib/utils';
import { EventCard } from './event-card';

const FILTERS = [
  { label: 'All events', status: undefined },
  { label: 'Live now', status: 'LIVE' },
  { label: 'Upcoming', status: 'PUBLISHED' },
  { label: 'Exhibition', status: 'EXHIBITION' },
] as const;

export function ExploreList() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(FILTERS[0]);
  const [q, setQ] = useState('');
  const query = useDeferredValue(q.trim());
  const list = useInfiniteQuery({
    queryKey: qk.explore(`${filter.status ?? ''}:${query}`),
    queryFn: async ({ pageParam }) => (await api.GET('/api/v1/events', { params: { query: { q: query || undefined, status: filter.status, limit: 12, cursor: pageParam } } })).data!,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const events = list.data?.pages.flatMap((p) => p.data) ?? [];
  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter events">
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn('rounded-full border border-border bg-white px-[15px] py-2 text-sm font-semibold text-muted transition-colors hover:border-blue-light hover:text-blue', filter === f && 'border-ink bg-ink text-white hover:text-white')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 size-[17px] text-faint" />
          <Input type="search" aria-label="Search events" placeholder="Search events…" value={q} onChange={(e) => setQ(e.target.value)} className="py-[11px] pl-10 text-sm" />
        </div>
      </div>
      <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
        {list.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[360px] rounded-card" />)}
        {!list.isPending && events.map((e) => <EventCard key={e.id} event={e} />)}
        {!list.isPending && !events.length && <EmptyState title={filter.status === 'EXHIBITION' ? 'No exhibitions open right now' : 'No events found'} text="Try another search or browse all events." />}
      </div>
      {list.hasNextPage && (
        <div className="mt-8 text-center">
          <Button variant="secondary" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            Show more
          </Button>
        </div>
      )}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-lavender px-6 py-5">
        <div>
          <h3 className="text-md">Your ideas deserve an audience.</h3>
          <p className="mt-1 text-sm text-[#685a86]">Planning a showcase for your class or department? Free up to 50 people at once.</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/manage/new">
            <Plus /> Create an event
          </Link>
        </Button>
      </div>
    </>
  );
}
