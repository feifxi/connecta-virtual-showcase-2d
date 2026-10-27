'use client';
import { Headphones, Loader2, Megaphone, Trophy, X } from 'lucide-react';
import { BoothCode } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { useHallCtx } from './context';
import { selectMyBooth, useHall } from './store';
import { VideoTiles } from './video-tiles';

/** Top-centre stack: announcement · connection trouble · the booth you're standing next to · booth video */
export function Notices({ judgeProgress, hint }: { judgeProgress?: string; hint: boolean }) {
  const { media, hall } = useHallCtx();
  const banner = useHall((s) => s.banner);
  const reconnecting = useHall((s) => s.reconnecting);
  const audioOk = useHall((s) => s.audioOk);
  const peek = useHall((s) => (s.peek ? s.booths[s.peek] : null));
  const myBooth = useHall(selectMyBooth);
  const set = useHall((s) => s.set);
  const label = (id: string) => hall?.projects.find((p) => p.id === id)?.boothLabel;
  return (
    <div className="pointer-events-none absolute left-1/2 top-[22px] z-[3] grid w-[min(560px,calc(100vw-32px))] -translate-x-1/2 justify-items-center gap-2 max-md:top-[74px] [&>*]:pointer-events-auto">
      {judgeProgress && (
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-float [&_svg]:size-4 [&_svg]:text-blue">
          <Trophy />
          <strong>{judgeProgress}</strong>
        </div>
      )}
      {banner && (
        <div role="alert" className="flex w-full items-start gap-3 rounded-[14px] border border-[#ffe08a] bg-yellow-tint px-4 py-3 text-sm shadow-float">
          <Megaphone className="mt-0.5 size-[18px] shrink-0 text-orange" />
          <span className="flex-1">
            <strong className="block">Announcement from the organizers</strong>
            {banner}
          </span>
          <Button variant="ghost" size="icon" className="size-7" aria-label="Dismiss announcement" onClick={() => set({ banner: null })}>
            <X />
          </Button>
        </div>
      )}
      {reconnecting && (
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-float">
          <Loader2 className="size-4 animate-spin text-orange" />
          <span>
            <strong>Connection lost. Reconnecting…</strong> Your spot in the hall is kept.
          </span>
        </div>
      )}
      {!audioOk && (
        <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm shadow-float">
          <Headphones className="size-4 text-orange" />
          <span>
            <strong>Audio isn&rsquo;t connected.</strong> You can still walk and chat.
          </span>
          <Button size="sm" variant="secondary" onClick={() => location.reload()}>
            Retry
          </Button>
        </div>
      )}
      {peek && !myBooth && (
        <div className="flex items-center gap-2.5 rounded-full bg-white px-4 py-2 text-sm shadow-float">
          {label(peek.projectId) && <BoothCode>{label(peek.projectId)}</BoothCode>}
          <span>
            <strong>{peek.title}</strong> {peek.live ? <b className="text-live-ink">· ● Live</b> : '· No presenter now'} · {peek.count} inside
            <small className="block text-xs text-muted">Step onto the carpet to join</small>
          </span>
        </div>
      )}
      {myBooth && <VideoTiles media={media} />}
      {hint && !myBooth && (
        <div className="whitespace-nowrap rounded-full bg-white/95 px-[15px] py-[7px] text-sm shadow-[0_2px_10px_rgb(15_26_58/0.1)] max-sm:whitespace-normal">
          Move with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or click · Step onto a booth carpet to join it
        </div>
      )}
    </div>
  );
}
