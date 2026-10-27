import type { ProjectCard as ProjectCardData } from '@connecta/shared';
import { ZONE_HEX } from '@connecta/shared';
import { AvatarStack } from '@/components/brand/avatar';
import { BoothCode } from '@/components/brand/bits';
import { Pill } from '@/components/ui/pill';

export function ZoneDot({ color }: { color: keyof typeof ZONE_HEX | null | undefined }) {
  return <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: ZONE_HEX[color ?? 'neutral'] }} aria-hidden />;
}

export function ProjectCard({ project, onOpen }: { project: ProjectCardData; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[192px] flex-col rounded-2xl border border-border bg-white p-5 text-left transition-[border-color,transform] duration-200 ease-out-soft hover:-translate-y-[3px] hover:border-blue-light"
    >
      <div className="flex items-center justify-between gap-2">
        {project.boothLabel ? <BoothCode>Booth {project.boothLabel}</BoothCode> : <span />}
        {project.category && (
          <Pill className="text-xs">
            <ZoneDot color={project.category.color} />
            {project.category.name}
          </Pill>
        )}
      </div>
      <h3 className="mb-2.5 mt-4 text-base leading-[1.6]">{project.title}</h3>
      {project.summary && <p className="mb-[18px] line-clamp-2 text-sm leading-[1.6]">{project.summary}</p>}
      <div className="mt-auto flex items-center gap-2.5 text-sm text-muted">
        <AvatarStack avatars={project.members.slice(0, 3).map((m) => m.avatarPreset)} extra={Math.max(0, project.members.length - 3)} size={30} />
        <span className="truncate">{project.members.map((m) => m.displayName).join(', ') || 'Team joining soon'}</span>
        {project.tags[0] && <span className="ml-auto shrink-0 text-xs">#{project.tags[0]}</span>}
      </div>
    </button>
  );
}
