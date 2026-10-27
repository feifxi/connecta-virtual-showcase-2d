'use client';
import { ChevronDown, LayoutGrid, LogOut, Plus, Shield, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Portrait } from '@/components/brand/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { clearApiToken } from '@/lib/api/browser';
import { signOut } from '@/lib/auth-client';

export function AccountMenu({ name, email, avatar, platformAdmin }: { name: string; email: string; avatar: number | null; platformAdmin: boolean }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full" aria-label="Open your account menu">
        <Portrait avatar={avatar} size={36} className="rounded-full bg-lavender" />
        <ChevronDown className="size-4 text-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block normal-case tracking-normal text-ink">{name}</span>
          <span className="block font-medium normal-case tracking-normal">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/home">
            <LayoutGrid /> My events
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/manage/new">
            <Plus /> Create event
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound /> Profile
          </Link>
        </DropdownMenuItem>
        {platformAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/platform">
              <Shield /> Platform console
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            clearApiToken();
            await signOut();
            router.push('/');
            router.refresh();
          }}
        >
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
