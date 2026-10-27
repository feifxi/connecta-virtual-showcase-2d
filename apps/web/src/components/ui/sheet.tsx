'use client';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Bottom sheet on phones (booth panel in the hall) */
export function Sheet({ open, onOpenChange, title, children, className }: { open: boolean; onOpenChange: (open: boolean) => void; title: ReactNode; children: ReactNode; className?: string } & Omit<ComponentProps<'div'>, 'title'>) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          className={cn('fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-y-auto rounded-t-[22px] border-t border-border bg-white shadow-card animate-pop-in focus:outline-none', className)}
        >
          <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border" aria-hidden />
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
