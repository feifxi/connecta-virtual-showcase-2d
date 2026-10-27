import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const pillVariants = cva('inline-flex w-fit items-center gap-[7px] whitespace-nowrap rounded-full px-[11px] py-[5px] text-sm font-bold leading-[1.5]', {
  variants: {
    tone: {
      neutral: 'bg-subtle text-muted',
      live: 'bg-orange-tint text-live-ink',
      blue: 'bg-blue-tint text-blue',
      green: 'bg-green-tint text-green',
      lavender: 'bg-lavender text-lavender-ink',
      red: 'bg-red-tint text-red',
      light: 'border border-border bg-white text-ink-2',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Pill({ className, tone, ...props }: ComponentProps<'span'> & VariantProps<typeof pillVariants>) {
  return <span className={cn(pillVariants({ tone }), className)} {...props} />;
}

/** "● Live" = a presenter is inside the booth right now */
export function LivePill({ children = 'Live now', className }: { children?: React.ReactNode; className?: string }) {
  return (
    <Pill tone="live" className={className}>
      <span className="size-1.5 rounded-full bg-orange shadow-[0_0_0_4px_rgb(255_106_26/0.12)]" aria-hidden />
      {children}
    </Pill>
  );
}
