'use client';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HALL_PRESET_INFO, HALL_PRESETS, PLAN_LIMITS, ZONE_COLORS, type HallPreset, type ModuleKey } from '@connecta/shared';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { Surface } from '@/components/ui/surface';
import { Switch } from '@/components/ui/switch';
import { ZoneDot } from '@/features/projects/project-card';
import { ApiError } from '@/lib/api/client';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { fromLocalInput, toLocalInput } from '@/lib/format';
import { cn } from '@/lib/utils';

const STEPS = ['Event details', 'Your hall', 'Features', 'Review'];
const MODULES: { key: ModuleKey; label: string; text: string }[] = [
  { key: 'judging', label: 'Judging', text: 'One rubric, judges score in the booth' },
  { key: 'popularVote', label: 'Popular Vote', text: 'Visitors vote for projects they visited' },
  { key: 'feedback', label: 'Feedback', text: 'Notes for teams during and after the event' },
  { key: 'model3d', label: '3D model viewer', text: 'Teams can add a .glb model to their booth' },
];

/** Starts as a Draft · nothing is sent until you publish · the creator becomes Admin */
export function CreateEvent() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const now = new Date();
  const start = new Date(now.getTime() + 7 * 86_400_000);
  start.setUTCHours(3, 0, 0, 0); // 10:00 Bangkok
  const end = new Date(start);
  end.setUTCHours(16, 59, 0, 0); // 23:59 Bangkok, the default end
  const [v, setV] = useState({
    title: '',
    description: '',
    startNow: false,
    startsAt: toLocalInput(start.toISOString()),
    endsAt: toLocalInput(end.toISOString()),
    allowedDomain: '',
    preset: 'hall' as HallPreset,
    capacity: PLAN_LIMITS.FREE.capacity,
    categories: [] as { name: string; color: (typeof ZONE_COLORS)[number] }[],
    modules: { judging: true, popularVote: true, feedback: true, model3d: false, ai: false } as Record<ModuleKey, boolean>,
  });
  const [cat, setCat] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const create = useMutation({
    mutationFn: async () => {
      const startsAt = v.startNow ? new Date().toISOString() : fromLocalInput(v.startsAt);
      return (
        await api.POST('/api/v1/events', {
          body: {
            title: v.title,
            description: v.description,
            startsAt,
            endsAt: fromLocalInput(v.endsAt),
            hallOpenMode: 'SCHEDULE',
            agenda: [],
            capacity: v.capacity,
            allowedDomain: v.allowedDomain.replace(/^@/, '').trim() || null,
            preset: v.preset,
            categories: v.categories,
            modules: v.modules,
          },
        })
      ).data!;
    },
    onSuccess: (r) => router.push(`/manage/${r.slug}/projects` as Route),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'VALIDATION_FAILED') {
        setErrors(e.fieldErrors());
        setStep(0);
      } else toastError(e);
    },
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV({ ...v, [k]: val });
  const canNext = step !== 0 || (v.title.trim() && (v.startNow || v.startsAt) && v.endsAt);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[2.1rem]">Create an event</h1>
          <p className="mt-2">A few details and a hall. It starts as a draft — nothing is sent until you publish.</p>
        </div>
        <Pill tone="blue">Free · up to {PLAN_LIMITS.FREE.capacity} people at once · {PLAN_LIMITS.FREE.judges} judges</Pill>
      </div>
      <ol className="mb-6 flex flex-wrap gap-3">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button type="button" onClick={() => i <= step && setStep(i)} className={cn('flex items-center gap-2 text-sm font-bold text-muted', i === step && 'text-blue')}>
              <span className={cn('grid size-6 place-items-center rounded-full bg-subtle text-xs', i === step && 'bg-blue text-white', i < step && 'bg-blue-tint text-blue')}>{i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      <Surface className="max-w-3xl p-6">
        <div className="flex flex-col gap-5">
          {step === 0 && (
            <>
              <Field label="Event name" htmlFor="c-title" error={errors.title}>
                <Input id="c-title" value={v.title} onChange={(e) => set('title', e.target.value)} maxLength={120} placeholder="INT371 Poster Session" autoFocus />
              </Field>
              <Field label="Description" htmlFor="c-desc">
                <Textarea id="c-desc" value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={4000} placeholder="What visitors will see and who's presenting." />
              </Field>
              <div className="flex gap-2" role="group" aria-label="When it starts">
                {[
                  ['Schedule a time', false],
                  ['Start now', true],
                ].map(([l, val]) => (
                  <button key={l as string} type="button" aria-pressed={v.startNow === val} onClick={() => set('startNow', val as boolean)} className={cn('rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted', v.startNow === val && 'border-ink bg-ink text-white')}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {!v.startNow && (
                  <Field label="Starts (Bangkok time)" htmlFor="c-start" error={errors.startsAt}>
                    <Input id="c-start" type="datetime-local" value={v.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
                  </Field>
                )}
                <Field label="Ends (required)" htmlFor="c-end" note="The event ends by itself so it never stays open by accident. You can extend it on the day." error={errors.endsAt}>
                  <Input id="c-end" type="datetime-local" value={v.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
                </Field>
              </div>
              <Field label="Only visitors from (optional)" htmlFor="c-domain" note="Every event is listed in Explore. With a domain, only those accounts can join as visitors; invited presenters and judges always can." error={errors.allowedDomain}>
                <Input id="c-domain" value={v.allowedDomain} onChange={(e) => set('allowedDomain', e.target.value)} placeholder="kmutt.ac.th" />
              </Field>
            </>
          )}
          {step === 1 && (
            <>
              <p className="text-md">Booths place themselves from your project list. Empty spots become plants and seating, so a small event never looks empty.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {HALL_PRESETS.map((p) => (
                  <button key={p} type="button" aria-pressed={v.preset === p} onClick={() => set('preset', p)} className={cn('rounded-control border-2 border-border p-4 text-left', v.preset === p && 'border-blue bg-blue-tint')}>
                    <strong className="block">
                      {HALL_PRESET_INFO[p].label} · up to {HALL_PRESET_INFO[p].booths} booths
                    </strong>
                    <span className="text-sm text-muted">{HALL_PRESET_INFO[p].description}</span>
                  </button>
                ))}
              </div>
              <Field label="People in the hall at once" htmlFor="c-cap" note={`Up to ${PLAN_LIMITS.FREE.capacity} on Free. Everyone you invite gets a reserved seat; visitors share the rest.`} error={errors.capacity}>
                <Input id="c-cap" type="number" min={2} max={PLAN_LIMITS.PRO.capacity} value={v.capacity} onChange={(e) => set('capacity', Number(e.target.value))} />
              </Field>
              <div className="flex flex-col gap-2 text-md font-semibold">
                Categories (optional) · each becomes a zone in the hall
                {v.categories.map((c, i) => (
                  <span key={c.name} className="flex items-center gap-2 font-normal">
                    <NativeSelect aria-label={`Colour of ${c.name}`} className="w-24 px-2 py-1.5 text-sm" value={c.color} onChange={(e) => set('categories', v.categories.map((x, j) => (j === i ? { ...x, color: e.target.value as typeof c.color } : x)))}>
                      {ZONE_COLORS.map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </NativeSelect>
                    <ZoneDot color={c.color} />
                    {c.name}
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Remove ${c.name}`} onClick={() => set('categories', v.categories.filter((_, j) => j !== i))}>
                      <X />
                    </Button>
                  </span>
                ))}
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = cat.trim();
                    if (name && !v.categories.some((c) => c.name === name)) set('categories', [...v.categories, { name, color: ZONE_COLORS[v.categories.length % ZONE_COLORS.length]! }]);
                    setCat('');
                  }}
                >
                  <Input value={cat} onChange={(e) => setCat(e.target.value)} placeholder="e.g. Computing" aria-label="New category" className="py-2 text-sm" maxLength={40} />
                  <Button type="submit" size="sm" variant="secondary">
                    <Plus /> Add
                  </Button>
                </form>
              </div>
            </>
          )}
          {step === 2 &&
            MODULES.map((m) => (
              <label key={m.key} className="flex items-center justify-between gap-3 border-b border-border py-3">
                <span>
                  <strong className="block text-md">{m.label}</strong>
                  <span className="text-sm text-muted">{m.text}</span>
                </span>
                <Switch checked={v.modules[m.key]} onCheckedChange={(on) => set('modules', { ...v.modules, [m.key]: on })} aria-label={m.label} />
              </label>
            ))}
          {step === 3 && (
            <>
              {[
                ['Event', v.title],
                ['When', v.startNow ? 'Starts now' : v.startsAt.replace('T', ' ')],
                ['Ends', v.endsAt.replace('T', ' ')],
                ['Hall', `${HALL_PRESET_INFO[v.preset].label} · ${v.capacity} people at once`],
                ['Zones', v.categories.map((c) => c.name).join(', ') || 'No categories'],
                ['Features', MODULES.filter((m) => v.modules[m.key]).map((m) => m.label).join(', ') || 'None'],
                ['Access', v.allowedDomain ? `Visitors from @${v.allowedDomain.replace(/^@/, '')}` : 'Open to everyone'],
              ].map(([k, val]) => (
                <div key={k} className="flex justify-between border-b border-border py-2.5 text-md">
                  <span className="text-muted">{k}</span>
                  <strong className="text-right">{val}</strong>
                </div>
              ))}
              <p className="rounded-control bg-blue-tint px-4 py-3 text-sm text-blue">Next: add projects and presenters, invite Admins and judges. Invitations go out when you publish.</p>
            </>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
              <ArrowLeft /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                Create draft &amp; add projects <ArrowRight />
              </Button>
            )}
          </div>
        </div>
      </Surface>
    </>
  );
}
