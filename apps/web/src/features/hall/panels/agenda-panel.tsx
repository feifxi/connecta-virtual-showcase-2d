'use client';
import { Pill } from '@/components/ui/pill';
import { formatDate } from '@/lib/format';
import { useHallCtx } from '../context';
import { Frame } from './frame';

export function AgendaPanel({ onClose }: { onClose: () => void }) {
  const { event } = useHallCtx();
  return (
    <Frame title="Today’s agenda" onClose={onClose}>
      <Pill tone="blue">{formatDate(event.startsAt)}</Pill>
      {event.agenda.map((a) => (
        <div key={`${a.time}${a.title}`} className="border-b border-border py-4">
          <span className="text-sm text-muted">{a.time}</span>
          <h3 className="mt-1 text-sm">{a.title}</h3>
        </div>
      ))}
      {!event.agenda.length && <p className="mt-4 text-md">The organizer hasn&rsquo;t added an agenda.</p>}
      <p className="mt-3 text-sm">Booths are open all day. The stage and lounge are places to meet; voices there fade with distance.</p>
    </Frame>
  );
}
