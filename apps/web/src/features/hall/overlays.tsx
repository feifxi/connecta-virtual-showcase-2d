'use client';
import { Check, Info, Loader2 } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { ERROR_MESSAGES } from '@connecta/shared';
import { Actor } from '@/components/brand/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useHallCtx } from './context';
import { useHall } from './store';

const STEPS = ['Checking your seat', 'Joining the hall', 'Connecting audio'] as const;

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-hall/80 px-4 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="w-full max-w-[420px] rounded-[22px] bg-white p-7 text-center shadow-card">{children}</div>
    </div>
  );
}

/** Entering: ticket → room → audio · and what to do when something on the way fails */
export function EntryOverlay({ avatar, onRetry }: { avatar: number; onRetry: () => void }) {
  const { event } = useHallCtx();
  const phase = useHall((s) => s.phase);
  const blockedBy = useHall((s) => s.blockedBy);
  const kicked = useHall((s) => s.kicked);
  const audioOk = useHall((s) => s.audioOk);
  if (phase === 'ready') return null;
  const back = (
    <Button asChild variant="secondary">
      <Link href={`/e/${event.slug}` as Route}>Browse the projects</Link>
    </Button>
  );

  if (phase === 'kicked' && kicked)
    return (
      <Card>
        <h2 className="text-xl">{kicked.banned ? 'You can’t enter this event' : 'You left the hall'}</h2>
        <p className="mb-5 mt-2 text-md">{kicked.reason}</p>
        <div className="flex justify-center gap-2">
          {!kicked.banned && <Button onClick={onRetry}>Go back in</Button>}
          {back}
        </div>
      </Card>
    );
  if (phase === 'blocked' && blockedBy) {
    if (blockedBy === 'JOIN_FORM_REQUIRED')
      return (
        <Card>
          <h2 className="text-xl">One quick step first</h2>
          <p className="mb-5 mt-2 text-md">Fill in the short join form for this event.</p>
          <Button asChild>
            <Link href={`/e/${event.slug}/join` as Route}>Open the join form</Link>
          </Button>
        </Card>
      );
    const retryable = blockedBy === 'HALL_FULL' || blockedBy === 'ENTRY_PAUSED';
    return (
      <Card>
        <h2 className="text-xl">{blockedBy === 'HALL_FULL' ? 'The hall is full right now.' : blockedBy === 'HALL_NOT_OPEN' ? 'The hall isn’t open yet' : 'You can’t go in right now'}</h2>
        <p className="mb-5 mt-2 text-md">{blockedBy === 'HALL_FULL' ? 'Seats free up as people leave — try again in a minute.' : blockedBy === 'DOMAIN_NOT_ALLOWED' ? `Visitors need an @${event.allowedDomain} account.` : ERROR_MESSAGES[blockedBy]}</p>
        <div className="flex justify-center gap-2">
          {retryable && <Button onClick={onRetry}>Try again</Button>}
          {back}
        </div>
      </Card>
    );
  }

  const failed = phase === 'failed';
  const at = phase === 'ticket' ? 0 : phase === 'joining' ? 1 : 2;
  return (
    <Card>
      <div className="mx-auto mb-3 h-24 w-24">
        <Actor avatar={avatar} walk={!failed} size={96} />
      </div>
      <h2 className="text-xl">{failed ? 'Can’t reach the hall right now' : `Entering ${event.title}`}</h2>
      <p className="mt-2 text-md">{failed ? 'The hall isn’t answering. Check your connection and try again in a moment.' : 'Your mic starts muted.'}</p>
      <ol className="mx-auto mt-5 flex max-w-[260px] flex-col gap-2.5 text-left text-sm">
        {STEPS.map((l, i) => {
          const state = failed && i === at ? 'failed' : i < at ? 'done' : i === at ? 'now' : 'todo';
          return (
            <li key={l} className={cn('flex items-center gap-2.5', state === 'todo' && 'text-faint')}>
              {state === 'done' ? <Check className="size-4 text-green" /> : state === 'now' ? <Loader2 className="size-4 animate-spin text-blue" /> : state === 'failed' ? <Info className="size-4 text-red" /> : <span className="mx-1 size-2 rounded-full bg-border" />}
              <span>
                {l}
                {i === 2 && !audioOk && state !== 'todo' && <small className="block text-xs text-muted">Audio unavailable, entering without it</small>}
              </span>
            </li>
          );
        })}
      </ol>
      {failed && (
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={onRetry}>Try again</Button>
          {back}
        </div>
      )}
    </Card>
  );
}
