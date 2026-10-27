'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Pause, Play, ShieldCheck, UserRound } from 'lucide-react';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { onboardingSchema, PROVINCES, VISITOR_TYPE_LABELS, VISITOR_TYPES, type Me, type OnboardingInput } from '@connecta/shared';
import { Actor } from '@/components/brand/avatar';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { Surface } from '@/components/ui/surface';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { CHARACTERS } from '@/lib/characters';
import { cn } from '@/lib/utils';

/** Character lobby + profile · onboarding (first login) and Edit profile use the same form */
export function ProfileForm({ me, next, submitLabel }: { me: Me; next?: string; submitLabel: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const [dir, setDir] = useState<0 | 2 | 3>(0);
  const [walk, setWalk] = useState(false);
  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      displayName: me.displayName,
      avatarPreset: me.avatarPreset ?? 7,
      visitorType: me.visitorType ?? 'STUDENT',
      province: me.province ?? 'Bangkok',
      organization: me.organization ?? '',
      position: me.position ?? '',
    },
  });
  const avatar = form.watch('avatarPreset');
  const name = form.watch('displayName');
  const save = useMutation({
    mutationFn: async (v: OnboardingInput) => (await api.PATCH('/api/v1/me', { body: { ...v, organization: v.organization || null, position: v.position || null } })).data!,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.me });
      if (next) {
        router.push(next as Route);
        router.refresh();
      } else toast.success('Profile saved');
    },
    onError: (e) => toastError(e),
  });
  const err = form.formState.errors;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <section>
        <div className="relative grid min-h-[270px] place-items-center overflow-hidden rounded-card bg-[#edf2ff] before:absolute before:top-[65%] before:h-[70px] before:w-[190px] before:rounded-full before:bg-[#dce6fe]">
          <div className="absolute left-5 top-[18px]">
            <Pill tone="blue">Your character</Pill>
          </div>
          <Actor avatar={avatar} direction={dir} walk={walk} name={name || 'You'} you size={150} className="-translate-y-4" />
          <div className="absolute bottom-[18px] right-[18px] flex gap-1.5">
            <Button variant="ghost" size="icon" aria-label="Turn left" className="size-[34px] bg-white" onClick={() => setDir(2)}>
              <ArrowLeft />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Face forward" className="size-[34px] bg-white" onClick={() => setDir(0)}>
              <UserRound />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Turn right" className="size-[34px] bg-white" onClick={() => setDir(3)}>
              <ArrowRight />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Preview walking" aria-pressed={walk} className="size-[34px] bg-white" onClick={() => setWalk(!walk)}>
              {walk ? <Pause /> : <Play />}
            </Button>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-md">Pick your character</h3>
          <span className="text-sm text-muted">{CHARACTERS.length} to choose from</span>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7" role="radiogroup" aria-label="Character">
          {CHARACTERS.map((c) => (
            <button
              key={c.index}
              type="button"
              role="radio"
              aria-checked={avatar === c.index}
              aria-label={c.name}
              onClick={() => form.setValue('avatarPreset', c.index, { shouldDirty: true })}
              className={cn('flex aspect-[.85] flex-col items-center justify-center rounded-[13px] border-2 border-border bg-white pb-1 pt-1.5 transition-colors hover:border-blue-light', avatar === c.index && 'border-blue bg-blue-tint')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.portrait} width={58} height={58} alt="" className="[image-rendering:pixelated]" />
              <span className="text-xs text-muted">{c.name}</span>
            </button>
          ))}
        </div>
      </section>
      <Surface className="p-7">
        <form className="flex flex-col gap-5" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <h2 className="text-lg">About you</h2>
          <Field label="Display name" htmlFor="displayName" note="Shown above your character." error={err.displayName?.message}>
            <Input id="displayName" maxLength={60} autoComplete="nickname" aria-invalid={!!err.displayName} {...form.register('displayName')} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="I am a…" htmlFor="visitorType">
              <NativeSelect id="visitorType" {...form.register('visitorType')}>
                {VISITOR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {VISITOR_TYPE_LABELS[t]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Province" htmlFor="province">
              <NativeSelect id="province" {...form.register('province')}>
                {PROVINCES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <div className="flex gap-2.5 rounded-control bg-blue-tint px-4 py-3.5 text-sm text-blue">
            <ShieldCheck className="mt-0.5 size-[17px] shrink-0" />
            <span>Nobody sees these two. Organizers only get totals, like how many provinces their event reached.</span>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={<>Organization <span className="font-normal text-muted">optional</span></>} htmlFor="organization">
              <Input id="organization" placeholder="e.g. SIT, KMUTT" maxLength={120} {...form.register('organization')} />
            </Field>
            <Field label={<>Position or year <span className="font-normal text-muted">optional</span></>} htmlFor="position">
              <Input id="position" placeholder="e.g. 4th year" maxLength={120} {...form.register('position')} />
            </Field>
          </div>
          <p className="text-sm">People in your events see these. Leave them blank if you prefer.</p>
          <Button type="submit" wide disabled={save.isPending}>
            {submitLabel} <ArrowRight />
          </Button>
        </form>
      </Surface>
    </div>
  );
}
