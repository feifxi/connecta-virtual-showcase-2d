'use client';
import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn('mb-7 flex gap-7 overflow-x-auto border-b border-border', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={cn('-mb-px whitespace-nowrap border-b-[3px] border-transparent py-[15px] text-md font-bold text-muted data-[state=active]:border-blue data-[state=active]:text-blue', className)} {...props} />;
}
