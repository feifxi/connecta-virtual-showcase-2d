'use client';
/* eslint-disable @next/next/no-img-element -- signed URLs */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Calendar, CheckCircle2, Clock, Download, FileText, ImagePlus, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FILE_RULES, type EventDetail, type FileKind, type ProjectDetail } from '@connecta/shared';
import { Portrait, Initials } from '@/components/brand/avatar';
import { BoothCode } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { LivePill, Pill } from '@/components/ui/pill';
import { Surface } from '@/components/ui/surface';
import { Switch } from '@/components/ui/switch';
import { ApiError } from '@/lib/api/client';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { api, multipart } from '@/lib/api/upload';
import { formatDay, relative } from '@/lib/format';
import { cn, withBase } from '@/lib/utils';
import { ZoneDot } from '@/features/projects/project-card';

type FormValues = { title: string; summary: string; tags: string; videoUrl: string; links: { label: string; url: string }[] };
const KIND_LABEL: Record<FileKind, string> = { POSTER: 'Poster', SLIDES: 'Slides', DOC: 'Document for the AI', MODEL_3D: '3D model' };

/** Presenter edits the booth before and during the event · same API as "Edit booth" in the hall */
export function BoothEditor({ event, projectId }: { event: EventDetail; projectId: string }) {
  const client = useQueryClient();
  const q = useQuery({
    queryKey: qk.project(projectId),
    queryFn: async () => {
      const r = await api.GET('/api/v1/projects/{projectId}', { params: { path: { projectId } } });
      return { ...r.data!, etag: r.response.headers.get('etag') };
    },
  });
  const p = q.data;
  const refresh = () => client.invalidateQueries({ queryKey: qk.project(projectId) });
  if (!p) return <div className="h-96 animate-pulse rounded-card bg-subtle" />;
  const after = event.status === 'EXHIBITION' || event.status === 'ARCHIVED';
  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Pill tone="green">Presenter</Pill>
            {p.boothLabel && <BoothCode>Booth {p.boothLabel}</BoothCode>}
            {p.category && (
              <span className="flex items-center gap-1.5 text-sm text-muted">
                <ZoneDot color={p.category.color} />
                {p.category.name} zone
              </span>
            )}
          </div>
          <h1 className="text-[2.1rem]">{after ? 'Your booth after the event' : 'Edit your booth'}</h1>
          <p className="mt-2">Edit any time — before or during the event. Changes show in the hall right away.</p>
        </div>
      </div>
      {after && <PresenterSummary projectId={projectId} />}
      <div className="grid items-start gap-[22px] xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-[22px]">
          <DetailsForm project={p} etag={p.etag} onSaved={refresh} />
          <FilesCard event={event} project={p} onChange={refresh} />
          {event.modules.ai && <AiCard project={p} etag={p.etag} onChange={refresh} />}
        </div>
        <aside className="flex flex-col gap-[22px]">
          <Checklist event={event} project={p} />
          <PreviewCard project={p} />
          <TeamCard project={p} onChange={refresh} />
          <FeedbackCard projectId={projectId} />
          <ContactsCard projectId={projectId} />
        </aside>
      </div>
    </>
  );
}

function DetailsForm({ project: p, etag, onSaved }: { project: ProjectDetail; etag: string | null; onSaved: () => void }) {
  const form = useForm<FormValues>({ defaultValues: { title: p.title, summary: p.summary ?? '', tags: p.tags.join(', '), videoUrl: p.videoUrl ?? '', links: p.links } });
  const links = useFieldArray({ control: form.control, name: 'links' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => form.reset({ title: p.title, summary: p.summary ?? '', tags: p.tags.join(', '), videoUrl: p.videoUrl ?? '', links: p.links }), [p.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: (v: FormValues) =>
      api.PATCH('/api/v1/projects/{projectId}', {
        params: { path: { projectId: p.id } },
        headers: etag ? { 'If-Match': etag } : {},
        body: {
          title: v.title,
          summary: v.summary.trim() || null,
          tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
          videoUrl: v.videoUrl.trim() || null,
          links: v.links.filter((l) => l.label.trim() && l.url.trim()),
        },
      }),
    onSuccess: () => {
      setErrors({});
      toast.success('Booth saved');
      onSaved();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'VALIDATION_FAILED') setErrors(e.fieldErrors());
      else if (e instanceof ApiError && e.code === 'STALE_VERSION') {
        toast.error('A teammate saved changes first. Loading the latest version.');
        onSaved();
      } else toastError(e);
    },
  });
  return (
    <Surface className="p-6">
      <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => save.mutate(v))}>
        <h2 className="text-lg">Booth details</h2>
        <Field label="Project title" htmlFor="title" error={errors.title}>
          <Input id="title" maxLength={160} required {...form.register('title', { required: true })} />
        </Field>
        <Field label="Summary" htmlFor="summary" note="Visitors read this before walking in. 2–3 sentences works best." error={errors.summary}>
          <Textarea id="summary" maxLength={2000} {...form.register('summary')} />
        </Field>
        <Field label="Tags" htmlFor="tags" note="Comma-separated. People search by these." error={errors.tags}>
          <Input id="tags" placeholder="edge AI, accessibility" {...form.register('tags')} />
        </Field>
        <Field label="Demo video" htmlFor="videoUrl" note="YouTube or Vimeo link — we don’t host videos." error={errors.videoUrl}>
          <Input id="videoUrl" type="url" placeholder="https://youtu.be/…" {...form.register('videoUrl')} />
        </Field>
        <div className="flex flex-col gap-2 text-md font-semibold">
          Links
          {links.fields.map((f, i) => (
            <div key={f.id} className="flex gap-2">
              <Input aria-label="Link label" placeholder="GitHub" className="w-1/3" {...form.register(`links.${i}.label`)} />
              <Input aria-label="Link URL" type="url" placeholder="https://…" {...form.register(`links.${i}.url`)} />
              <Button variant="ghost" size="icon" aria-label="Remove link" onClick={() => links.remove(i)}>
                <X />
              </Button>
            </div>
          ))}
          {errors.links && <p className="text-sm font-normal text-red">Check the links: each needs a label and an http(s) URL.</p>}
          {links.fields.length < 10 && (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => links.append({ label: '', url: '' })}>
              <Plus /> Add a link
            </Button>
          )}
        </div>
        <Button type="submit" className="self-start" disabled={save.isPending}>
          <Save /> Save booth
        </Button>
      </form>
    </Surface>
  );
}

function FilesCard({ event, project: p, onChange }: { event: EventDetail; project: ProjectDetail; onChange: () => void }) {
  const [kind, setKind] = useState<FileKind>('POSTER');
  const kinds = (Object.keys(FILE_RULES) as FileKind[]).filter((k) => k !== 'MODEL_3D' || event.modules.model3d);
  const upload = useMutation({
    mutationFn: (file: File) => api.POST('/api/v1/projects/{projectId}/files', { params: { path: { projectId: p.id }, query: { kind, useForAi: kind === 'DOC' ? 'true' : 'false' } }, ...multipart(file) }),
    onSuccess: () => {
      toast.success(kind === 'POSTER' || kind === 'SLIDES' ? 'Uploaded. Pages are being prepared — they appear in a moment.' : 'Uploaded');
      onChange();
      setTimeout(onChange, 4000);
    },
    onError: (e) => toastError(e),
  });
  const cover = useMutation({
    mutationFn: (file: File) => api.PUT('/api/v1/projects/{projectId}/cover', { params: { path: { projectId: p.id } }, ...multipart(file) }),
    onSuccess: onChange,
    onError: (e) => toastError(e),
  });
  const toggleAi = useMutation({
    mutationFn: ({ fileId, on }: { fileId: string; on: boolean }) => api.PATCH('/api/v1/projects/{projectId}/files/{fileId}', { params: { path: { projectId: p.id, fileId } }, body: { useForAi: on } }),
    onSuccess: onChange,
    onError: (e) => toastError(e),
  });
  const remove = useMutation({
    mutationFn: (fileId: string) => api.DELETE('/api/v1/projects/{projectId}/files/{fileId}', { params: { path: { projectId: p.id, fileId } } }),
    onSuccess: onChange,
    onError: (e) => toastError(e),
  });
  const rule = FILE_RULES[kind];
  return (
    <Surface className="p-6">
      <h2 className="mb-4 text-lg">Files</h2>
      <div className="mb-4 flex items-center gap-4">
        <div className="h-20 w-32 shrink-0 overflow-hidden rounded-control bg-subtle">{p.coverUrl ? <img src={p.coverUrl} alt="Cover" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-xs text-muted">No cover</span>}</div>
        <label className="cursor-pointer">
          <span className="inline-flex items-center gap-2 rounded-control border border-input px-3.5 py-2 text-sm font-bold hover:bg-subtle">
            <ImagePlus className="size-4" /> {p.coverUrl ? 'Change cover' : 'Add a cover image'}
          </span>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && cover.mutate(e.target.files[0])} />
          <span className="mt-1 block text-xs text-muted">PNG, JPG or WebP, up to 5 MB</span>
        </label>
      </div>
      {p.files.map((f) => (
        <div key={f.id} className="flex items-center gap-2.5 border-b border-border py-3 text-sm">
          <FileText className="size-[18px] shrink-0 text-blue" />
          <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate font-semibold text-ink hover:text-blue">
            {f.name}
          </a>
          <small className="text-muted">
            {KIND_LABEL[f.kind]}
            {f.pageCount ? ` · ${f.pageCount} p` : (f.kind === 'POSTER' || f.kind === 'SLIDES') && ' · preparing…'}
          </small>
          {f.kind !== 'MODEL_3D' && event.modules.ai && (
            <label className="ml-auto flex items-center gap-1.5 text-xs">
              AI
              <Switch checked={f.useForAi} onCheckedChange={(on) => toggleAi.mutate({ fileId: f.id, on })} aria-label={`Let the AI read ${f.name}`} />
            </label>
          )}
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon" className={cn('size-8', (f.kind === 'MODEL_3D' || !event.modules.ai) && 'ml-auto')} aria-label={`Delete ${f.name}`}>
                <Trash2 />
              </Button>
            }
            title="Delete this file?"
            description="Visitors will no longer see it in your booth."
            confirmLabel="Delete"
            onConfirm={() => remove.mutate(f.id)}
          />
        </div>
      ))}
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-control border-2 border-dashed border-input p-4">
        <Field label="Add a file" htmlFor="kind" className="w-44">
          <NativeSelect id="kind" value={kind} onChange={(e) => setKind(e.target.value as FileKind)}>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="cursor-pointer">
          <span className={cn('inline-flex min-h-11 items-center gap-2 rounded-control bg-blue px-5 text-md font-bold text-white hover:bg-blue-hover', upload.isPending && 'opacity-60')}>
            <Upload className="size-4" /> {upload.isPending ? 'Uploading…' : 'Choose file'}
          </span>
          <input type="file" className="sr-only" accept={rule.mimes.join(',')} disabled={upload.isPending} onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        </label>
        <p className="w-full text-xs text-muted">
          {kind === 'POSTER' ? 'PDF or image' : kind === 'SLIDES' ? 'PDF' : kind === 'DOC' ? 'PDF, TXT or Markdown' : '.glb'} · up to {Math.round(rule.maxBytes / 1048576)} MB · we check the real file type, not the extension.
          {(kind === 'POSTER' || kind === 'SLIDES' || kind === 'MODEL_3D') && ' A new one replaces the old one.'}
        </p>
      </div>
    </Surface>
  );
}

function AiCard({ project: p, etag, onChange }: { project: ProjectDetail; etag: string | null; onChange: () => void }) {
  const [q, setQ] = useState('');
  const toggle = useMutation({
    mutationFn: (on: boolean) => api.PATCH('/api/v1/projects/{projectId}', { params: { path: { projectId: p.id } }, headers: etag ? { 'If-Match': etag } : {}, body: { aiEnabled: on } }),
    onSuccess: onChange,
    onError: (e) => toastError(e),
  });
  const ask = useMutation({ mutationFn: async () => (await api.POST('/api/v1/projects/{projectId}/ai-answers', { params: { path: { projectId: p.id } }, body: { question: q.trim() } })).data!, onError: (e) => toastError(e) });
  return (
    <Surface className="border-0 bg-lavender p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-md text-lavender-ink">
          <Bot className="size-[18px]" /> AI assistant <Pill tone="light">Pro</Pill>
        </h3>
        <Switch checked={p.aiEnabled} onCheckedChange={(on) => toggle.mutate(on)} aria-label="Answer visitors when we're away" />
      </div>
      <p className="mb-3 mt-2 text-sm text-[#685a86]">Answers visitors from the files you mark “AI” when no presenter is in the booth. It says when it doesn&rsquo;t know.</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) ask.mutate();
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try a question before turning it on…" aria-label="Try the AI" className="py-2.5 text-sm" />
        <Button type="submit" size="sm" disabled={!q.trim() || ask.isPending}>
          Ask
        </Button>
      </form>
      {ask.data && <p className="mt-3 whitespace-pre-line rounded-control bg-white p-3 text-sm text-ink-2">{ask.data.answer}</p>}
    </Surface>
  );
}

function Checklist({ event, project: p }: { event: EventDetail; project: ProjectDetail }) {
  const done = p.checklist.filter((c) => c.done).length;
  return (
    <Surface className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-md">Checklist</h3>
        <span className="text-sm text-muted">
          {done} of {p.checklist.length}
        </span>
      </div>
      {p.checklist.map((c) => (
        <div key={c.key} className={cn('flex items-center gap-2.5 border-b border-border py-2.5 text-sm last:border-0', c.done ? 'text-ink' : 'text-muted')}>
          {c.done ? <CheckCircle2 className="size-4 text-green" /> : <Clock className="size-4" />}
          {c.label}
        </div>
      ))}
      {event.boothDeadline && (
        <div className="mt-3 flex gap-2.5 rounded-control bg-yellow-tint px-3.5 py-3 text-sm text-ink">
          <Calendar className="mt-0.5 size-4 shrink-0" />
          <span>
            Organizer&rsquo;s deadline: <b>{formatDay(event.boothDeadline)}</b>. A reminder only — you can still edit during the event.
          </span>
        </div>
      )}
    </Surface>
  );
}

function PreviewCard({ project: p }: { project: ProjectDetail }) {
  const poster = p.files.find((f) => f.kind === 'POSTER');
  return (
    <Surface className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-md">How visitors see it</h3>
        <LivePill className="text-xs">Live when you&rsquo;re inside</LivePill>
      </div>
      <div className="mb-3 aspect-[1.6] overflow-hidden rounded-control bg-blue-tint">
        {poster?.pageUrls[0] ? <img src={poster.pageUrls[0]} alt="" className="size-full object-cover object-top" /> : p.coverUrl ? <img src={p.coverUrl} alt="" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-sm text-blue">Add a poster or cover</span>}
      </div>
      <h3 className="text-base">{p.title}</h3>
      {p.summary && <p className="mt-1 line-clamp-3 text-sm">{p.summary}</p>}
    </Surface>
  );
}

function TeamCard({ project: p, onChange }: { project: ProjectDetail; onChange: () => void }) {
  const [email, setEmail] = useState('');
  const invite = useMutation({
    mutationFn: () => api.POST('/api/v1/projects/{projectId}/invites', { params: { path: { projectId: p.id } }, body: { emails: [email.trim()] } }),
    onSuccess: () => {
      setEmail('');
      toast.success('Invitation sent');
      onChange();
    },
    onError: (e) => toastError(e),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api.DELETE('/api/v1/projects/{projectId}/members/{userId}', { params: { path: { projectId: p.id, userId } } }),
    onSuccess: onChange,
    onError: (e) => toastError(e),
  });
  return (
    <Surface className="p-6">
      <h3 className="mb-2 text-md">Team</h3>
      {p.members.map((m) => (
        <div key={m.userId} className="flex items-center gap-3 border-b border-border py-2.5">
          <Portrait avatar={m.avatarPreset} />
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-sm">{m.displayName}</strong>
            <small className="text-xs text-muted">Presenter</small>
          </span>
          {p.members.length > 1 && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove ${m.displayName}`}>
                  <X />
                </Button>
              }
              title={`Remove ${m.displayName} from the booth?`}
              description="They lose presenter access to this booth."
              confirmLabel="Remove"
              onConfirm={() => remove.mutate(m.userId)}
            />
          )}
        </div>
      ))}
      {p.pendingInvites.map((i) => (
        <div key={i.id} className="flex items-center gap-3 border-b border-border py-2.5">
          <Initials name="?" />
          <span className="min-w-0">
            <strong className="block truncate text-sm">{i.email}</strong>
            <small className="text-xs text-muted">Invitation pending</small>
          </span>
        </div>
      ))}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) invite.mutate();
        }}
      >
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@kmutt.ac.th" aria-label="Teammate's email" className="py-2.5 text-sm" />
        <Button type="submit" size="sm" variant="secondary" disabled={invite.isPending}>
          <Plus /> Invite
        </Button>
      </form>
    </Surface>
  );
}

function FeedbackCard({ projectId }: { projectId: string }) {
  const client = useQueryClient();
  const q = useQuery({ queryKey: qk.feedback(projectId), queryFn: async () => (await api.GET('/api/v1/projects/{projectId}/feedbacks', { params: { path: { projectId } } })).data! });
  const hide = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => api.PATCH('/api/v1/feedbacks/{feedbackId}', { params: { path: { feedbackId: id } }, body: { status: hidden ? 'HIDDEN' : 'VISIBLE' } }),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.feedback(projectId) }),
  });
  return (
    <Surface className="p-6">
      <h3 className="mb-2 text-md">Feedback · only your team and organizers see it</h3>
      {q.data?.map((f) => (
        <div key={f.id} className={cn('border-b border-border py-3 text-sm last:border-0', f.status === 'HIDDEN' && 'opacity-50')}>
          <p className="text-ink-2">{f.text}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted">
            {f.author ? f.author.displayName : 'Anonymous'} · {relative(f.createdAt)}
            <button type="button" className="ml-auto font-bold text-blue" onClick={() => hide.mutate({ id: f.id, hidden: f.status !== 'HIDDEN' })}>
              {f.status === 'HIDDEN' ? 'Show' : 'Hide'}
            </button>
          </div>
        </div>
      ))}
      {q.data?.length === 0 && <p className="text-sm">No feedback yet. Visitors can leave notes from your booth panel.</p>}
    </Surface>
  );
}

function ContactsCard({ projectId }: { projectId: string }) {
  const q = useQuery({ queryKey: qk.contacts(projectId), queryFn: async () => (await api.GET('/api/v1/projects/{projectId}/contact-requests', { params: { path: { projectId } } })).data! });
  return (
    <Surface className="p-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-md">Asked you to contact them</h3>
        <ExportCsv path={`/api/v1/projects/${projectId}/contact-requests.csv`} filename="contact-requests.csv" />
      </div>
      {q.data?.map((c) => (
        <div key={c.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
          <Portrait avatar={c.person.avatarPreset} />
          <span className="min-w-0">
            <strong className="block truncate text-sm">{c.person.displayName}</strong>
            <small className="block truncate text-xs text-muted">
              {[c.person.organization, c.email, c.phone].filter(Boolean).join(' · ')}
            </small>
            {c.message && <small className="block text-xs text-ink-2">“{c.message}”</small>}
          </span>
        </div>
      ))}
      <p className="mt-2 text-sm">Only people who chose to leave their contact appear here.</p>
    </Surface>
  );
}

/** CSV downloads need the user's JWT, so they go through fetch instead of a plain link */
export function ExportCsv({ path, filename, label = 'CSV' }: { path: string; filename: string; label?: string }) {
  const run = async () => {
    try {
      const { data } = await (await import('@/lib/auth-client')).authClient.token();
      const res = await fetch(withBase(path), { headers: { Authorization: `Bearer ${data?.token ?? ''}` } });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement('a'), { href: url, download: filename }).click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed. Try again.');
    }
  };
  return (
    <Button variant="ghost" size="sm" onClick={run}>
      <Download /> {label}
    </Button>
  );
}

/** After the event: stats, and scores + judges' comments once results are announced */
function PresenterSummary({ projectId }: { projectId: string }) {
  const q = useQuery({ queryKey: qk.summary(projectId), queryFn: async () => (await api.GET('/api/v1/projects/{projectId}/summary', { params: { path: { projectId } } })).data! });
  const ai = useMutation({ mutationFn: async () => (await api.GET('/api/v1/projects/{projectId}/feedback-summary', { params: { path: { projectId } } })).data as { summary: string }, onError: (e) => toastError(e) });
  const s = q.data;
  if (!s) return null;
  return (
    <div className="mb-[22px] flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Booth visitors', s.booth.visitors],
          ['Avg. visit', s.booth.avgMinutes ? `${s.booth.avgMinutes.toFixed(1)} min` : '–'],
          ['Feedback', s.feedback.length],
          ['Asked to contact you', s.contactRequests],
        ].map(([k, v]) => (
          <Surface key={k as string} className="p-5">
            <div className="text-sm text-muted">{k}</div>
            <div className="mt-1 text-[1.75rem] font-extrabold">{v}</div>
          </Surface>
        ))}
      </div>
      {s.results ? (
        <Surface className="p-6">
          <h3 className="mb-3 text-md">Judges&rsquo; scores {s.results.awards.length > 0 && <Pill tone="live">🏆 {s.results.awards.map((a) => `${a.kind === 'JUDGES' ? "Judges'" : 'Audience'} #${a.rank}`).join(' · ')}</Pill>}</h3>
          <p className="text-3xl font-extrabold">{s.results.percent?.toFixed(1) ?? '–'} <small className="text-sm text-muted">/ 100</small></p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {s.results.perCriterion.map((c) => (
              <div key={c.name} className="flex justify-between rounded-control bg-subtle px-3 py-2 text-sm">
                {c.name}
                <strong>{c.percent?.toFixed(0) ?? '–'}%</strong>
              </div>
            ))}
          </div>
          {s.results.comments.map((c, i) => (
            <p key={i} className="mt-3 rounded-control border border-border p-3 text-sm text-ink-2">
              “{c}”
            </p>
          ))}
        </Surface>
      ) : (
        <p className="text-sm">Scores and judges&rsquo; comments appear here once the organizer announces the results.</p>
      )}
      <Surface className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-md">Feedback summary</h3>
          <Button size="sm" variant="secondary" onClick={() => ai.mutate()} disabled={ai.isPending}>
            <Bot /> Summarize with AI
          </Button>
        </div>
        {ai.data && <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{ai.data.summary}</p>}
      </Surface>
    </div>
  );
}
