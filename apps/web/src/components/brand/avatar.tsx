'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { character, FACE_TONES } from '@/lib/characters';
import { cn } from '@/lib/utils';

/* eslint-disable @next/next/no-img-element -- pixel art, tiny files: no optimization wanted */

export function Portrait({ avatar, size = 40, className, alt = '' }: { avatar: number | null | undefined; size?: number; className?: string; alt?: string }) {
  return <img src={character(avatar).portrait} width={size} height={size} alt={alt} className={cn('shrink-0 rounded-[10px] bg-subtle object-contain [image-rendering:pixelated]', className)} style={{ width: size, height: size }} />;
}

/** Character heads on pastel circles, overlapping · extra = "+N" */
export function AvatarStack({ avatars, extra, size = 36 }: { avatars: (number | null)[]; extra?: number; size?: number }) {
  return (
    <div className="flex items-center pl-[13px]" aria-hidden>
      {avatars.map((a, i) => (
        <span
          key={i}
          className="-ml-[13px] shrink-0 rounded-full border-2 border-white bg-no-repeat [background-position:50%_12%] [background-size:170%] [image-rendering:pixelated]"
          style={{ width: size, height: size, backgroundColor: FACE_TONES[i % FACE_TONES.length], backgroundImage: `url(${character(a).portrait})` }}
        />
      ))}
      {extra ? (
        <span className="-ml-[13px] grid shrink-0 place-items-center rounded-full border-2 border-white bg-subtle text-xs font-bold tracking-[-0.05em] text-ink-2" style={{ width: size, height: size }}>
          +{extra > 999 ? '999' : extra}
        </span>
      ) : null}
    </div>
  );
}

/** Animated sprite (walk cycle at 7 fps, otherwise a slow breathe) */
export function Actor({ avatar, direction = 0, walk = false, name, you, size = 64, className, style }: { avatar: number; direction?: 0 | 1 | 2 | 3; walk?: boolean; name?: string; you?: boolean; size?: number; className?: string; style?: CSSProperties }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!walk || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setFrame((f) => (f + 1) % 4), 1000 / 7);
    return () => clearInterval(t);
  }, [walk]);
  return (
    <div className={cn('pointer-events-none relative', className)} style={{ width: size, height: size, ...style }} {...(name ? { role: 'img', 'aria-label': name } : { 'aria-hidden': true })}>
      <div
        className={cn('sprite-sheet size-full origin-[50%_90%]', !walk && 'animate-breathe')}
        style={{ backgroundImage: `url(${character(avatar).walk})`, backgroundPosition: `${(walk ? frame : 0) * 33.333}% ${direction * 33.333}%` }}
      />
      {name && <span className={cn('absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[5px] px-1.5 text-xs font-semibold leading-[1.6] text-white', you ? 'bg-blue' : 'bg-ink/85')}>{name}</span>}
    </div>
  );
}

export function Initials({ name, size = 36 }: { name: string; size?: number }) {
  const t = name.split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-lavender text-sm font-extrabold text-ink" style={{ width: size, height: size }}>
      {t}
    </span>
  );
}
