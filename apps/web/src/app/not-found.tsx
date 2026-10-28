import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-[2rem]">We couldn&rsquo;t find that</h1>
        <p className="mb-6 mt-3">The page may have moved, or the event isn&rsquo;t public.</p>
        <Button asChild>
          <Link href="/explore">Explore events</Link>
        </Button>
      </div>
    </main>
  );
}
