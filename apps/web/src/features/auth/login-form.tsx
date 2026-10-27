'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { Globe, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { signIn } from '@/lib/auth-client';
import { withBase } from '@/lib/utils';

const schema = z.object({ email: z.email('Enter a valid email') });

export function LoginForm({ next, providers }: { next: string; providers: { microsoft: boolean; google: boolean } }) {
  const [sent, setSent] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });
  const callbackURL = withBase(next);

  const social = async (provider: 'microsoft' | 'google') => {
    const { error } = await signIn.social({ provider, callbackURL });
    if (error) toast.error("Couldn't start that login. Try the email link instead.");
  };

  const submit = form.handleSubmit(async ({ email }) => {
    const { error } = await signIn.magicLink({ email, callbackURL, newUserCallbackURL: withBase(`/onboarding?next=${encodeURIComponent(next)}`) });
    if (error) toast.error(error.status === 429 ? 'Too many tries. Wait a minute and try again.' : "Couldn't send the link. Check the address and try again.");
    else setSent(email);
  });

  if (sent)
    return (
      <div className="rounded-control bg-blue-tint p-5 text-md text-blue" role="status">
        <p className="font-bold text-blue">Check your inbox</p>
        <p className="mt-1 text-blue">We sent a login link to {sent}. It works once and expires in 15 minutes.</p>
        <button type="button" className="mt-3 text-sm font-bold underline" onClick={() => setSent(null)}>
          Use another email
        </button>
      </div>
    );

  return (
    <>
      {(providers.microsoft || providers.google) && (
        <div className="flex flex-col gap-4">
          {providers.microsoft && (
            <>
              <Button variant="secondary" wide onClick={() => social('microsoft')}>
                <ShieldCheck /> Continue with Microsoft
              </Button>
              <span className="-mt-2 text-center text-sm text-muted">University accounts like @kmutt.ac.th use Microsoft</span>
            </>
          )}
          {providers.google && (
            <Button variant="secondary" wide onClick={() => social('google')}>
              <Globe /> Continue with Google
            </Button>
          )}
        </div>
      )}
      {(providers.microsoft || providers.google) && <div className="my-5 flex items-center gap-3 text-sm text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">or use an email link</div>}
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" spellCheck={false} placeholder="you@university.ac.th" aria-invalid={!!form.formState.errors.email} {...form.register('email')} />
        </Field>
        <Button type="submit" wide disabled={form.formState.isSubmitting}>
          <Mail /> Email me a login link
        </Button>
      </form>
    </>
  );
}
