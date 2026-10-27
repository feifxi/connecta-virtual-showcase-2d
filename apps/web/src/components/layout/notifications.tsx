'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { api } from '@/lib/api/browser';
import { qk } from '@/lib/api/keys';
import { relative } from '@/lib/format';

type Payload = { slug?: string; title?: string; eventTitle?: string; left?: number };

function describe(kind: string, p: Payload): { text: string; href: string } {
  switch (kind) {
    case 'invite':
      return { text: `You're invited to ${p.eventTitle}`, href: '/home' };
    case 'hall_open':
      return { text: `${p.title} is open — walk in`, href: `/e/${p.slug}` };
    case 'feedback':
      return { text: `New feedback on "${p.title}"`, href: '/home' };
    case 'ending_soon':
      return { text: `${p.title} ends in 30 minutes`, href: `/manage/${p.slug}` };
    case 'judging_reminder':
      return { text: `${p.left} projects left to score in ${p.title}`, href: `/e/${p.slug}/judge` };
    default:
      return { text: 'Something new happened', href: '/home' };
  }
}

export function NotificationsButton() {
  const client = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: qk.notifications,
    queryFn: async () => (await api.GET('/api/v1/me/notifications')).data!,
    refetchInterval: 60_000,
  });
  const read = useMutation({
    mutationFn: (id: string) => api.PATCH('/api/v1/me/notifications/{id}', { params: { path: { id } } }),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.notifications }),
  });
  const unread = data.filter((n) => !n.readAt).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative">
          <Bell />
          {unread > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-orange" aria-hidden />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(340px,calc(100vw-32px))] p-1.5">
        <p className="px-3 pb-1 pt-2 text-sm font-bold">Notifications</p>
        {data.length === 0 && <p className="px-3 py-6 text-center text-sm">Nothing new yet.</p>}
        <ul className="max-h-80 overflow-y-auto">
          {data.map((n) => {
            const d = describe(n.kind, n.payload as Payload);
            return (
              <li key={n.id}>
                <Link href={d.href as Route} onClick={() => !n.readAt && read.mutate(n.id)} className="flex gap-2.5 rounded-[9px] px-3 py-2.5 text-sm hover:bg-subtle">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-blue'}`} aria-hidden />
                  <span>
                    <span className="block font-semibold text-ink">{d.text}</span>
                    <span className="text-xs text-muted">{relative(n.createdAt)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
