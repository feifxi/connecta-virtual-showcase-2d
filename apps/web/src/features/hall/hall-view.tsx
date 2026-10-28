'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronDown, ExternalLink, Info, LayoutGrid, LogOut, Minus, Plus, Shield, Users } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { EventDetail, FormField } from '@connecta/shared';
import { BrandMark } from '@/components/brand/brand';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tooltip } from '@/components/ui/menu';
import { LivePill, Pill } from '@/components/ui/pill';
import { FormFields, type Answers } from '@/features/attendance/form-fields';
import { api } from '@/lib/api/browser';
import { ApiError } from '@/lib/api/client';
import { toastError } from '@/lib/api/errors';
import { qk } from '@/lib/api/keys';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { HallConnection } from './connection';
import { HallContext, useHallCtx, type HallCtx } from './context';
import { HallMedia } from './media';
import { Notices } from './notices';
import { EntryOverlay } from './overlays';
import { AdminPanel } from './panels/admin-panel';
import { AgendaPanel } from './panels/agenda-panel';
import { BoothPanel } from './panels/booth-panel';
import { BoothsPanel } from './panels/booths-panel';
import { ChatPanel } from './panels/chat-panel';
import { PeoplePanel } from './panels/people-panel';
import { RubricPanel } from './panels/rubric-panel';
import { selectMyBooth, useHall, type Side } from './store';
import { Toolbar } from './toolbar';

const HallGame = dynamic(() => import('./hall-game'), { ssr: false });
const START_ZOOM = 1.7;
const narrow = () => window.matchMedia('(max-width: 767px)').matches; // phones: one panel at a time

export function HallView({ event, avatar }: { event: EventDetail; avatar: number }) {
  const client = useQueryClient();
  const [session, setSession] = useState(0); // bump to reconnect from scratch
  const [pair, setPair] = useState<{ conn: HallConnection; media: HallMedia } | null>(null);
  const hall = useQuery({ queryKey: qk.hall(event.id), queryFn: async () => (await api.GET('/api/v1/events/{eventId}/hall', { params: { path: { eventId: event.id } } })).data!, staleTime: 60_000 });
  const refreshHall = useCallback(() => client.invalidateQueries({ queryKey: qk.hall(event.id) }), [client, event.id]);
  const phase = useHall((s) => s.phase);
  const set = useHall((s) => s.set);

  // connect: ticket → room → audio · each run owns its connection (Strict Mode runs effects twice in dev)
  useEffect(() => {
    let alive = true;
    const conn = new HallConnection(event.id);
    const media = new HallMedia(conn);
    useHall.setState({ phase: 'ticket', kicked: null, blockedBy: null, people: {}, booths: {}, nearby: [], everyone: [], mic: false, camera: false, sharing: false, banner: null, reconnecting: false });
    // the effect owns these connections: they're created and disposed together with it
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPair({ conn, media });
    void (async () => {
      if (!(await conn.connect()) || !alive) return;
      await media.connect(conn.ticket!.mediaUrl, conn.ticket!.mediaToken);
      if (alive) set({ phase: 'ready' });
    })();
    return () => {
      alive = false;
      void media.dispose();
      void conn.dispose();
    };
  }, [event.id, session, set]);

  if (!pair) return null;
  return <HallInside event={event} avatar={avatar} pair={pair} hall={hall.data} refreshHall={refreshHall} phase={phase} onRetry={() => setSession((n) => n + 1)} />;
}

function HallInside({
  event,
  avatar,
  pair: { conn, media },
  hall,
  refreshHall,
  phase,
  onRetry,
}: {
  event: EventDetail;
  avatar: number;
  pair: { conn: HallConnection; media: HallMedia };
  hall: HallCtx['hall'];
  refreshHall: () => void;
  phase: string;
  onRetry: () => void;
}) {
  const router = useRouter();
  const set = useHall((s) => s.set);

  // booths added / renamed during the event → refresh project data; roles changed → reload event roles
  useEffect(() => conn.on('boothUpdated', refreshHall), [conn, refreshHall]);
  useEffect(() => conn.on('roleChanged', () => router.refresh()), [conn, router]);
  useEffect(() => conn.on('muted', (by) => toast(`${by} muted your microphone. You can unmute yourself.`)), [conn]);
  useEffect(() => conn.on('eventEnded', () => toast('The event has ended. The hall stays open as an exhibition.')), [conn]);

  // walked out of my own booth → camera and screen share stop
  const myBooth = useHall(selectMyBooth);
  useEffect(() => {
    if (!myBooth || !event.myProjectIds.includes(myBooth)) void media.leaveStage();
    if (myBooth) set({ boothOpen: true });
  }, [myBooth, media, event.myProjectIds, set]);

  // movement hint until the first move or 8 s
  const [hint, setHint] = useState(true);
  useEffect(() => {
    if (phase !== 'ready' || !hint) return;
    const hide = (e: KeyboardEvent) => /^(w|a|s|d|arrow)/i.test(e.key) && setHint(false);
    const t = setTimeout(() => setHint(false), 8000);
    window.addEventListener('keydown', hide);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', hide);
    };
  }, [phase, hint]);

  const judgeProgress = useJudgeProgress(event);
  const ctx: HallCtx = { event, hall, conn, media, refreshHall };
  return (
    <HallContext.Provider value={ctx}>
      <main id="main" className="relative h-dvh min-h-[540px] overflow-hidden bg-hall text-ink" aria-label="Exhibition hall" onPointerDown={() => void media.unlockAudio()}>
        <h1 className="sr-only">{event.title} · hall</h1>
        {phase === 'ready' && hall && <HallGame conn={conn} mapJson={hall.mapJson} title={event.title} />}
        {phase === 'ready' && (
          <>
            <HallMenu />
            <StatusPill />
            <Rail />
            <Notices hint={hint} judgeProgress={judgeProgress} />
            <Panels />
            <Toolbar />
            <Zoom />
          </>
        )}
        <EntryOverlay avatar={avatar} onRetry={onRetry} />
      </main>
    </HallContext.Provider>
  );
}

function useJudgeProgress(event: EventDetail) {
  const judge = useHall((s) => s.roles.includes('JUDGE'));
  const list = useQuery({
    queryKey: qk.judgeList(event.id),
    queryFn: async () => (await api.GET('/api/v1/events/{eventId}/score-sheets/me', { params: { path: { eventId: event.id } } })).data!,
    enabled: judge && event.modules.judging,
    refetchInterval: 60_000,
  });
  if (!list.data) return undefined;
  const done = list.data.items.filter((i) => i.status === 'SUBMITTED').length;
  return `${done} of ${list.data.items.length} scored · closes at ${formatTime(event.endsAt)}`;
}

/** Event card doubles as the hall menu: the way out and links live here, away from the controls */
function HallMenu() {
  const { event } = useHallCtx();
  const people = useHall((s) => Object.keys(s.people).length);
  const [leaving, setLeaving] = useState(false);
  return (
    <div className="absolute left-5 top-[18px] z-[4] max-md:left-3 max-md:top-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-3.5 rounded-[14px] border border-border bg-white py-[11px] pl-[17px] pr-3.5 text-left shadow-float hover:border-blue-light data-[state=open]:border-blue-light">
          <BrandMark small />
          <span className="min-w-0 max-w-[260px] max-sm:max-w-[160px]">
            <strong className="block truncate text-md">{event.title}</strong>
            <small className="flex items-center gap-1.5 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-green" /> {people} in the hall · ends {formatTime(event.endsAt)}
            </small>
          </span>
          <ChevronDown className="size-4 text-muted" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem asChild>
            <Link href={`/e/${event.slug}` as Route} target="_blank">
              <Info /> Event page <ExternalLink className="ml-auto" />
            </Link>
          </DropdownMenuItem>
          {event.myRoles.includes('ADMIN') && (
            <DropdownMenuItem asChild>
              <Link href={`/manage/${event.slug}` as Route} target="_blank">
                <Shield /> Dashboard <ExternalLink className="ml-auto" />
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem danger onSelect={() => setLeaving(true)}>
            <LogOut /> Leave the hall
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LeaveDialog open={leaving} onOpenChange={setLeaving} />
    </div>
  );
}

function StatusPill() {
  const reconnecting = useHall((s) => s.reconnecting);
  const audioOk = useHall((s) => s.audioOk);
  return (
    <div className="absolute right-5 top-[18px] z-[3] max-md:hidden">
      {reconnecting ? <LivePill className="bg-white shadow-float">Reconnecting</LivePill> : !audioOk ? <Pill tone="live" className="bg-white shadow-float">No audio</Pill> : <Pill tone="green" className="bg-white py-[9px] shadow-float">● Connected</Pill>}
    </div>
  );
}

function Rail() {
  const side = useHall((s) => s.side);
  const admin = useHall((s) => s.roles.includes('ADMIN'));
  const set = useHall((s) => s.set);
  const tools: { id: Exclude<Side, null>; label: string; icon: React.ReactNode }[] = [
    { id: 'booths', label: 'All booths', icon: <LayoutGrid /> },
    { id: 'people', label: 'People in the hall', icon: <Users /> },
    { id: 'agenda', label: 'Agenda', icon: <CalendarDays /> },
    ...(admin ? [{ id: 'admin' as const, label: 'Admin tools', icon: <Shield /> }] : []),
  ];
  return (
    <nav aria-label="Hall tools" className="absolute left-5 top-[104px] z-[3] flex flex-col gap-[7px] rounded-[14px] bg-white p-[7px] shadow-float max-md:left-3 max-md:top-[84px]">
      {tools.map((t) => (
        <Tooltip key={t.id} label={t.label} side="right">
          <button
            type="button"
            aria-label={t.label}
            aria-pressed={side === t.id}
            onClick={() => set({ side: side === t.id ? null : t.id, ...(narrow() && { chatOpen: false, boothOpen: false }) })}
            className={cn(
              'grid size-9 place-items-center rounded-[10px] text-muted hover:bg-subtle hover:text-blue [&_svg]:size-5',
              side === t.id && 'bg-blue-tint text-blue',
              t.id === 'admin' && 'text-lavender-ink hover:bg-lavender hover:text-lavender-ink',
              t.id === 'admin' && side === t.id && 'bg-lavender',
            )}
          >
            {t.icon}
          </button>
        </Tooltip>
      ))}
    </nav>
  );
}

function Panels() {
  const { event } = useHallCtx();
  const side = useHall((s) => s.side);
  const chatOpen = useHall((s) => s.chatOpen);
  const boothOpen = useHall((s) => s.boothOpen);
  const myBooth = useHall(selectMyBooth);
  const booth = useHall((s) => (myBooth ? s.booths[myBooth] : null));
  const judge = useHall((s) => s.roles.includes('JUDGE'));
  const set = useHall((s) => s.set);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const showBooth = detailsFor === myBooth;
  const closeSide = () => set({ side: null });
  const scoring = judge && event.modules.judging && event.status === 'LIVE' && !showBooth && myBooth && !event.myProjectIds.includes(myBooth);
  return (
    <>
      {myBooth &&
        (boothOpen ? (
          scoring ? (
            <RubricPanel projectId={myBooth} onClose={() => set({ boothOpen: false })} onShowBooth={() => setDetailsFor(myBooth)} />
          ) : (
            <BoothPanel projectId={myBooth} onClose={() => set({ boothOpen: false })} />
          )
        ) : (
          <button
            type="button"
            onClick={() => set({ boothOpen: true, ...(narrow() && { side: null, chatOpen: false }) })}
            className="absolute right-5 top-[86px] z-[5] flex items-center gap-3 rounded-[14px] border border-border bg-white py-2.5 pl-3 pr-3 text-left shadow-card hover:border-blue-light max-md:bottom-24 max-md:right-3 max-md:top-auto"
          >
            <span>
              <strong className="block max-w-[200px] truncate text-md">{booth?.title}</strong>
              <small className="text-xs text-muted">{booth?.live ? 'Presenter is here' : 'No presenter now'}</small>
            </span>
            {booth?.live && <LivePill className="text-xs">Live</LivePill>}
          </button>
        ))}
      {chatOpen && <ChatPanel onClose={() => set({ chatOpen: false })} />}
      {side === 'booths' && <BoothsPanel onClose={closeSide} />}
      {side === 'people' && <PeoplePanel onClose={closeSide} />}
      {side === 'agenda' && <AgendaPanel onClose={closeSide} />}
      {side === 'admin' && <AdminPanel onClose={closeSide} />}
    </>
  );
}

function Zoom() {
  const zoom = useHall((s) => s.zoom);
  const set = useHall((s) => s.set);
  const by = (d: number) => set({ zoom: Math.min(2.6, Math.max(0.9, Math.round((zoom + d) * 10) / 10)) });
  return (
    <div className="absolute bottom-[25px] right-5 z-[3] flex items-center rounded-[11px] bg-white p-[5px] shadow-card max-md:hidden">
      <Button variant="ghost" size="icon" className="size-[34px]" aria-label="Zoom out" onClick={() => by(-0.1)}>
        <Minus />
      </Button>
      <span className="min-w-11 text-center text-sm tabular-nums">{Math.round((zoom / START_ZOOM) * 100)}%</span>
      <Button variant="ghost" size="icon" className="size-[34px]" aria-label="Zoom in" onClick={() => by(0.1)}>
        <Plus />
      </Button>
    </div>
  );
}

/** Asked once per person when leaving (organizer's survey questions) */
function LeaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { event } = useHallCtx();
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const survey = useQuery({
    queryKey: qk.form(event.id, 'survey'),
    queryFn: async () => (await api.GET('/api/v1/events/{eventId}/forms/{kind}', { params: { path: { eventId: event.id, kind: 'survey' } } })).data!,
    enabled: open,
  });
  const leave = () => router.push(`/e/${event.slug}` as Route);
  const send = useMutation({
    mutationFn: () => api.POST('/api/v1/events/{eventId}/forms/survey/responses', { params: { path: { eventId: event.id } }, body: { answers } }),
    onSuccess: leave,
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'VALIDATION_FAILED') setErrors(e.fieldErrors());
      else if (e instanceof ApiError && e.code === 'ALREADY_EXISTS') leave();
      else toastError(e);
    },
  });
  const fields: FormField[] = survey.data?.fields ?? [];
  const ask = fields.length > 0 && !survey.data?.answered;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={ask ? 'Before you go — how was it?' : 'Leave the hall?'} description={ask ? 'A few quick questions from the organizers. Asked once per event.' : 'You can come back any time while the hall is open.'}>
        {ask && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              send.mutate();
            }}
          >
            <FormFields fields={fields} answers={answers} onChange={setAnswers} errors={errors} />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="secondary" onClick={leave}>
                Skip
              </Button>
              <Button type="submit" disabled={send.isPending}>
                Send &amp; leave
              </Button>
            </div>
          </form>
        )}
        {!ask && (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Stay
            </Button>
            <Button onClick={leave}>
              <LogOut /> Leave
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
