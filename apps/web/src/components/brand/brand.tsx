import Link from 'next/link';
import { cn } from '@/lib/utils';

export function BrandMark({ small }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-block -rotate-[8deg] rounded-full border-blue border-r-transparent after:absolute after:rounded-full after:bg-orange',
        small ? 'size-5 border-4 after:-right-[5px] after:top-1 after:size-[5px]' : 'size-7 border-[6px] after:-right-[7px] after:top-[5px] after:size-[7px]',
      )}
    />
  );
}

export function Brand({ href = '/', small }: { href?: '/' | '/home'; small?: boolean }) {
  return (
    <Link href={href} aria-label="Connecta home" className={cn('inline-flex shrink-0 items-center gap-2.5 font-extrabold tracking-[-0.03em] text-ink', small ? 'text-base' : 'text-[1.4rem]')}>
      <BrandMark small={small} />
      <span translate="no">Connecta</span>
    </Link>
  );
}
