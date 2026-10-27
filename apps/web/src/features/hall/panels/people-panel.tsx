'use client';
import { useMutation } from '@tanstack/react-query';
import { MoreHorizontal, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { EventRole } from '@connecta/shared';
import { Portrait } from '@/components/brand/avatar';
import { RoleChip } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useHallCtx } from '../context';
import { useHall, type HallPerson } from '../store';
import { Frame, PersonRow } from './frame';

const FILTERS: { label: string; role: EventRole | null }[] = [
  { label: 'Everyone', role: null },
  { label: 'Presenters', role: 'PRESENTER' },
  { label: 'Judges', role: 'JUDGE' },
  { label: 'Organizers', role: 'ADMIN' },
];

/** Admin actions on a person · every one is checked again on the server and lands in the audit log */
export function AdminPersonMenu({ person }: { person: HallPerson }) {
  const { event } = useHallCtx();
  const eventId = event.id;
  const userId = person.userId;
  const run = useMutation({
    mutationFn: async (action: 'mute' | 'kick' | 'ban' | { roles: EventRole[] }) => {
      if (action === 'mute') await api.PUT('/api/v1/events/{eventId}/hall/participants/{userId}/microphone', { params: { path: { eventId, userId } }, body: { muted: true } });
      else if (action === 'kick') await api.DELETE('/api/v1/events/{eventId}/hall/participants/{userId}', { params: { path: { eventId, userId } } });
      else if (action === 'ban') await api.PUT('/api/v1/events/{eventId}/bans/{userId}', { params: { path: { eventId, userId } }, body: { reason: 'Removed from the hall by an organizer' } });
      else await api.PUT('/api/v1/events/{eventId}/members/{userId}', { params: { path: { eventId, userId } }, body: { roles: action.roles } });
    },
    onSuccess: (_d, action) => toast.success(action === 'mute' ? `${person.name} was muted` : action === 'kick' ? `${person.name} was removed from the hall` : action === 'ban' ? `${person.name} was banned from this event` : 'Roles updated'),
    onError: (e) => toastError(e),
  });
  const toggle = (r: EventRole) => run.mutate({ roles: person.badges.includes(r) ? person.badges.filter((x) => x !== r) : [...person.badges, r] });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${person.name}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{person.name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => run.mutate('mute')}>Mute microphone</DropdownMenuItem>
        <DropdownMenuSeparator />
        {(['JUDGE', 'ADMIN'] as const).map((r) => (
          <DropdownMenuItem key={r} onSelect={() => toggle(r)}>
            {person.badges.includes(r) ? `Remove ${r === 'ADMIN' ? 'Admin' : 'Judge'} role` : `Make ${r === 'ADMIN' ? 'Admin' : 'Judge'}`}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => run.mutate('kick')}>Kick (can come back)</DropdownMenuItem>
        <DropdownMenuItem danger onSelect={() => run.mutate('ban')}>
          Ban from this event
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PeoplePanel({ onClose }: { onClose: () => void }) {
  const { hall } = useHallCtx();
  const people = useHall((s) => s.people);
  const me = useHall((s) => s.mySessionId);
  const isAdmin = useHall((s) => s.roles.includes('ADMIN'));
  const [filter, setFilter] = useState<EventRole | null>(null);
  const [q, setQ] = useState('');
  const titles = useMemo(() => new Map((hall?.projects ?? []).map((p) => [p.id, p.boothLabel ? `Booth ${p.boothLabel}` : p.title])), [hall]);
  const all = Object.values(people);
  const shown = all.filter((p) => (!filter || p.badges.includes(filter)) && p.name.toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => b.badges.length - a.badges.length || a.name.localeCompare(b.name));
  return (
    <Frame title={`People in the hall · ${all.length}`} onClose={onClose}>
      <div className="relative mb-2.5">
        <Search className="pointer-events-none absolute left-3 top-3 size-4 text-faint" />
        <Input type="search" aria-label="Search people" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} className="py-2.5 pl-9 text-sm" />
      </div>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.label} type="button" aria-pressed={filter === f.role} onClick={() => setFilter(f.role)} className={cn('rounded-full border border-border px-[11px] py-[5px] text-sm font-semibold text-muted', filter === f.role && 'border-ink bg-ink text-white')}>
            {f.label}
          </button>
        ))}
      </div>
      {shown.map((p) => (
        <PersonRow
          key={p.sessionId}
          avatar={<Portrait avatar={p.avatar} />}
          name={p.sessionId === me ? `${p.name} (you)` : p.name}
          sub={p.booth ? (titles.get(p.booth) ?? 'In a booth') : 'Walking the hall'}
          right={
            <span className="flex items-center gap-1">
              {p.badges.map((b) => <RoleChip key={b} role={b} />)}
              {isAdmin && p.sessionId !== me && !p.badges.includes('ADMIN') && <AdminPersonMenu person={p} />}
            </span>
          }
        />
      ))}
      {!shown.length && <p className="pt-3 text-md">Nobody by that name is in the hall right now.</p>}
    </Frame>
  );
}
