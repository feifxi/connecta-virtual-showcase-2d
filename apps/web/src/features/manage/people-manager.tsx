'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, RotateCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EVENT_ROLES, type EventDetail, type EventRole, type Member } from '@connecta/shared';
import { Portrait } from '@/components/brand/avatar';
import { RoleChip, roleLabel } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, NativeSelect, Textarea } from '@/components/ui/field';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { Pill } from '@/components/ui/pill';
import { Skeleton, Surface } from '@/components/ui/surface';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { formatDay, relative } from '@/lib/format';

const th = 'px-5 py-3';

export function PeopleManager({ event }: { event: EventDetail }) {
  const client = useQueryClient();
  const eventId = event.id;
  const members = useQuery({ queryKey: qk.members(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/members', { params: { path: { eventId } } })).data! });
  const invites = useQuery({ queryKey: qk.invites(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/invites', { params: { path: { eventId } } })).data! });
  const bans = useQuery({ queryKey: qk.bans(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/bans', { params: { path: { eventId } } })).data! });
  const refresh = () => client.invalidateQueries({ queryKey: ['event', eventId] });
  const setRoles = useMutation({
    mutationFn: ({ userId, roles }: { userId: string; roles: EventRole[] }) => api.PUT('/api/v1/events/{eventId}/members/{userId}', { params: { path: { eventId, userId } }, body: { roles } }),
    onSuccess: refresh,
    onError: (e) => toastError(e),
  });
  const remove = useMutation({ mutationFn: (userId: string) => api.DELETE('/api/v1/events/{eventId}/members/{userId}', { params: { path: { eventId, userId } } }), onSuccess: refresh, onError: (e) => toastError(e) });
  const revoke = useMutation({ mutationFn: (inviteId: string) => api.PATCH('/api/v1/events/{eventId}/invites/{inviteId}', { params: { path: { eventId, inviteId } }, body: { status: 'REVOKED' } }), onSuccess: refresh, onError: (e) => toastError(e) });
  const resend = useMutation({
    mutationFn: (i: { email: string; roles: EventRole[]; projectId: string | null }) => api.POST('/api/v1/events/{eventId}/invites', { params: { path: { eventId } }, body: { emails: [i.email], roles: i.roles, projectId: i.projectId ?? undefined } }),
    onSuccess: () => {
      toast.success('Sent again · the old link no longer works');
      refresh();
    },
    onError: (e) => toastError(e),
  });
  const unban = useMutation({ mutationFn: (userId: string) => api.DELETE('/api/v1/events/{eventId}/bans/{userId}', { params: { path: { eventId, userId } } }), onSuccess: refresh, onError: (e) => toastError(e) });
  const pending = invites.data?.filter((i) => i.status === 'PENDING' || i.status === 'EXPIRED') ?? [];

  return (
    <div className="flex flex-col gap-[22px]">
      <Surface>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-5">
          <div>
            <h2 className="text-lg">Your people</h2>
            <p className="mt-1 text-sm">
              Roles come from invitations. One person can hold several. Every invitation reserves a seat
              {members.data && ` · ${members.data.reserved} of ${members.data.capacity} reserved`}.
            </p>
          </div>
          <InviteDialog event={event} onDone={refresh} />
        </div>
        {members.isPending ? (
          <Skeleton className="m-6 h-40" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className={th}>Name</th>
                  <th className={th}>Roles</th>
                  <th className={th}>Since</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {members.data?.data.map((m) => (
                  <MemberRow key={m.userId} m={m} onRoles={(roles) => setRoles.mutate({ userId: m.userId, roles })} onRemove={() => remove.mutate(m.userId)} />
                ))}
                {pending.map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-0">
                    <td className={th}>
                      <span className="text-muted">{i.email}</span>
                      {i.projectTitle && <small className="block text-xs text-muted">Booth: {i.projectTitle}</small>}
                    </td>
                    <td className={th}>
                      <span className="flex gap-1">{i.roles.map((r) => <RoleChip key={r} role={r} />)}</span>
                    </td>
                    <td className={th}>
                      <Pill tone={i.status === 'EXPIRED' ? 'red' : 'light'}>{i.status === 'EXPIRED' ? 'Expired' : event.status === 'DRAFT' ? 'Sent on publish' : `Pending · sent ${relative(i.createdAt)}`}</Pill>
                    </td>
                    <td className={`${th} text-right`}>
                      <Button variant="ghost" size="sm" onClick={() => resend.mutate(i)}>
                        <RotateCw /> Resend
                      </Button>
                      {i.status === 'PENDING' && (
                        <Button variant="ghost" size="sm" onClick={() => revoke.mutate(i.id)}>
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-6 py-4 text-sm">Admins can do everything. The last Admin can&rsquo;t leave — add another Admin first. Presenter roles are tied to a booth: add them from Projects &amp; hall.</p>
      </Surface>
      <Surface className="p-6">
        <h2 className="mb-2 text-lg">Banned from this event</h2>
        {bans.data?.map((b) => (
          <div key={b.person.userId} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
            <Portrait avatar={b.person.avatarPreset} />
            <span className="min-w-0 flex-1">
              <strong className="block text-sm">{b.person.displayName}</strong>
              <small className="text-xs text-muted">
                {b.reason || 'No reason given'} · by {b.bannedBy.displayName}, {formatDay(b.createdAt)}
              </small>
            </span>
            <Button variant="secondary" size="sm" onClick={() => unban.mutate(b.person.userId)}>
              Lift ban
            </Button>
          </div>
        ))}
        {bans.data?.length === 0 && <p className="text-sm">Nobody is banned.</p>}
        <p className="mt-3 text-sm">Banned people can&rsquo;t enter this event again. Other events aren&rsquo;t affected.</p>
      </Surface>
    </div>
  );
}

function MemberRow({ m, onRoles, onRemove }: { m: Member; onRoles: (r: EventRole[]) => void; onRemove: () => void }) {
  const toggle = (r: EventRole) => onRoles(m.roles.includes(r) ? m.roles.filter((x) => x !== r) : [...m.roles, r]);
  return (
    <tr className="border-b border-border last:border-0">
      <td className={th}>
        <span className="flex items-center gap-3">
          <Portrait avatar={m.avatarPreset} size={32} />
          <span>
            <strong className="block text-ink">{m.displayName}</strong>
            <small className="text-xs text-muted">{m.email}</small>
          </span>
        </span>
      </td>
      <td className={th}>
        <span className="flex flex-wrap gap-1">{m.roles.map((r) => <RoleChip key={r} role={r} />)}</span>
      </td>
      <td className={`${th} text-muted`}>{formatDay(m.assignedAt)}</td>
      <td className={`${th} text-right`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Manage ${m.displayName}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Roles</DropdownMenuLabel>
            {(['ADMIN', 'JUDGE'] as const).map((r) => (
              <DropdownMenuItem key={r} onSelect={() => toggle(r)}>
                {m.roles.includes(r) ? `Remove ${roleLabel(r)}` : `Make ${roleLabel(r)}`}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={onRemove}>
              Remove all roles
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

function InviteDialog({ event, onDone }: { event: EventDetail; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState('');
  const [role, setRole] = useState<EventRole>('JUDGE');
  const send = useMutation({
    mutationFn: () => api.POST('/api/v1/events/{eventId}/invites', { params: { path: { eventId: event.id } }, body: { emails: emails.split(/[\s,;]+/).filter(Boolean), roles: [role] } }),
    onSuccess: (r) => {
      toast.success(r.data?.sent ? `${r.data.count} invitation(s) sent` : `${r.data?.count} invitation(s) saved · sent when you publish`);
      setEmails('');
      setOpen(false);
      onDone();
    },
    onError: (e) => toastError(e),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent title="Invite people" description="They get an email link. Invited roles always get in, even when the hall is full or locked to a domain.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            send.mutate();
          }}
        >
          <Field label="Role" htmlFor="inv-role" note={role === 'JUDGE' && event.plan === 'FREE' ? 'Free plan: up to 5 judges.' : role === 'ADMIN' ? 'Admins can do everything. We suggest 2–3.' : undefined}>
            <NativeSelect id="inv-role" value={role} onChange={(e) => setRole(e.target.value as EventRole)}>
              {EVENT_ROLES.filter((r) => r !== 'PRESENTER').map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Emails" htmlFor="inv-emails" note="One per line or comma-separated.">
            <Textarea id="inv-emails" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="pim.r@kmutt.ac.th" required />
          </Field>
          <Button type="submit" disabled={!emails.trim() || send.isPending}>
            Send invitations
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
