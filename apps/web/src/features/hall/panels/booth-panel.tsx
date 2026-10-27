'use client';
/* eslint-disable @next/next/no-img-element -- signed URLs */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, CheckCircle2, ExternalLink, FileText, Heart, MicOff, Monitor, PlayCircle, UserRound } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Portrait } from '@/components/brand/avatar';
import { BoothCode, RoleChip } from '@/components/brand/bits';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Textarea } from '@/components/ui/field';
import { LivePill, Pill } from '@/components/ui/pill';
import { ZoneDot } from '@/features/projects/project-card';
import { api } from '@/lib/api/browser';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { cn } from '@/lib/utils';
import { useHallCtx } from '../context';
import { useHall } from '../store';
import { Frame, PersonRow, SectionTitle } from './frame';
import { PosterViewer } from './poster-viewer';

export function useProjectDetail(projectId: string) {
  const { conn } = useHallCtx();
  const client = useQueryClient();
  const q = useQuery({ queryKey: qk.project(projectId), queryFn: async () => (await api.GET('/api/v1/projects/{projectId}', { params: { path: { projectId } } })).data! });
  // presenters edit the booth during the event → everyone inside sees it at once
  useEffect(() => conn.on('boothUpdated', (id) => (id === projectId || id === '*') && client.invalidateQueries({ queryKey: qk.project(projectId) })), [conn, client, projectId]);
  return q;
}

const embedUrl = (url: string) => {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return vimeo ? `https://player.vimeo.com/video/${vimeo[1]}` : null;
};

export function BoothPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { event } = useHallCtx();
  const booth = useHall((s) => s.booths[projectId]);
  const people = useHall((s) => s.people);
  const roles = useHall((s) => s.roles);
  const mySession = useHall((s) => s.mySessionId);
  const { data: p } = useProjectDetail(projectId);
  const [posterOpen, setPosterOpen] = useState(false);
  const mine = event.myProjectIds.includes(projectId) && roles.includes('PRESENTER');
  const canMute = mine || roles.includes('ADMIN');
  const inside = Object.values(people).filter((x) => x.booth === projectId);
  const presenterIds = new Set(p?.members.map((m) => m.userId));
  const poster = p?.files.find((f) => f.kind === 'POSTER') ?? p?.files.find((f) => f.kind === 'SLIDES');
  const video = p?.videoUrl ? embedUrl(p.videoUrl) : null;
  const ai = event.modules.ai && p?.aiEnabled && !booth?.live;

  const mute = useMutation({
    mutationFn: (userId: string) => api.PUT('/api/v1/events/{eventId}/hall/participants/{userId}/microphone', { params: { path: { eventId: event.id, userId } }, body: { muted: true } }),
    onSuccess: () => toast.success('Muted. They can unmute themselves.'),
    onError: (e) => toastError(e),
  });

  return (
    <Frame title={booth?.title ?? p?.title ?? 'Booth'} side="right" onClose={onClose}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          {p?.boothLabel && <BoothCode>Booth {p.boothLabel}</BoothCode>}
          {p?.category && (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <ZoneDot color={p.category.color} />
              {p.category.name}
            </span>
          )}
        </span>
        {booth?.live ? <LivePill>Live · {booth.count}</LivePill> : <Pill>No presenter now</Pill>}
      </div>
      <h2 className="mb-2.5 mt-3 text-lg leading-[1.5]">{p?.title}</h2>
      {p?.summary && <p className="text-sm">{p.summary}</p>}

      {poster && (
        <>
          <button type="button" onClick={() => setPosterOpen(true)} className="my-[18px] block aspect-[1.6] w-full overflow-hidden rounded-control bg-blue-tint" aria-label="Open the poster">
            {poster.pageUrls[0] ? <img src={poster.pageUrls[0]} alt="" className="size-full object-cover object-top" /> : <span className="grid size-full place-items-center text-sm text-blue">Preparing the poster…</span>}
          </button>
          <button type="button" onClick={() => setPosterOpen(true)} className="flex w-full items-center gap-2.5 border-b border-border py-3 text-sm">
            <FileText className="size-[18px] text-blue" />
            {poster.kind === 'POSTER' ? 'Poster' : 'Slides'} · {mine ? 'your zoom shows for everyone here' : 'follows the presenter’s zoom'}
            <small className="ml-auto text-muted">{poster.pageCount ?? 1} p</small>
          </button>
          <PosterViewer projectId={projectId} file={poster} open={posterOpen} onOpenChange={setPosterOpen} presenting={mine} />
        </>
      )}
      {!poster && p?.coverUrl && <img src={p.coverUrl} alt="" className="my-[18px] aspect-[1.6] w-full rounded-control object-cover" />}
      {video && (
        <div className="mt-3 aspect-video overflow-hidden rounded-control bg-ink">
          <iframe src={video} title="Project video" className="size-full" allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
        </div>
      )}
      {p?.links.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-2.5 border-b border-border py-3 text-sm">
          {l.url.includes('youtu') ? <PlayCircle className="size-[18px] text-blue" /> : <ExternalLink className="size-[18px] text-blue" />}
          {l.label}
        </a>
      ))}

      {ai && <AskAi projectId={projectId} />}
      {mine ? (
        <Button asChild variant="secondary" size="sm" wide className="mt-[18px]">
          <Link href={`/e/${event.slug}/my-booth?project=${projectId}` as Route} target="_blank">
            <Monitor /> Edit booth
          </Link>
        </Button>
      ) : (
        <YourSay projectId={projectId} />
      )}

      <SectionTitle>In this booth · you all hear each other</SectionTitle>
      {inside.map((x) => (
        <PersonRow
          key={x.sessionId}
          avatar={<Portrait avatar={x.avatar} />}
          name={x.sessionId === mySession ? `${x.name} (you)` : x.name}
          sub={presenterIds.has(x.userId) ? 'Presenter' : x.badges.includes('JUDGE') ? 'Judge' : 'Visitor'}
          right={
            canMute && x.sessionId !== mySession && !presenterIds.has(x.userId) ? (
              <Button variant="ghost" size="sm" onClick={() => mute.mutate(x.userId)}>
                <MicOff /> Mute
              </Button>
            ) : (
              x.badges.filter((b) => b !== 'PRESENTER').map((b) => <RoleChip key={b} role={b} />)
            )
          }
        />
      ))}
      {canMute && <p className="mt-2 text-sm">Muted people can unmute themselves. Nobody can turn on someone else&rsquo;s mic.</p>}
    </Frame>
  );
}

/** RAG over the team's own files · always labelled as AI, never as the presenter */
function AskAi({ projectId }: { projectId: string }) {
  const [q, setQ] = useState('');
  const ask = useMutation({
    mutationFn: async () => (await api.POST('/api/v1/projects/{projectId}/ai-answers', { params: { path: { projectId } }, body: { question: q.trim() } })).data!,
    onError: (e) => toastError(e),
  });
  return (
    <div className="mt-4 flex flex-col gap-2 rounded-control bg-lavender p-4 text-sm text-lavender-ink">
      <strong className="flex items-center gap-2">
        <Bot className="size-[18px]" />
        The team is away — ask the AI
      </strong>
      <span>Answers only from the team&rsquo;s poster and documents.</span>
      <form
        className="mt-1 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) ask.mutate();
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} maxLength={500} placeholder="How does it work offline?" aria-label="Ask the AI" className="py-2 text-sm" />
        <Button type="submit" size="sm" disabled={ask.isPending || !q.trim()}>
          Ask
        </Button>
      </form>
      {ask.isPending && <p className="text-lavender-ink">Reading the team&rsquo;s documents…</p>}
      {ask.data && (
        <div className="rounded-[10px] bg-white p-3 text-ink-2">
          <p className="mb-1 text-xs font-bold text-lavender-ink">AI answer · not from the team</p>
          <p className="whitespace-pre-line">{ask.data.answer}</p>
          {ask.data.sources.length > 0 && <p className="mt-2 text-xs text-muted">From: {[...new Set(ask.data.sources.map((s) => s.name))].join(', ')}</p>}
        </div>
      )}
    </div>
  );
}

/** Vote · feedback (only the team + Admins see it) · ask the team to contact me (one way) */
function YourSay({ projectId }: { projectId: string }) {
  const { event } = useHallCtx();
  const client = useQueryClient();
  const live = event.status === 'LIVE';
  const mineQ = useQuery({ queryKey: qk.engagement(projectId), queryFn: async () => (await api.GET('/api/v1/projects/{projectId}/engagement/me', { params: { path: { projectId } } })).data! });
  const refresh = () => client.invalidateQueries({ queryKey: qk.engagement(projectId) });
  const vote = useMutation({
    mutationFn: (on: boolean) => (on ? api.PUT('/api/v1/projects/{projectId}/votes/me', { params: { path: { projectId } } }) : api.DELETE('/api/v1/projects/{projectId}/votes/me', { params: { path: { projectId } } })),
    onSuccess: refresh,
    onError: (e) => toastError(e),
  });
  const [text, setText] = useState('');
  const [anon, setAnon] = useState(false);
  const feedback = useMutation({
    mutationFn: () => api.POST('/api/v1/projects/{projectId}/feedbacks', { params: { path: { projectId } }, body: { text: text.trim(), isAnonymous: anon } }),
    onSuccess: () => {
      setText('');
      toast.success('Sent to the team');
      refresh();
    },
    onError: (e) => toastError(e),
  });
  const [contactOpen, setContactOpen] = useState(false);
  const [contact, setContact] = useState({ email: '', phone: '', message: '' });
  const sendContact = useMutation({
    mutationFn: () => api.PUT('/api/v1/projects/{projectId}/contact-requests/me', { params: { path: { projectId } }, body: { email: contact.email, phone: contact.phone || undefined, message: contact.message || undefined } }),
    onSuccess: () => {
      setContactOpen(false);
      refresh();
    },
    onError: (e) => toastError(e),
  });
  const withdraw = useMutation({ mutationFn: () => api.DELETE('/api/v1/projects/{projectId}/contact-requests/me', { params: { path: { projectId } } }), onSuccess: refresh });
  const voted = mineQ.data?.voted ?? false;
  const requested = mineQ.data?.contactRequested ?? false;

  return (
    <>
      <SectionTitle>Your say</SectionTitle>
      {event.modules.popularVote && live && (
        <button
          type="button"
          aria-pressed={voted}
          onClick={() => vote.mutate(!voted)}
          className={cn('flex w-full items-center gap-3 rounded-control border border-border px-3.5 py-3 text-left text-sm transition-colors', voted ? 'border-[#ffc2c2] bg-[#fff0f0] text-[#c0344a]' : 'hover:bg-subtle')}
        >
          <Heart className={cn('size-5 shrink-0', voted && 'fill-current')} />
          <span>
            <strong className="block">{voted ? 'You voted for this project' : 'Vote for this project'}</strong>
            <span className="text-xs opacity-80">Popular Vote · as many projects as you like, once each</span>
          </span>
        </button>
      )}
      {event.modules.feedback && (
        <form
          className="mt-3.5 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) feedback.mutate();
          }}
        >
          <Field label="Feedback for the team" htmlFor={`fb-${projectId}`}>
            <Textarea id={`fb-${projectId}`} maxLength={2000} placeholder="What did you like? What could be better?" className="min-h-[70px]" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Checkbox label="Hide my name from the team · only the team and organizers see feedback" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
          <Button type="submit" size="sm" className="self-start" disabled={!text.trim() || feedback.isPending}>
            Send feedback
          </Button>
          {!!mineQ.data?.feedbackCount && <p className="text-xs text-green">You&rsquo;ve sent {mineQ.data.feedbackCount} note(s) to this team.</p>}
        </form>
      )}
      {requested ? (
        <div className="mt-3.5 flex items-center gap-2 rounded-control bg-green-tint px-3.5 py-3 text-sm text-green">
          <CheckCircle2 className="size-[18px]" /> The team can contact you.
          <button type="button" className="ml-auto font-bold underline" onClick={() => withdraw.mutate()}>
            Withdraw
          </button>
        </div>
      ) : contactOpen ? (
        <form
          className="mt-3.5 flex flex-col gap-2.5 rounded-control border border-border p-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            sendContact.mutate();
          }}
        >
          <Field label="Email" htmlFor="contact-email">
            <Input id="contact-email" type="email" required value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="py-2.5 text-sm" />
          </Field>
          <Field label={<>Phone or LinkedIn <span className="font-normal text-muted">optional</span></>} htmlFor="contact-phone">
            <Input id="contact-phone" maxLength={30} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="py-2.5 text-sm" />
          </Field>
          <Field label={<>Message <span className="font-normal text-muted">optional</span></>} htmlFor="contact-msg">
            <Input id="contact-msg" maxLength={1000} value={contact.message} onChange={(e) => setContact({ ...contact, message: e.target.value })} className="py-2.5 text-sm" />
          </Field>
          <p className="text-xs">The team will see your name, organization and what you enter here.</p>
          <Button type="submit" size="sm" wide disabled={sendContact.isPending}>
            Send to the team
          </Button>
        </form>
      ) : (
        <Button variant="secondary" size="sm" wide className="mt-3.5" onClick={() => setContactOpen(true)}>
          <UserRound /> Ask the team to contact me
        </Button>
      )}
    </>
  );
}
