'use client';
import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root className={cn('relative h-[21px] w-9 shrink-0 rounded-full bg-input transition-colors data-[state=checked]:bg-blue disabled:opacity-50', className)} {...props}>
      <SwitchPrimitive.Thumb className="block size-[15px] translate-x-[3px] rounded-full bg-white transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}
