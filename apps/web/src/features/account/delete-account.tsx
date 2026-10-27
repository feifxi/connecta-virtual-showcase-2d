'use client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Surface } from '@/components/ui/surface';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { signOut } from '@/lib/auth-client';

/** PDPA: personal data is wiped · refused while you're the only Admin of an event */
export function DeleteAccount() {
  const router = useRouter();
  const del = useMutation({
    mutationFn: () => api.DELETE('/api/v1/me'),
    onSuccess: async () => {
      await signOut().catch(() => undefined);
      router.push('/');
      router.refresh();
    },
    onError: (e) => toastError(e),
  });
  return (
    <Surface className="mt-10 flex flex-wrap items-center justify-between gap-4 p-6">
      <div>
        <h3 className="text-md">Delete account</h3>
        <p className="mt-1 text-sm">Your name, email and profile are removed. Scores and feedback you gave stay, shown as “Deleted user”.</p>
      </div>
      <ConfirmDialog
        trigger={<Button variant="danger">Delete account</Button>}
        title="Delete your account?"
        description="This can't be undone. If you're the only Admin of an event, add another Admin or delete that event first."
        confirmLabel="Delete my account"
        onConfirm={() => del.mutate()}
      />
    </Surface>
  );
}
