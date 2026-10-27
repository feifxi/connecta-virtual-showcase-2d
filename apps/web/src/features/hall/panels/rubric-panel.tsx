'use client';
import { BoothCode } from '@/components/brand/bits';
import { ScoreSheetEditor } from '@/features/judging/score-sheet';
import { useHallCtx } from '../context';
import { useHall } from '../store';
import { useProjectDetail } from './booth-panel';
import { Frame } from './frame';

/** Judges score right in the booth · same API as the judging list page */
export function RubricPanel({ projectId, onClose, onShowBooth }: { projectId: string; onClose: () => void; onShowBooth: () => void }) {
  const { event } = useHallCtx();
  const title = useHall((s) => s.booths[projectId]?.title);
  const { data: p } = useProjectDetail(projectId);
  return (
    <Frame title="Project evaluation" side="right" onClose={onClose}>
      <div className="mb-2 flex items-center justify-between">
        {p?.boothLabel && <BoothCode>Booth {p.boothLabel}</BoothCode>}
        <button type="button" className="text-sm font-bold text-blue" onClick={onShowBooth}>
          Booth details
        </button>
      </div>
      <h2 className="mb-4 text-base">{title ?? p?.title}</h2>
      <ScoreSheetEditor eventId={event.id} projectId={projectId} open={event.status === 'LIVE'} />
    </Frame>
  );
}
