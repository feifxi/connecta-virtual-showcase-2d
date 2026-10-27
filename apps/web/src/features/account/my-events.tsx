'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Mail, Search } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { EventRole, MyEvent } from '@connecta/shared';
import { EmptyState, roleLabel } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { Skeleton, Surface } from '@/components/ui/surface';
import { EventCard } from '@/features/events/event-card';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { cn } from '@/lib/utils';

const FILTERS: { label: string; role: EventRole | 'VISITOR' | null }[] = [
  { label: 'All', role: null },
  { label: 'Admin', role: 'ADMIN' },
  { label: 'Presenting', role: 'PRESENTER' },
  { label: 'Judging', role: 'JUDGE' },
  { label: 'Interested & attended', role: 'VISITOR' },
];

/** Where each card goes depends on what I do in that event */
const hrefFor = (e: MyEvent) =>
  e.myRoles.includes('ADMIN') ? `/manage/${e.slug}` : e.myRoles.includes('PRESENTER') ? `/e/${e.slug}/my-booth` : e.myRoles.includes('JUDGE') ? `/e/${e.slug}/judge` : `/e/${e.slug}`;

export function MyEvents() {
  const router = useRouter();
  const client = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(FILTERS[0]!);
  const events = useQuery({ queryKey: qk.myEvents, queryFn: async () => (await api.GET('/api/v1/me/events')).data! });
  const invites = useQuery({ queryKey: qk.myInvites, queryFn: async () => (await api.GET('/api/v1/me/invites')).data! });
  const accept = useMutation({
    mutationFn: async (id: string) => (await api.POST('/api/v1/me/invites/{inviteId}/acceptances', { params: { path: { inviteId: id } } })).data!,
    onSuccess: (r) => {
      client.invalidateQueries({ queryKey: ['me'] });
      router.push((r.roles.includes('ADMIN') ? `/manage/${r.eventSlug}` : r.roles.includes('PRESENTER') ? `/e/${r.eventSlug}/my-booth` : `/e/${r.eventSlug}/judge`) as Route);
    },
    onError: (e) => toastError(e),
  });
  const shown = (events.data ?? []).filter((e) => !filter.role || (filter.role === 'VISITOR' ? !e.myRoles.length : e.myRoles.includes(filter.role)));

  return (
    <>
      {invites.data?.map((inv) => (
        <Surface key={inv.id} className="mb-4 flex flex-wrap items-center gap-4 border-[#ffd98a] px-[22px] py-[18px]">
          <span className="grid size-[42px] shrink-0 place-items-center rounded-[13px] bg-yellow-tint text-[#8a5b00]">
            <Mail className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="text-md">
              {inv.invitedByName} invited you to {inv.roles.map(roleLabel).join(' & ').toLowerCase()} at <span className="text-blue">{inv.eventTitle}</span>
            </strong>
            {inv.projectTitle && <p className="text-sm">Booth: {inv.projectTitle}</p>}
          </div>
          <Button size="sm" onClick={() => accept.mutate(inv.id)} disabled={accept.isPending}>
            Accept invite
          </Button>
        </Surface>
      ))}
      <div className="mb-[22px] mt-2 flex flex-wrap gap-2" role="group" aria-label="Filter by role">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn('rounded-full border border-border bg-white px-[15px] py-2 text-sm font-semibold text-muted hover:border-blue-light hover:text-blue', filter === f && 'border-ink bg-ink text-white hover:text-white')}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
        {events.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[360px] rounded-card" />)}
        {shown.map((e) => <EventCard key={e.id} event={e} roles={e.myRoles} href={hrefFor(e)} />)}
        {events.isSuccess && !shown.length && <EmptyState title="Nothing here yet" text="Find an event in Explore and tap Interested, or create your own." />}
      </div>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-lavender px-6 py-5">
        <div>
          <h3 className="text-md">Interested in an event?</h3>
          <p className="mt-1 text-sm text-[#685a86]">Find one in Explore and tap Interested. We remind you in the app when the hall opens.</p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/explore">
            <Search /> Explore events <ArrowRight />
          </Link>
        </Button>
      </div>
    </>
  );
}
