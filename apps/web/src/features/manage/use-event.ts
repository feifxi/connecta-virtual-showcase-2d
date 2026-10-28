'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EventDetail } from '@connecta/shared';
import { api } from '@/lib/api/browser';
import { qk } from '@/lib/api/keys';

/** Event detail on Admin pages · seeded by the server render, refreshed after every change */
export function useAdminEvent(initial: EventDetail) {
  const client = useQueryClient();
  const q = useQuery({
    queryKey: qk.event(initial.id),
    queryFn: async () => (await api.GET('/api/v1/events/{eventId}', { params: { path: { eventId: initial.id } } })).data!,
    initialData: initial,
  });
  return { event: q.data, refresh: () => client.invalidateQueries({ queryKey: qk.event(initial.id) }) };
}
