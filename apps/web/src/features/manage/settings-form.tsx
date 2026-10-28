'use client';
/* eslint-disable @next/next/no-img-element -- signed URLs */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, ImagePlus, Plus, Trash2 } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PLAN_LIMITS, type EventDetail, type FormField, type ModuleKey } from '@connecta/shared';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Checkbox, Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { Surface } from '@/components/ui/surface';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api/client';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { api, multipart } from '@/lib/api/upload';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { withBase } from '@/lib/utils';
import { useAdminEvent } from './use-event';

const MODULES: { key: ModuleKey; label: string; text: string; pro?: boolean }[] = [
  { key: 'judging', label: 'Judging', text: 'One rubric, judges score in the booth' },
  { key: 'popularVote', label: 'Popular Vote', text: 'Visitors vote for projects they visited' },
  { key: 'feedback', label: 'Feedback', text: 'Notes for teams during and after the event' },
  { key: 'ai', label: 'AI booth assistant', text: "Answers from the team's files when they're away", pro: true },
  { key: 'model3d', label: '3D model viewer', text: 'Teams can add a .glb model to their booth' },
];

export function SettingsForm({ initial }: { initial: EventDetail }) {
  const { event, refresh } = useAdminEvent(initial);
  const router = useRouter();
  const [v, setV] = useState({
    title: event.title,
    description: event.description,
    startsAt: toLocalInput(event.startsAt),
    endsAt: toLocalInput(event.endsAt),
    hallOpenMode: event.hallOpenMode,
    capacity: event.capacity,
    allowedDomain: event.allowedDomain ?? '',
    boothDeadline: event.boothDeadline ? toLocalInput(event.boothDeadline) : '',
    agenda: event.agenda,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: () =>
      api.PATCH('/api/v1/events/{eventId}', {
        params: { path: { eventId: event.id } },
        body: {
          title: v.title,
          description: v.description,
          startsAt: fromLocalInput(v.startsAt),
          endsAt: fromLocalInput(v.endsAt),
          hallOpenMode: v.hallOpenMode,
          capacity: Number(v.capacity),
          allowedDomain: v.allowedDomain.replace(/^@/, '').trim() || null,
          boothDeadline: v.boothDeadline ? fromLocalInput(v.boothDeadline) : null,
          agenda: v.agenda.filter((a) => a.time.trim() && a.title.trim()),
        },
      }),
    onSuccess: () => {
      setErrors({});
      toast.success('Settings saved');
      refresh();
      router.refresh();
    },
    onError: (e) => (e instanceof ApiError && e.code === 'VALIDATION_FAILED' ? setErrors(e.fieldErrors()) : toastError(e)),
  });
  const modules = useMutation({
    mutationFn: (m: Partial<Record<ModuleKey, boolean>>) => api.PATCH('/api/v1/events/{eventId}', { params: { path: { eventId: event.id } }, body: { modules: m } }),
    onSuccess: () => {
      refresh();
      router.refresh();
    },
    onError: (e) => toastError(e),
  });
  const cover = useMutation({ mutationFn: (f: File) => api.PUT('/api/v1/events/{eventId}/cover', { params: { path: { eventId: event.id } }, ...multipart(f) }), onSuccess: refresh, onError: (e) => toastError(e) });
  const copy = useMutation({
    mutationFn: async () => (await api.POST('/api/v1/events/{eventId}/copies', { params: { path: { eventId: event.id } } })).data!,
    onSuccess: (r) => router.push(`/manage/${r.slug}/settings` as Route),
    onError: (e) => toastError(e),
  });
  const [confirm, setConfirm] = useState('');
  const del = useMutation({
    mutationFn: () => api.DELETE('/api/v1/events/{eventId}', { params: { path: { eventId: event.id }, query: { confirm } } }),
    onSuccess: () => router.push('/home'),
    onError: (e) => toastError(e),
  });
  const limit = PLAN_LIMITS[event.plan].capacity;
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV({ ...v, [k]: val });
  const beforeOpen = event.status === 'DRAFT' || event.status === 'PUBLISHED';

  return (
    <div className="grid items-start gap-[22px] xl:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-[22px]">
        <Surface className="p-6">
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <h2 className="text-lg">Event</h2>
            <Field label="Event name" htmlFor="s-title" error={errors.title}>
              <Input id="s-title" value={v.title} onChange={(e) => set('title', e.target.value)} maxLength={120} />
            </Field>
            <Field label="Description" htmlFor="s-desc" error={errors.description}>
              <Textarea id="s-desc" value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={4000} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts (Bangkok time)" htmlFor="s-start" error={errors.startsAt}>
                <Input id="s-start" type="datetime-local" value={v.startsAt} disabled={!beforeOpen} onChange={(e) => set('startsAt', e.target.value)} />
              </Field>
              <Field label="Ends" htmlFor="s-end" note="The event ends by itself at this time." error={errors.endsAt}>
                <Input id="s-end" type="datetime-local" value={v.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hall opens" htmlFor="s-mode">
                <NativeSelect id="s-mode" value={v.hallOpenMode} disabled={!beforeOpen} onChange={(e) => set('hallOpenMode', e.target.value as 'SCHEDULE' | 'MANUAL')}>
                  <option value="SCHEDULE">At the start time</option>
                  <option value="MANUAL">When I open it</option>
                </NativeSelect>
              </Field>
              <Field label="People in the hall at once" htmlFor="s-cap" note={`Up to ${limit} on ${event.plan === 'PRO' ? 'Pro' : 'Free'}. Invited people hold reserved seats.`} error={errors.capacity}>
                <Input id="s-cap" type="number" min={2} max={limit} value={v.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
              </Field>
            </div>
            <Field label="Only visitors from (optional)" htmlFor="s-domain" note="e.g. kmutt.ac.th · invited presenters and judges always get in." error={errors.allowedDomain}>
              <Input id="s-domain" value={v.allowedDomain} onChange={(e) => set('allowedDomain', e.target.value)} placeholder="kmutt.ac.th" />
            </Field>
            <Field label="Booth deadline (reminder only)" htmlFor="s-deadline">
              <Input id="s-deadline" type="datetime-local" value={v.boothDeadline} onChange={(e) => set('boothDeadline', e.target.value)} />
            </Field>
            <div className="flex flex-col gap-2 text-md font-semibold">
              Agenda
              {v.agenda.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <Input aria-label="Time" value={a.time} onChange={(e) => set('agenda', v.agenda.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} className="w-24" placeholder="10:00" />
                  <Input aria-label="What happens" value={a.title} onChange={(e) => set('agenda', v.agenda.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => set('agenda', v.agenda.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="self-start" onClick={() => set('agenda', [...v.agenda, { time: '', title: '' }])}>
                <Plus /> Add a line
              </Button>
            </div>
            <Button type="submit" className="self-start" disabled={save.isPending}>
              Save settings
            </Button>
          </form>
        </Surface>
        <FormBuilder event={event} kind="join" title="Join form questions" note="Asked once when people first enter. Name, visitor type and the marketing consent are always there." />
        <FormBuilder event={event} kind="survey" title="Survey after the event" note="Asked once when people leave the hall, and after the event." />
      </div>
      <aside className="flex flex-col gap-[22px]">
        <Surface className="p-6">
          <h2 className="mb-3 text-lg">Cover</h2>
          <div className="mb-3 aspect-video overflow-hidden rounded-control bg-subtle">{event.coverUrl ? <img src={event.coverUrl} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-sm text-muted">No cover</span>}</div>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 rounded-control border border-input px-3.5 py-2 text-sm font-bold hover:bg-subtle">
              <ImagePlus className="size-4" /> Upload a cover
            </span>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && cover.mutate(e.target.files[0])} />
          </label>
          <p className="mt-2 text-xs text-muted">16:9 works best · up to 5 MB.</p>
        </Surface>
        <Surface className="p-6">
          <h2 className="mb-2 text-lg">Features</h2>
          {MODULES.map((m) => (
            <label key={m.key} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
              <span>
                <strong className="block text-md">
                  {m.label} {m.pro && <Pill tone="lavender">Pro</Pill>}
                </strong>
                <span className="text-sm text-muted">{m.text}</span>
              </span>
              <Switch checked={event.modules[m.key]} disabled={m.pro && event.plan === 'FREE'} onCheckedChange={(on) => modules.mutate({ [m.key]: on })} aria-label={m.label} />
            </label>
          ))}
          <p className="mt-2 text-sm">Turning a feature off removes it from every page and the hall.</p>
        </Surface>
        <Surface className="p-6">
          <h2 className="mb-2 text-lg">Link</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(`${location.origin}${withBase(`/e/${event.slug}`)}`);
              toast.success('Link copied');
            }}
          >
            <Copy /> Copy event link
          </Button>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => copy.mutate()} disabled={copy.isPending}>
            Duplicate this event
          </Button>
        </Surface>
        <Surface className="border-[#f3c0b6] p-6">
          <h2 className="mb-2 text-lg text-red">Delete event</h2>
          <p className="text-sm">Removes the hall, projects, scores, analytics and files for good. Type the event name to confirm.</p>
          <div className="mt-3 flex gap-2">
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={event.title} aria-label="Type the event name" className="py-2 text-sm" />
            <ConfirmDialog
              trigger={
                <Button variant="danger" size="sm" disabled={confirm.trim() !== event.title.trim()}>
                  Delete
                </Button>
              }
              title="Delete this event forever?"
              description="This can't be undone."
              confirmLabel="Delete event"
              onConfirm={() => del.mutate()}
            />
          </div>
        </Surface>
      </aside>
    </div>
  );
}

/** Same structure for both forms · every question must say what the answer is used for (PDPA) */
function FormBuilder({ event, kind, title, note }: { event: EventDetail; kind: 'join' | 'survey'; title: string; note: string }) {
  const client = useQueryClient();
  const q = useQuery({ queryKey: qk.form(event.id, kind), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/forms/{kind}', { params: { path: { eventId: event.id, kind } } })).data! });
  const [fields, setFields] = useState<FormField[] | null>(null);
  const list = fields ?? q.data?.fields ?? [];
  const save = useMutation({
    mutationFn: () => api.PUT('/api/v1/events/{eventId}/forms/{kind}', { params: { path: { eventId: event.id, kind } }, body: { fields: list } }),
    onSuccess: () => {
      toast.success('Questions saved');
      setFields(null);
      client.invalidateQueries({ queryKey: qk.form(event.id, kind) });
    },
    onError: (e) => toastError(e),
  });
  const update = (i: number, patch: Partial<FormField>) => setFields(list.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const add = () => setFields([...list, { id: `q${Date.now().toString(36)}`, type: kind === 'survey' && !list.length ? 'rating' : 'short_text', label: kind === 'survey' && !list.length ? 'How satisfied were you with the event?' : '', required: false, purpose: '' }]);
  return (
    <Surface className="p-6">
      <h2 className="mb-1 text-lg">{title}</h2>
      <p className="mb-3 text-sm">{note}</p>
      {list.map((f, i) => (
        <div key={f.id} className="mb-3 flex flex-col gap-2 rounded-control border border-border p-3">
          <div className="flex gap-2">
            <Input aria-label="Question" value={f.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Question" className="py-2 text-sm" />
            <NativeSelect aria-label="Answer type" value={f.type} onChange={(e) => update(i, { type: e.target.value as FormField['type'] })} className="w-36 px-2 py-2 text-sm">
              <option value="short_text">Short text</option>
              <option value="single">One choice</option>
              <option value="multi">Several choices</option>
              <option value="rating">Rating 1–5</option>
            </NativeSelect>
            <Button variant="ghost" size="icon" aria-label="Remove question" onClick={() => setFields(list.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
          {(f.type === 'single' || f.type === 'multi') && (
            <Input aria-label="Choices" value={(f.options ?? []).join(', ')} onChange={(e) => update(i, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })} placeholder="Choices, comma-separated" className="py-2 text-sm" />
          )}
          <Input aria-label="Used for" value={f.purpose} onChange={(e) => update(i, { purpose: e.target.value })} placeholder="Used for… (shown to people, required by PDPA)" className="py-2 text-sm" />
          <Checkbox label="Required" checked={f.required} onChange={(e) => update(i, { required: e.target.checked })} />
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={add}>
          <Plus /> Add a question
        </Button>
        {fields && (
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || list.some((f) => !f.label.trim() || !f.purpose.trim())}>
            Save questions
          </Button>
        )}
      </div>
    </Surface>
  );
}
