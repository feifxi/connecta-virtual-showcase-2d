'use client';
import { Star } from 'lucide-react';
import type { FormField } from '@connecta/shared';
import { Field, Input, NativeSelect } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export type Answers = Record<string, string | string[] | number>;

/** Renders organizer questions (join form + survey share one structure) · every question says what it's used for (PDPA) */
export function FormFields({ fields, answers, onChange, errors = {} }: { fields: FormField[]; answers: Answers; onChange: (a: Answers) => void; errors?: Record<string, string> }) {
  const set = (id: string, v: Answers[string]) => onChange({ ...answers, [id]: v });
  return (
    <>
      {fields.map((f) => {
        const id = `q-${f.id}`;
        const label = (
          <>
            {f.label}
            {!f.required && <span className="font-normal text-muted"> optional</span>}
          </>
        );
        const note = `Used for: ${f.purpose}`;
        const error = errors[`answers.${f.id}`];
        if (f.type === 'short_text')
          return (
            <Field key={f.id} label={label} htmlFor={id} note={note} error={error}>
              <Input id={id} maxLength={1000} value={(answers[f.id] as string) ?? ''} onChange={(e) => set(f.id, e.target.value)} required={f.required} />
            </Field>
          );
        if (f.type === 'single')
          return (
            <Field key={f.id} label={label} htmlFor={id} note={note} error={error}>
              <NativeSelect id={id} value={(answers[f.id] as string) ?? ''} onChange={(e) => set(f.id, e.target.value)} required={f.required}>
                <option value="">Choose…</option>
                {f.options?.map((o) => <option key={o}>{o}</option>)}
              </NativeSelect>
            </Field>
          );
        if (f.type === 'multi') {
          const picked = (answers[f.id] as string[]) ?? [];
          return (
            <fieldset key={f.id} className="flex flex-col gap-2 text-md font-semibold">
              <legend className="mb-2">{label}</legend>
              {f.options?.map((o) => (
                <label key={o} className="flex items-center gap-2.5 font-normal text-ink-2">
                  <input type="checkbox" className="accent-blue" checked={picked.includes(o)} onChange={(e) => set(f.id, e.target.checked ? [...picked, o] : picked.filter((x) => x !== o))} />
                  {o}
                </label>
              ))}
              <p className="text-sm font-normal text-muted">{note}</p>
              {error && <p className="text-sm font-normal text-red">{error}</p>}
            </fieldset>
          );
        }
        const value = (answers[f.id] as number) ?? 0;
        return (
          <fieldset key={f.id} className="flex flex-col gap-2 text-md font-semibold">
            <legend className="mb-2">{label}</legend>
            <div className="flex gap-1" role="radiogroup" aria-label={f.label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} of 5`} onClick={() => set(f.id, n)} className="rounded-md p-1">
                  <Star className={cn('size-7', n <= value ? 'fill-orange text-orange' : 'text-input')} />
                </button>
              ))}
            </div>
            <p className="text-sm font-normal text-muted">{note}</p>
            {error && <p className="text-sm font-normal text-red">{error}</p>}
          </fieldset>
        );
      })}
    </>
  );
}
