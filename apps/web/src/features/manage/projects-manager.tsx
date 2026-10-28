'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Bot, Download, FileUp, Plus, Shuffle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { HALL_PRESET_INFO, HALL_PRESETS, ZONE_COLORS, ZONE_HEX, type EventDetail, type HallData, type HallPreset, type ZoneColor } from '@connecta/shared';
import { BoothCode, EmptyState } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { Skeleton, Surface } from '@/components/ui/surface';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExportCsv } from '@/features/booth/booth-editor';
import { ZoneDot } from '@/features/projects/project-card';
import { ApiError } from '@/lib/api/client';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { api, multipart } from '@/lib/api/upload';
import { cn } from '@/lib/utils';
import { useAdminEvent } from './use-event';

export function ProjectsManager({ initial }: { initial: EventDetail }) {
  const { event, refresh } = useAdminEvent(initial);
  const client = useQueryClient();
  const eventId = event.id;
  const hall = useQuery({ queryKey: qk.hall(eventId), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/hall', { params: { path: { eventId } } })).data! });
  const reload = () => {
    client.invalidateQueries({ queryKey: ['event', eventId] });
    refresh();
  };
  const beforeOpen = event.status === 'DRAFT' || event.status === 'PUBLISHED';

  const submissions = useMutation({
    mutationFn: (on: boolean) => api.PATCH('/api/v1/events/{eventId}', { params: { path: { eventId } }, body: { submissionsOpen: on } }),
    onSuccess: refresh,
    onError: (e) => toastError(e),
  });
  const preset = useMutation({
    mutationFn: (p: HallPreset) => api.PATCH('/api/v1/events/{eventId}/hall', { params: { path: { eventId } }, body: { preset: p } }),
    onSuccess: reload,
    onError: (e) => toastError(e),
  });
  const arrange = useMutation({ mutationFn: () => api.POST('/api/v1/events/{eventId}/hall/arrangements', { params: { path: { eventId } } }), onSuccess: reload, onError: (e) => toastError(e) });
  const place = useMutation({
    mutationFn: (placements: { projectId: string; boothSlotId: string | null }[]) => api.PUT('/api/v1/events/{eventId}/hall/placements', { params: { path: { eventId } }, body: { placements } }),
    onSuccess: reload,
    onError: (e) => toastError(e),
  });
  const setCategory = useMutation({
    mutationFn: ({ projectId, categoryId }: { projectId: string; categoryId: string | null }) => api.PATCH('/api/v1/projects/{projectId}', { params: { path: { projectId } }, body: { categoryId } }),
    onSuccess: reload,
    onError: (e) => toastError(e),
  });
  const remove = useMutation({ mutationFn: (projectId: string) => api.DELETE('/api/v1/projects/{projectId}', { params: { path: { projectId } } }), onSuccess: reload, onError: (e) => toastError(e) });

  const h = hall.data;
  if (!h) return <Skeleton className="h-96 rounded-card" />;
  const slotById = new Map(h.slots.map((s) => [s.id, s]));
  const freeSlots = h.slots.filter((s) => !s.projectId);
  const short = h.blocks.needed > h.blocks.available;

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="grid items-start gap-[22px] xl:grid-cols-[1fr_1fr]">
        <Surface className="p-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg">Your hall</h2>
            {beforeOpen && (
              <Button size="sm" variant="secondary" onClick={() => arrange.mutate()} disabled={arrange.isPending}>
                <Shuffle /> Auto-arrange
              </Button>
            )}
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            {HALL_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={!beforeOpen || preset.isPending}
                aria-pressed={h.preset === p}
                onClick={() => h.preset !== p && preset.mutate(p)}
                className={cn('rounded-control border-2 border-border p-3 text-left text-sm disabled:cursor-not-allowed', h.preset === p && 'border-blue bg-blue-tint')}
              >
                <strong className="block">
                  {HALL_PRESET_INFO[p].label} · {HALL_PRESET_INFO[p].booths} booths
                </strong>
                <span className="text-xs text-muted">{HALL_PRESET_INFO[p].description}</span>
              </button>
            ))}
          </div>
          <HallMap hall={h} />
          {short && (
            <div className="mt-3 flex gap-2.5 rounded-control bg-yellow-tint px-3.5 py-3 text-sm text-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange" />
              Your categories need {h.blocks.needed} zones but this hall has {h.blocks.available}. Choose a bigger preset or merge categories.
            </div>
          )}
          {h.unplacedProjectIds.length > 0 && <p className="mt-3 text-sm text-red">{h.unplacedProjectIds.length} project(s) have no booth spot yet.</p>}
          <p className="mt-3 text-sm">{beforeOpen ? 'Booths place themselves by category (one zone per category). You can swap spots below until the hall opens.' : 'The layout is fixed now that the hall is open. New booths go into a free spot in their zone without moving anyone.'}</p>
        </Surface>
        <Categories event={event} onChange={reload} />
      </div>

      <Surface>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-5">
          <div>
            <h2 className="text-lg">Projects · {h.projects.length}</h2>
            <p className="mt-1 text-sm">Only the skeleton: title, category, member emails. Presenters fill in the rest themselves.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="mr-2 flex items-center gap-2 text-sm">
              Submission form
              <Switch checked={event.submissionsOpen} onCheckedChange={(v) => submissions.mutate(v)} aria-label="Let presenters submit projects" />
            </label>
            <ImportDialog event={event} onDone={reload} />
            <AddProjectDialog event={event} onDone={reload} />
          </div>
        </div>
        {event.submissionsOpen && (
          <p className="mx-6 mb-4 rounded-control bg-blue-tint px-4 py-3 text-sm text-blue">
            Submissions are open: anyone signed in can add a project from the event page and becomes its presenter.
          </p>
        )}
        {h.projects.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-6 py-3">Spot</th>
                  <th className="px-6 py-3">Project</th>
                  {event.categories.length > 0 && <th className="px-6 py-3">Category</th>}
                  <th className="px-6 py-3">Team</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {h.projects.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-3">
                      {beforeOpen ? (
                        <NativeSelect
                          aria-label={`Booth spot for ${p.title}`}
                          className="w-28 px-2 py-1.5 text-sm"
                          value={p.boothSlotId ?? ''}
                          onChange={(e) => {
                            const to = e.target.value || null;
                            const other = h.projects.find((x) => x.boothSlotId === to);
                            // swap with whoever is there
                            place.mutate([{ projectId: p.id, boothSlotId: to }, ...(other ? [{ projectId: other.id, boothSlotId: p.boothSlotId }] : [])]);
                          }}
                        >
                          <option value="">None</option>
                          {h.slots.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                                {s.projectId && s.id !== p.boothSlotId ? ' (swap)' : ''}
                              </option>
                          ))}
                        </NativeSelect>
                      ) : p.boothSlotId ? (
                        <BoothCode>{slotById.get(p.boothSlotId)?.label}</BoothCode>
                      ) : (
                        <Pill tone="red">No spot</Pill>
                      )}
                    </td>
                    <td className="px-6 py-3 font-semibold text-ink">{p.title}</td>
                    {event.categories.length > 0 && (
                      <td className="px-6 py-3">
                        <NativeSelect aria-label={`Category of ${p.title}`} className="w-40 px-2 py-1.5 text-sm" value={p.category?.id ?? ''} onChange={(e) => setCategory.mutate({ projectId: p.id, categoryId: e.target.value || null })}>
                          {event.categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </NativeSelect>
                      </td>
                    )}
                    <td className="px-6 py-3 text-muted">{p.members.map((m) => m.displayName).join(', ') || 'Invite pending'}</td>
                    <td className="px-6 py-3 text-right">
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon" className="size-8" aria-label={`Delete ${p.title}`}>
                            <Trash2 />
                          </Button>
                        }
                        title={`Delete “${p.title}”?`}
                        description="Its booth, files, feedback and scores are removed."
                        confirmLabel="Delete project"
                        onConfirm={() => remove.mutate(p.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No projects yet" text="Add them one by one, import a CSV/XLSX, or open the submission form." />
        )}
        {freeSlots.length > 0 && <p className="px-6 py-3 text-xs text-muted">{freeSlots.length} free booth spots left.</p>}
      </Surface>
    </div>
  );
}

/** Mini map: every slot, coloured by the zone of the booth placed there */
function HallMap({ hall }: { hall: HallData }) {
  const byProject = new Map(hall.projects.map((p) => [p.id, p]));
  const blocks = [...new Set(hall.slots.map((s) => s.block))];
  return (
    <div className="flex flex-wrap gap-3 rounded-control bg-subtle p-3" aria-label="Booth spots by zone">
      {blocks.map((b) => (
        <div key={b} className="grid grid-cols-6 gap-1">
          {hall.slots
            .filter((s) => s.block === b)
            .map((s) => {
              const p = s.projectId ? byProject.get(s.projectId) : undefined;
              return <span key={s.id} title={p ? `${s.label} · ${p.title}` : `${s.label} · free`} className="grid h-6 w-7 place-items-center rounded text-[10px] font-bold text-white" style={{ background: p ? ZONE_HEX[(p.category?.color ?? 'neutral') as ZoneColor] : '#d6dcea' }}>{s.label}</span>;
            })}
        </div>
      ))}
    </div>
  );
}

function Categories({ event, onChange }: { event: EventDetail; onChange: () => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<ZoneColor>(ZONE_COLORS[event.categories.length % ZONE_COLORS.length]!);
  const add = useMutation({
    mutationFn: () => api.POST('/api/v1/events/{eventId}/categories', { params: { path: { eventId: event.id } }, body: { name: name.trim(), color } }),
    onSuccess: () => {
      setName('');
      onChange();
    },
    onError: (e) => toastError(e),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string; color?: ZoneColor } }) => api.PATCH('/api/v1/events/{eventId}/categories/{categoryId}', { params: { path: { eventId: event.id, categoryId: id } }, body }),
    onSuccess: onChange,
    onError: (e) => toastError(e),
  });
  const remove = useMutation({ mutationFn: (id: string) => api.DELETE('/api/v1/events/{eventId}/categories/{categoryId}', { params: { path: { eventId: event.id, categoryId: id } } }), onSuccess: onChange, onError: (e) => toastError(e) });
  return (
    <Surface className="p-6">
      <h2 className="mb-1 text-lg">Categories = zones</h2>
      <p className="mb-3 text-sm">Optional. Each category gets its own zone and carpet colour. Without categories, booths share one colour in list order.</p>
      {event.categories.map((c) => (
        <div key={c.id} className="flex items-center gap-2 border-b border-border py-2">
          <NativeSelect aria-label={`Colour of ${c.name}`} className="w-24 px-2 py-1.5 text-sm" value={c.color} onChange={(e) => update.mutate({ id: c.id, body: { color: e.target.value as ZoneColor } })}>
            {ZONE_COLORS.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </NativeSelect>
          <ZoneDot color={c.color} />
          <Input aria-label="Category name" defaultValue={c.name} className="py-1.5 text-sm" onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && update.mutate({ id: c.id, body: { name: e.target.value.trim() } })} />
          <span className="w-16 shrink-0 text-xs text-muted">{c.projectCount} projects</span>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label={`Delete ${c.name}`} disabled={c.projectCount > 0} onClick={() => remove.mutate(c.id)}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) add.mutate();
        }}
      >
        <NativeSelect aria-label="Colour" className="w-24 px-2 py-2 text-sm" value={color} onChange={(e) => setColor(e.target.value as ZoneColor)}>
          {ZONE_COLORS.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </NativeSelect>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Computing" aria-label="New category" className="py-2 text-sm" maxLength={40} />
        <Button type="submit" size="sm" variant="secondary" disabled={!name.trim()}>
          <Plus /> Add
        </Button>
      </form>
    </Surface>
  );
}

function AddProjectDialog({ event, onDone }: { event: EventDetail; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(event.categories[0]?.id ?? '');
  const [emails, setEmails] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: () =>
      api.POST('/api/v1/events/{eventId}/projects', {
        params: { path: { eventId: event.id } },
        body: { title: title.trim(), categoryId: categoryId || null, memberEmails: emails.split(/[\s,;]+/).filter(Boolean) },
      }),
    onSuccess: () => {
      toast.success(event.status === 'DRAFT' ? 'Project added · presenters are invited when you publish' : 'Project added · presenters invited');
      setTitle('');
      setEmails('');
      setOpen(false);
      onDone();
    },
    onError: (e) => (e instanceof ApiError && e.code === 'VALIDATION_FAILED' ? setErrors(e.fieldErrors()) : toastError(e)),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Add project
        </Button>
      </DialogTrigger>
      <DialogContent title="Add a project" description="A booth is placed for it at once, in its category's zone.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            create.mutate();
          }}
        >
          <Field label="Project title" htmlFor="p-title" error={errors.title}>
            <Input id="p-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required />
          </Field>
          {event.categories.length > 0 && (
            <Field label="Category" htmlFor="p-cat" error={errors.categoryId}>
              <NativeSelect id="p-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {event.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label="Member emails" htmlFor="p-emails" note="They get a Presenter invite for this booth. Separate with commas or new lines." error={errors.memberEmails}>
            <Textarea id="p-emails" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder={'mika@kmutt.ac.th\nren@kmutt.ac.th'} className="min-h-[80px]" />
          </Field>
          <Button type="submit" disabled={create.isPending || !title.trim()}>
            Add project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** CSV / XLSX, or paste anything and let the AI read it (Pro) · always a preview to check before saving */
function ImportDialog({ event, onDone }: { event: EventDetail; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<'file' | 'ai'>('file');
  const run = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const query = { dryRun: dryRun ? ('true' as const) : ('false' as const) };
      const r =
        mode === 'file' && file
          ? await api.POST('/api/v1/events/{eventId}/project-imports', { params: { path: { eventId: event.id }, query }, ...multipart(file) })
          : await api.POST('/api/v1/events/{eventId}/project-imports', { params: { path: { eventId: event.id }, query }, body: { text } as never });
      return r.data!;
    },
    onSuccess: (r, dryRun) => {
      if (!dryRun) {
        toast.success(`${r.created} projects added`);
        setOpen(false);
        onDone();
      }
    },
    onError: (e) => toastError(e),
  });
  const preview = run.data && run.variables === true ? run.data : null;
  const valid = preview?.rows.filter((r) => !r.errors.length).length ?? 0;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) run.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <FileUp /> Import
        </Button>
      </DialogTrigger>
      <DialogContent title="Import projects" description="Title, category and member emails per project. You'll check the table before anything is saved." wide>
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'file' | 'ai')}>
          <TabsList className="mb-4">
            <TabsTrigger value="file">CSV / XLSX</TabsTrigger>
            <TabsTrigger value="ai" disabled={!event.modules.ai}>
              Paste anything (AI) {event.plan === 'FREE' && <Pill className="ml-1 text-xs">Pro</Pill>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="flex flex-col gap-3">
            <input type="file" accept=".csv,.xlsx" aria-label="Choose a CSV or XLSX file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
            <ExportCsv path="/api/v1/project-import-template.csv" filename="projects-template.csv" label="Download the template" />
          </TabsContent>
          <TabsContent value="ai">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a spreadsheet, an email or a list…" className="min-h-[140px]" aria-label="Text to import" />
          </TabsContent>
        </Tabs>
        <Button className="mt-4" variant="secondary" disabled={run.isPending || (mode === 'file' ? !file : !text.trim())} onClick={() => run.mutate(true)}>
          {mode === 'ai' ? <Bot /> : <Download />} Preview
        </Button>
        {preview && (
          <div className="mt-4">
            <div className="max-h-72 overflow-auto rounded-control border border-border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Members</th>
                    <th className="px-3 py-2">Check</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r, i) => (
                    <tr key={i} className={cn('border-t border-border', r.errors.length && 'bg-red-tint')}>
                      <td className="px-3 py-2">{r.title}</td>
                      <td className="px-3 py-2">{r.category ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">{r.memberEmails.join(', ')}</td>
                      <td className="px-3 py-2 text-xs text-red">{r.errors.join(' · ') || '✓'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button className="mt-4" disabled={!valid || run.isPending} onClick={() => run.mutate(false)}>
              Add {valid} projects
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
