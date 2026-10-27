'use client';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type WorkspaceLink = { label: string; href: string; icon: ReactNode; exact?: boolean };

/** Sidebar + main column for Admin / Presenter / Judge pages · the sidebar becomes a scrollable tab row on phones */
export function WorkspaceShell({ caption, links, aside, children }: { caption: string; links: WorkspaceLink[]; aside?: ReactNode; children: ReactNode }) {
  const path = usePathname();
  const isActive = (l: WorkspaceLink) => (l.exact ? path === l.href : path === l.href || path.startsWith(`${l.href}/`));
  return (
    <div className="grid min-h-[calc(100dvh-80px)] md:grid-cols-[215px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-white px-3 py-3 md:border-b-0 md:border-r md:px-[18px] md:pb-24 md:pt-7">
        <div className="mb-3 hidden px-[13px] text-xs text-muted md:block">{caption}</div>
        <nav className="flex gap-1 overflow-x-auto md:block" aria-label={caption}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href as Route}
              aria-current={isActive(l) ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-[11px] whitespace-nowrap rounded-[10px] px-[13px] py-[11px] text-sm font-semibold text-muted hover:bg-subtle md:mb-1 [&_svg]:size-[18px]',
                isActive(l) && 'bg-blue-tint text-blue hover:bg-blue-tint',
              )}
            >
              {l.icon}
              <span>{l.label}</span>
            </Link>
          ))}
        </nav>
        {aside && <div className="mt-[22px] hidden border-t border-border px-[13px] py-4 md:block">{aside}</div>}
      </aside>
      <main id="main" className="mx-auto w-full min-w-0 max-w-[1450px] animate-page-in px-4 pb-24 pt-8 md:px-10">
        {children}
      </main>
    </div>
  );
}
