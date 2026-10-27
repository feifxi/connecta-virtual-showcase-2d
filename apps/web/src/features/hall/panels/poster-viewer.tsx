'use client';
/* eslint-disable @next/next/no-img-element -- signed URLs */
import { ChevronLeft, ChevronRight, Minus, Plus, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ProjectFile } from '@connecta/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useHallCtx } from '../context';

type View = { page: number; zoom: number; x: number; y: number };
const SEND_MS = 100; // ≤ 10 updates/s (docs/technical.md → viewer sync)

/** Poster/slides as images · the presenter's page, zoom and pan follow to everyone in the booth (S6) */
export function PosterViewer({ projectId, file, open, onOpenChange, presenting }: { projectId: string; file: ProjectFile; open: boolean; onOpenChange: (o: boolean) => void; presenting: boolean }) {
  const { conn } = useHallCtx();
  const [view, setView] = useState<View>({ page: 1, zoom: 1, x: 0.5, y: 0.5 });
  const [follow, setFollow] = useState(true);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const lastSent = useRef(0);
  const pages = Math.max(1, file.pageUrls.length);

  useEffect(() => {
    if (open) conn.posterOpen(projectId);
  }, [open, conn, projectId]);
  useEffect(
    () =>
      conn.on('poster', (v) => {
        if (!presenting && follow && v.projectId === projectId && v.fileId === file.id) setView({ page: v.page, zoom: v.zoom, x: v.x, y: v.y });
      }),
    [conn, presenting, follow, projectId, file.id],
  );
  const change = (next: View) => {
    const v = { ...next, zoom: Math.min(6, Math.max(1, next.zoom)), x: Math.min(1, Math.max(0, next.x)), y: Math.min(1, Math.max(0, next.y)), page: Math.min(pages, Math.max(1, next.page)) };
    setView(v);
    if (presenting && Date.now() - lastSent.current > SEND_MS) {
      lastSent.current = Date.now();
      conn.send('poster:view', { fileId: file.id, ...v });
    } else if (!presenting) setFollow(false);
  };
  const src = file.pageUrls[view.page - 1] ?? file.url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={file.kind === 'SLIDES' ? 'Slides' : 'Poster'} description={presenting ? 'Everyone in your booth follows your page and zoom.' : follow ? 'Following the presenter. Move or zoom to look around on your own.' : 'Looking on your own.'} className="max-w-[min(1100px,calc(100vw-32px))]">
        <div
          className="relative h-[min(70dvh,760px)] cursor-grab touch-none overflow-hidden rounded-control bg-subtle active:cursor-grabbing"
          onWheel={(e) => change({ ...view, zoom: view.zoom * (e.deltaY > 0 ? 0.9 : 1.1) })}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || view.zoom <= 1) return;
            const r = e.currentTarget.getBoundingClientRect();
            change({ ...view, x: d.vx - (e.clientX - d.x) / (r.width * view.zoom), y: d.vy - (e.clientY - d.y) / (r.height * view.zoom) });
          }}
          onPointerUp={() => (drag.current = null)}
        >
          <img
            src={src}
            alt={`Page ${view.page} of ${pages}`}
            draggable={false}
            className="size-full select-none object-contain transition-transform duration-100"
            style={{ transform: `scale(${view.zoom})`, transformOrigin: `${view.x * 100}% ${view.y * 100}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon" aria-label="Previous page" disabled={view.page <= 1} onClick={() => change({ ...view, page: view.page - 1, zoom: 1 })}>
              <ChevronLeft />
            </Button>
            <span className="min-w-20 text-center text-sm">
              {view.page} / {pages}
            </span>
            <Button variant="secondary" size="icon" aria-label="Next page" disabled={view.page >= pages} onClick={() => change({ ...view, page: view.page + 1, zoom: 1 })}>
              <ChevronRight />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon" aria-label="Zoom out" onClick={() => change({ ...view, zoom: view.zoom / 1.25 })}>
              <Minus />
            </Button>
            <span className="min-w-14 text-center text-sm">{Math.round(view.zoom * 100)}%</span>
            <Button variant="secondary" size="icon" aria-label="Zoom in" onClick={() => change({ ...view, zoom: view.zoom * 1.25 })}>
              <Plus />
            </Button>
          </div>
          {!presenting && (
            <Button variant={follow ? 'secondary' : 'primary'} size="sm" className={cn(follow && 'pointer-events-none opacity-70')} onClick={() => setFollow(true)}>
              <Users /> {follow ? 'Following the presenter' : 'Follow the presenter'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
