'use client';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Headphones, MicOff, Users } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { VISITOR_TYPE_LABELS, VISITOR_TYPES, type FormField, type Me, type VisitorType } from '@connecta/shared';
import { Actor } from '@/components/brand/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, NativeSelect } from '@/components/ui/field';
import { Pill } from '@/components/ui/pill';
import { Surface } from '@/components/ui/surface';
import { api } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { toastError } from '@/lib/api/errors';
import { FormFields, type Answers } from './form-fields';

/** Once per event, every role · profile complete + no questions = one click */
export function JoinForm({ eventId, slug, me, fields }: { eventId: string; slug: string; me: Me; fields: FormField[] }) {
  const router = useRouter();
  const [name, setName] = useState(me.displayName);
  const [visitorType, setVisitorType] = useState<VisitorType>(me.visitorType ?? 'STUDENT');
  const [consent, setConsent] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const join = useMutation({
    mutationFn: () => api.POST('/api/v1/events/{eventId}/attendances', { params: { path: { eventId } }, body: { displayName: name.trim(), visitorType, consentMarketing: consent, answers } }),
    onSuccess: () => router.push(`/e/${slug}/hall` as Route),
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'VALIDATION_FAILED') setErrors(e.fieldErrors());
      else if (e instanceof ApiError && e.code === 'ALREADY_EXISTS') router.push(`/e/${slug}/hall` as Route);
      else toastError(e);
    },
  });
  const shown = [name || me.displayName, me.organization, me.position].filter(Boolean).join(' · ');
  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <section>
        <div className="relative grid min-h-[270px] place-items-center overflow-hidden rounded-card bg-[#edf2ff] before:absolute before:top-[65%] before:h-[70px] before:w-[190px] before:rounded-full before:bg-[#dce6fe]">
          <div className="absolute left-5 top-[18px]">
            <Pill tone="blue">How people will see you</Pill>
          </div>
          <Actor avatar={me.avatarPreset ?? 0} name={name || me.displayName} size={150} className="-translate-y-4" />
        </div>
        <div className="mt-[18px] flex gap-2.5 rounded-control bg-blue-tint px-4 py-3.5 text-sm text-blue">
          <Users className="mt-0.5 size-[17px] shrink-0" />
          <span>
            People in this event see <b>{shown}</b>.{' '}
            <Link href="/profile" className="font-bold underline">
              Edit profile
            </Link>
          </span>
        </div>
        <div className="mt-2.5 flex gap-2.5 rounded-control bg-blue-tint px-4 py-3.5 text-sm text-blue">
          <Headphones className="mt-0.5 size-[17px] shrink-0" />
          <span>Inside a booth, everyone there hears each other. Outside, voices fade with distance. Headphones help.</span>
        </div>
      </section>
      <Surface className="p-7">
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            join.mutate();
          }}
        >
          <div>
            <h2 className="text-lg">Before you go in.</h2>
            <p className="mt-1 text-sm">Only the first time for this event.</p>
          </div>
          <Field label="Your name in this event" htmlFor="displayName" error={errors.displayName}>
            <Input id="displayName" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          </Field>
          <Field label="Coming as" htmlFor="visitorType" note="From your profile. Change it just for this event, e.g. if you come as an alumnus.">
            <NativeSelect id="visitorType" value={visitorType} onChange={(e) => setVisitorType(e.target.value as VisitorType)}>
              {VISITOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {VISITOR_TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <FormFields fields={fields} answers={answers} onChange={setAnswers} errors={errors} />
          <div className="flex items-center gap-2 border-b border-border py-3.5 text-md">
            <MicOff className="size-[18px] text-muted" /> Your microphone starts muted. Turn it on when you want to talk.
          </div>
          <Checkbox label="Email me about future events from this organizer." checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <Button type="submit" wide disabled={join.isPending || !name.trim()}>
            Enter the hall <ArrowRight />
          </Button>
        </form>
      </Surface>
    </div>
  );
}
