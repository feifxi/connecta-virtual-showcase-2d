'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Info, Trophy } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { EmptyState, RoleChip } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { Skeleton, Surface } from '@/components/ui/surface';
import { api } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { toastError } from '@/lib/api/errors';
import { signOut } from '@/lib/auth-client';

/** Email link landing · handles "this invite is for another address" without leaking whether it has an account */
export function InviteCard({ token, signedInAs }: { token: string; signedInAs: string }) {
  const router = useRouter();
  const invite = useQuery({ queryKey: ['invite', token], queryFn: async () => (await api.GET('/api/v1/invites/{token}', { params: { path: { token } } })).data!, retry: false });
  const accept = useMutation({
    mutationFn: async () => (await api.POST('/api/v1/invites/{token}/acceptances', { params: { path: { token } } })).data!,
    onSuccess: (r) => router.push((r.roles.includes('ADMIN') ? `/manage/${r.eventSlug}` : r.roles.includes('PRESENTER') ? `/e/${r.eventSlug}/my-booth` : `/e/${r.eventSlug}/judge`) as Route),
    onError: (e) => toastError(e),
  });

  if (invite.isPending) return <Skeleton className="h-80 rounded-card" />;
  if (invite.isError)
    return (
      <Surface>
        <EmptyState
          title="This invite can't be used"
          text={invite.error instanceof ApiError ? invite.error.userMessage : 'Something went wrong.'}
          action={
            <Button asChild variant="secondary">
              <Link href="/home">Go to my events</Link>
            </Button>
          }
        />
      </Surface>
    );
  const i = invite.data;
  return (
    <Surface className="flex flex-col gap-5 p-7">
      <span className="grid size-[52px] place-items-center rounded-[15px] bg-blue-tint text-blue">
        <Trophy className="size-6" />
      </span>
      <div>
        <p className="text-sm">{i.invitedByName} invited you to</p>
        <h1 className="mb-2.5 mt-1.5 text-[1.9rem]">{i.eventTitle}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {i.roles.map((r) => <RoleChip key={r} role={r} />)}
          {i.projectTitle && <span className="text-sm text-muted">Booth: {i.projectTitle}</span>}
        </div>
      </div>
      {!i.matchesAccount && (
        <div className="flex gap-2.5 rounded-control bg-yellow-tint px-4 py-3.5 text-sm text-ink">
          <Info className="mt-0.5 size-[17px] shrink-0" />
          <span>
            This invite is for <b>{i.maskedEmail}</b>. You&rsquo;re signed in as <b>{signedInAs}</b>.
          </span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {!i.matchesAccount && (
          <Button
            variant="secondary"
            wide
            onClick={async () => {
              await signOut();
              router.push(`/login?next=/invite/${token}` as Route);
            }}
          >
            Switch account
          </Button>
        )}
        <Button wide onClick={() => accept.mutate()} disabled={accept.isPending} className={i.matchesAccount ? 'sm:col-span-2' : ''}>
          {i.matchesAccount ? 'Accept invite' : 'Accept with this account'}
        </Button>
      </div>
      <p className="text-sm">
        {!i.matchesAccount && <>If you accept, future invites to {i.maskedEmail} come to this account. </>}The link works once and expires 14 days after it was sent.
      </p>
    </Surface>
  );
}
