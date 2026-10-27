import { Label as LabelPrimitive } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full min-w-0 rounded-control border border-input bg-white px-[15px] py-[13px] text-md text-ink placeholder:font-normal placeholder:text-faint focus:border-blue focus:outline-none aria-[invalid=true]:border-red disabled:bg-subtle';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, 'min-h-[110px] resize-y', className)} {...props} />;
}

export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(control, 'appearance-auto py-3', className)} {...props} />;
}

/** Label + control + note/error, with ids wired for screen readers */
export function Field({ label, htmlFor, note, error, children, className }: { label: ReactNode; htmlFor: string; note?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-[7px] text-md font-semibold', className)}>
      <LabelPrimitive.Root htmlFor={htmlFor}>{label}</LabelPrimitive.Root>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-sm font-normal text-red">
          {error}
        </p>
      ) : (
        note && <p className="text-sm font-normal text-muted">{note}</p>
      )}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<'input'> & { label: ReactNode }) {
  return (
    <label className={cn('flex items-start gap-2.5 text-sm font-normal text-muted', className)}>
      <input type="checkbox" className="mt-1 shrink-0 accent-blue" {...props} />
      <span>{label}</span>
    </label>
  );
}
