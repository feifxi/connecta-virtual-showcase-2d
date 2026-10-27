import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/session';
import { cn } from '@/lib/utils';
import { Brand } from '../brand/brand';
import { AccountMenu } from './account-menu';
import { NotificationsButton } from './notifications';

const LINKS = [
  { label: 'Events', href: '/explore' },
  { label: 'My events', href: '/home' },
  { label: 'Host an event', href: '/manage/new' },
] as const;

export type NavKey = (typeof LINKS)[number]['label'];

export async function SiteHeader({ active, transparent }: { active?: NavKey; transparent?: boolean }) {
  const session = await getSession();
  const user = session?.user as (NonNullable<typeof session>['user'] & { displayName?: string; avatarPreset?: number; appRole?: string }) | undefined;
  return (
    <header className={cn(!transparent && 'border-b border-border bg-white')}>
      <nav className="container-page flex h-[72px] items-center gap-6 md:h-20 md:gap-12" aria-label="Main navigation">
        <Brand />
        <div className="hidden items-center gap-7 text-md font-semibold text-muted md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn('relative whitespace-nowrap py-[26px] transition-colors hover:text-blue', active === l.label && 'text-blue after:absolute after:inset-x-0 after:bottom-3 after:h-[3px] after:rounded after:bg-blue')}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {user ? (
            <>
              <NotificationsButton />
              <span className="mx-1 hidden h-7 w-px bg-border sm:block" />
              <AccountMenu name={user.displayName || user.name} email={user.email} avatar={user.avatarPreset ?? null} platformAdmin={user.appRole === 'PLATFORM_ADMIN'} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" className="px-3">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="hidden sm:inline-flex">
                <Link href="/login?next=/manage/new">Create event</Link>
              </Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
