'use client';
import { Track } from 'livekit-client';
import { Maximize2, Monitor } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { BoothVideo, HallMedia } from './media';
import { useHall } from './store';

function Tile({ v, name, big, onExpand }: { v: BoothVideo; name: string; big?: boolean; onExpand?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !v.track) return;
    v.track.attach(el);
    return () => void v.track?.detach(el);
  }, [v.track]);
  const screen = v.source === Track.Source.ScreenShare;
  return (
    <div className={cn('group relative overflow-hidden rounded-[10px] bg-ink', big ? 'aspect-video w-full' : screen ? 'h-[110px] w-[196px]' : 'h-[77px] w-[116px]')}>
      <video ref={ref} autoPlay playsInline muted={v.local} className={cn('size-full', screen ? 'object-contain' : 'object-cover', v.local && !screen && '-scale-x-100')} />
      <span className="absolute bottom-1 left-1.5 flex items-center gap-1 rounded bg-ink/70 px-1.5 text-[11px] font-semibold text-white">
        {screen && <Monitor className="size-3" />}
        {v.local ? (screen ? 'You are sharing' : 'You') : name}
      </span>
      {screen && onExpand && (
        <button type="button" aria-label="Enlarge the shared screen" onClick={onExpand} className="absolute right-1 top-1 rounded bg-ink/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100">
          <Maximize2 className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Presenter camera + shared screen, only while you're inside that booth */
export function VideoTiles({ media }: { media: HallMedia }) {
  const [videos, setVideos] = useState<BoothVideo[]>([]);
  const [big, setBig] = useState<BoothVideo | null>(null);
  const people = useHall((s) => s.people);
  useEffect(() => media.onVideos(setVideos), [media]);
  const nameOf = (userId: string) => Object.values(people).find((p) => p.userId === userId)?.name ?? 'Presenter';
  if (!videos.length) return null;
  return (
    <>
      <div className="flex flex-wrap justify-center gap-2" aria-label="Inside the booth">
        {videos.map((v) => <Tile key={`${v.userId}:${v.source}`} v={v} name={nameOf(v.userId)} onExpand={() => setBig(v)} />)}
      </div>
      {big && videos.some((v) => v.track?.sid === big.track?.sid) && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/80 p-4" role="dialog" aria-label="Shared screen" onClick={() => setBig(null)}>
          <div className="w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <Tile v={big} name={nameOf(big.userId)} big />
            <p className="mt-2 text-center text-sm text-white">Click outside to close</p>
          </div>
        </div>
      )}
    </>
  );
}
