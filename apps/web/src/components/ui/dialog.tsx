'use client';
import { AlertDialog as AlertPrimitive, Dialog as DialogPrimitive } from 'radix-ui';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlay = 'fixed inset-0 z-50 bg-ink/40';
const panel =
  'fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-card bg-white p-6 shadow-card animate-pop-in focus:outline-none sm:p-7';

export function DialogContent({ className, children, title, description, wide, ...props }: ComponentProps<typeof DialogPrimitive.Content> & { title: ReactNode; description?: ReactNode; wide?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content className={cn(panel, wide ? 'max-w-3xl' : 'max-w-lg', className)} {...props}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <DialogPrimitive.Title className="text-lg font-extrabold">{title}</DialogPrimitive.Title>
            {description ? <DialogPrimitive.Description className="mt-1.5 text-md text-muted">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
          </div>
          <DialogPrimitive.Close asChild>
            <Button variant="ghost" size="icon" aria-label="Close" className="-mr-2 -mt-2 size-9">
              <X />
            </Button>
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** Confirm before something destructive · Esc / outside click cancels */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  danger = true,
  children,
  disabled,
}: {
  trigger: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
  children?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <AlertPrimitive.Root>
      <AlertPrimitive.Trigger asChild>{trigger}</AlertPrimitive.Trigger>
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={overlay} />
        <AlertPrimitive.Content className={cn(panel, 'max-w-md')}>
          <AlertPrimitive.Title className="text-lg font-extrabold">{title}</AlertPrimitive.Title>
          <AlertPrimitive.Description className="mt-2 text-md text-muted">{description}</AlertPrimitive.Description>
          {children}
          <div className="mt-6 flex justify-end gap-2">
            <AlertPrimitive.Cancel asChild>
              <Button variant="secondary">Cancel</Button>
            </AlertPrimitive.Cancel>
            <AlertPrimitive.Action asChild>
              <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={disabled}>
                {confirmLabel}
              </Button>
            </AlertPrimitive.Action>
          </div>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}
