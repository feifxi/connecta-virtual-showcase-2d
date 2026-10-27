'use client';
import { Minus, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Three slots that never close each other: left = find & go · right = the booth you're in · chat = bottom-left
 * Phones: every panel becomes a bottom sheet (one at a time is enforced by the hall page)
 */
export function Frame({ title, onClose, side = 'left', children, className }: { title: ReactNode; onClose: () => void; side?: 'left' | 'right' | 'chat'; children: ReactNode; className?: string }) {
  return (
    <aside
      aria-label={typeof title === 'string' ? title : undefined}
      className={cn(
        'absolute z-[5] overflow-y-auto overscroll-contain border border-border bg-white text-ink-2 shadow-card',
        'max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[70dvh] max-md:rounded-t-[22px] max-md:border-x-0 max-md:border-b-0',
        'md:w-[334px] md:rounded-card',
        side === 'left' && 'md:bottom-[106px] md:left-[84px] md:top-[104px] md:animate-panel-in-left',
        side === 'right' && 'md:bottom-[106px] md:right-5 md:top-[86px] md:animate-panel-in',
        side === 'chat' && 'z-[46] md:bottom-[106px] md:left-5 md:h-[min(400px,calc(100dvh-330px))] md:animate-pop-in',
        className,
      )}
    >
      <header className="sticky top-0 z-[1] flex items-center justify-between border-b border-border bg-white px-[22px] pb-4 pt-5">
        <h2 className="text-base">{title}</h2>
        <Button variant="ghost" size="icon" className="size-7" aria-label={side === 'right' ? 'Minimise panel' : 'Close panel'} onClick={onClose}>
          {side === 'right' ? <Minus /> : <X />}
        </Button>
      </header>
      <div className="px-[22px] py-5">{children}</div>
    </aside>
  );
}

export const SectionTitle = ({ children }: { children: ReactNode }) => <div className="mb-[11px] mt-[21px] text-sm font-bold text-ink">{children}</div>;

export function PersonRow({ avatar, name, sub, right }: { avatar: ReactNode; name: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
      {avatar}
      <div className="min-w-0">
        <strong className="block truncate text-sm text-ink">{name}</strong>
        {sub && <small className="block truncate text-xs text-muted">{sub}</small>}
      </div>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
  );
}
