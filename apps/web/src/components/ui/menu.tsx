'use client';
import { DropdownMenu as Menu, Popover as PopoverPrimitive, Tooltip as TooltipPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export function DropdownMenuContent({ className, align = 'end', ...props }: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content align={align} sideOffset={8} className={cn('z-50 grid min-w-[220px] rounded-[14px] border border-border bg-white p-1.5 shadow-card', className)} {...props} />
    </Menu.Portal>
  );
}

export function DropdownMenuItem({ className, danger, ...props }: ComponentProps<typeof Menu.Item> & { danger?: boolean }) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-md font-semibold text-ink outline-none data-[highlighted]:bg-subtle [&_svg]:size-[17px] [&_svg]:text-muted',
        danger && 'text-red data-[highlighted]:bg-red-tint [&_svg]:text-red',
        className,
      )}
      {...props}
    />
  );
}

export const DropdownMenuSeparator = () => <Menu.Separator className="mx-1.5 my-1 h-px bg-border" />;
export const DropdownMenuLabel = ({ children }: { children: ReactNode }) => <Menu.Label className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wide text-faint">{children}</Menu.Label>;

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export function PopoverContent({ className, align = 'center', ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content align={align} sideOffset={8} className={cn('z-50 rounded-[14px] border border-border bg-white p-3 shadow-card focus:outline-none', className)} {...props} />
    </PopoverPrimitive.Portal>
  );
}

/** Icon-only buttons get a tooltip that matches their aria-label */
export function Tooltip({ label, children, side = 'top' }: { label: string; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="z-[60] rounded-md bg-ink px-2 py-1 text-xs font-semibold text-white">
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
export const TooltipProvider = TooltipPrimitive.Provider;
