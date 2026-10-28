import type { EventDetail } from '@connecta/shared';
import type { ReactNode } from 'react';
import { LivePill, Pill } from '@/components/ui/pill';
import { formatTime } from '@/lib/format';
import { LifecycleActions } from './lifecycle-actions';

export function AdminHeader({ event, title, text }: { event: EventDetail; title: string; text?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {event.status === 'LIVE' ? <LivePill>Live · ends {formatTime(event.endsAt)}</LivePill> : <Pill tone="light">{event.status === 'PUBLISHED' ? 'Published' : event.status.charAt(0) + event.status.slice(1).toLowerCase()}</Pill>}
          <Pill tone="lavender">Admin</Pill>
          <Pill tone={event.plan === 'PRO' ? 'blue' : 'neutral'}>{event.plan === 'PRO' ? 'Pro' : 'Free'}</Pill>
        </div>
        <h1 className="text-[2.1rem]">{title}</h1>
        <p className="mt-1">{text ?? event.title}</p>
      </div>
      <LifecycleActions event={event} />
    </div>
  );
}
