'use client';
import { createContext, useContext } from 'react';
import type { EventDetail, HallData } from '@connecta/shared';
import type { HallConnection } from './connection';
import type { HallMedia } from './media';

export type HallCtx = { event: EventDetail; hall: HallData | undefined; conn: HallConnection; media: HallMedia; refreshHall: () => void };
export const HallContext = createContext<HallCtx | null>(null);

export function useHallCtx() {
  const ctx = useContext(HallContext);
  if (!ctx) throw new Error('useHallCtx outside the hall');
  return ctx;
}

/** Project card for a booth (from REST) · live state comes from the room */
export function useProjectCard(projectId: string | null | undefined) {
  const { hall } = useHallCtx();
  return projectId ? hall?.projects.find((p) => p.id === projectId) : undefined;
}
