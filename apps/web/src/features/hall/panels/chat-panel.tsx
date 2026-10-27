'use client';
import { useMutation } from '@tanstack/react-query';
import { Flag, Megaphone, SendHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CHAT_MAX_LENGTH, type ChatMessage } from '@connecta/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useHallCtx } from '../context';
import { useHall } from '../store';
import { Frame } from './frame';

/** Nearby: no history, messages fade (~5 s) · Everyone: history for the event, announcements included · nothing stored */
export function ChatPanel({ onClose }: { onClose: () => void }) {
  const { conn, event } = useHallCtx();
  const nearby = useHall((s) => s.nearby);
  const everyone = useHall((s) => s.everyone);
  const myUserId = useHall((s) => s.myUserId);
  const [tab, setTab] = useState<'nearby' | 'all'>('nearby');
  const [draft, setDraft] = useState('');
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const report = useMutation({
    mutationFn: (m: ChatMessage) => api.POST('/api/v1/events/{eventId}/reports', { params: { path: { eventId: event.id } }, body: { targetUserId: m.fromUserId, targetKind: 'CHAT', snapshot: m.text, reason: 'Reported from chat' } }),
    onSuccess: () => toast.success('Reported. The organizers will take a look.'),
    onError: (e) => toastError(e),
  });
  const shown = tab === 'nearby' ? nearby.filter((m) => m.expiresAt > Date.now()) : everyone;
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    conn.send(tab === 'nearby' ? 'chat:nearby' : 'chat:all', { text });
    setDraft('');
  };
  return (
    <Frame title="Chat" side="chat" onClose={onClose}>
      <div className="mb-3 flex rounded-control bg-subtle p-1">
        {(['nearby', 'all'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn('flex-1 rounded-[9px] px-1 py-2 text-sm font-bold text-muted', tab === t && 'bg-white text-blue shadow-[0_1px_3px_rgb(15_26_58/0.08)]')}>
            {t === 'nearby' ? 'Nearby' : 'Everyone'}
          </button>
        ))}
      </div>
      <p className="mb-4 text-sm">{tab === 'nearby' ? 'Only people close to you (or in your booth). Messages fade after a few seconds and aren’t kept.' : 'The whole hall, including announcements. Cleared when the event ends.'}</p>
      <div className="mb-5 flex flex-col gap-3.5" aria-live="polite">
        {shown.map((m) =>
          m.announcement ? (
            <div key={m.id} className="rounded-control border border-[#ffe08a] bg-yellow-tint px-3 py-2.5 text-sm text-ink">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold">
                <Megaphone className="size-3.5 text-orange" />
                Announcement <span className="font-medium text-muted">{formatTime(new Date(m.at).toISOString())}</span>
              </div>
              {m.text}
            </div>
          ) : (
            <div key={m.id} className={cn('group', tab === 'nearby' && 'animate-chat-fade')}>
              <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-ink">
                {m.fromUserId === myUserId ? 'You' : m.fromName}
                <span className="font-medium text-muted">{formatTime(new Date(m.at).toISOString())}</span>
                {m.fromUserId !== myUserId && (
                  <button type="button" aria-label={`Report message from ${m.fromName}`} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100" onClick={() => report.mutate(m)}>
                    <Flag className="size-3.5 text-muted" />
                  </button>
                )}
              </div>
              <div className={cn('rounded-[2px_12px_12px_12px] bg-subtle px-3 py-2.5 text-sm text-ink-2', m.fromUserId === myUserId && 'rounded-[12px_2px_12px_12px] bg-blue-tint')}>{m.text}</div>
            </div>
          ),
        )}
        {!shown.length && <p className="text-md">{tab === 'nearby' ? 'Nothing right now. Say hi to whoever is close by.' : 'No messages yet.'}</p>}
      </div>
      <form className="sticky bottom-0 flex gap-2 bg-white pb-1" onSubmit={send}>
        <Input aria-label="Your message" maxLength={CHAT_MAX_LENGTH} placeholder={tab === 'nearby' ? 'Say something to people nearby…' : 'Message everyone…'} value={draft} onChange={(e) => setDraft(e.target.value)} className="py-2.5 text-sm" />
        <Button type="submit" size="icon" aria-label="Send" className="shrink-0 bg-blue text-white hover:bg-blue-hover hover:text-white">
          <SendHorizontal />
        </Button>
      </form>
    </Frame>
  );
}
