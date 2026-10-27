/* eslint-disable @next/next/no-img-element -- signed URLs from object storage */
import { Actor } from '@/components/brand/avatar';
import { cn } from '@/lib/utils';

const ARTS = ['bg-[#dceafa]', 'bg-lavender', 'bg-[#ffeadc]', 'bg-green-tint'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Cover image, or generated art from the event id when there's none */
export function EventArt({ id, title, coverUrl, host, className }: { id: string; title: string; coverUrl: string | null; host?: string; className?: string }) {
  if (coverUrl) return <img src={coverUrl} alt="" className={cn('size-full object-cover', className)} />;
  const h = hash(id);
  return (
    <div className={cn('relative flex size-full flex-col justify-end overflow-hidden px-6 pb-5 pt-12', ARTS[h % ARTS.length], className)}>
      <div className="absolute -right-7 top-4 size-[170px] rounded-full border-[24px] border-white/55" aria-hidden />
      <strong className="z-[1] line-clamp-2 max-w-[200px] text-[1.4rem] leading-[1.2] tracking-[-0.025em]">{title}</strong>
      {host && <span className="mt-2 text-xs">{host}</span>}
      <Actor avatar={h % 14} walk className="!absolute right-6 top-14" size={72} />
    </div>
  );
}
