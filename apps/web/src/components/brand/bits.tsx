import type { EventRole } from '@connecta/shared';
import { Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Pill } from '@/components/ui/pill';
import { cn } from '@/lib/utils';

const ROLE_TONE = { ADMIN: 'lavender', PRESENTER: 'green', JUDGE: 'blue' } as const;
const ROLE_LABEL: Record<EventRole, string> = { ADMIN: 'Admin', PRESENTER: 'Presenter', JUDGE: 'Judge' };

export function RoleChip({ role }: { role: EventRole | 'VISITOR' }) {
  if (role === 'VISITOR') return <Pill>Visitor</Pill>;
  return <Pill tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Pill>;
}
export const roleLabel = (r: EventRole) => ROLE_LABEL[r];

export function EmptyState({ title, text, icon, action }: { title: string; text: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="col-span-full px-5 py-14 text-center">
      <div className="mx-auto mb-3 grid size-9 place-items-center text-faint [&_svg]:size-[34px]">{icon ?? <Search />}</div>
      <h3 className="mb-2">{title}</h3>
      <p className="mx-auto max-w-md text-md leading-[1.8]">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageTitle({ title, text, actions, className }: { title: ReactNode; text?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-8 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        <h1 className="text-[2.15rem]">{title}</h1>
        {text && <p className="mt-2">{text}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeading({ title, text, aside }: { title: ReactNode; text?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
      <div>
        <h2>{title}</h2>
        {text && <p className="mt-[7px] text-md">{text}</p>}
      </div>
      {aside}
    </div>
  );
}

export function BoothCode({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center justify-center rounded-[7px] bg-blue-tint px-2 py-[3px] text-sm font-extrabold text-blue">{children}</span>;
}

export function Kpi({ label, value, note, icon }: { label: string; value: ReactNode; note?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-white p-5">
      <div className="flex items-center justify-between text-sm font-semibold text-muted [&_svg]:size-[18px] [&_svg]:text-blue">
        {label}
        {icon}
      </div>
      <div className="mt-2 text-[1.75rem] font-extrabold tracking-[-0.02em]">{value}</div>
      {note && <div className="mt-1 text-sm text-muted">{note}</div>}
    </div>
  );
}
