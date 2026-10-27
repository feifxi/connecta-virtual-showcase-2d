import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Surface({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-card border border-border bg-white', className)} {...props} />;
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('animate-pulse rounded-control bg-subtle', className)} {...props} />;
}
