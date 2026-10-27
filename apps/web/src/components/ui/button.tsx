import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-bold transition-[background,transform,box-shadow] duration-200 ease-out-soft disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[17px] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-blue text-white hover:-translate-y-px hover:bg-blue-hover hover:shadow-[0_5px_12px_rgb(29_92_245/0.13)] active:translate-y-px',
        secondary: 'border border-input bg-white text-ink hover:bg-subtle',
        ghost: 'bg-transparent text-muted hover:bg-subtle hover:text-ink',
        dark: 'bg-ink text-white hover:bg-ink-2',
        danger: 'bg-red-tint text-red hover:bg-[#ffe2dc]',
        onBlue: 'bg-white text-blue hover:bg-blue-tint',
      },
      size: {
        md: 'min-h-11 px-5 py-3 text-md',
        sm: 'min-h-9 rounded-[9px] px-3.5 py-2 text-sm',
        icon: 'size-10 rounded-control p-0 text-muted hover:bg-subtle hover:text-blue',
      },
      wide: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, wide, asChild, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, wide }), className)} {...(!asChild && { type })} {...props} />;
}
