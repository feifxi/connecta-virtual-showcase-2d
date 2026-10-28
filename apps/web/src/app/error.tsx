'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';

/** Any page that fails to render lands here instead of a blank screen */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const message = error instanceof ApiError ? error.userMessage : 'Something went wrong on our side.';
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-[2rem]">That didn&rsquo;t work</h1>
        <p className="mb-6 mt-3">{message} Try again in a moment.</p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="secondary">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
