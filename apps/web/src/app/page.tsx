/* eslint-disable @next/next/no-img-element -- static art, already sized */
import { ArrowRight, CheckCircle2, MessageCircle, MicOff, Monitor, Map as MapIcon, Trophy, Users } from 'lucide-react';
import Link from 'next/link';
import { Actor, AvatarStack } from '@/components/brand/avatar';
import { BoothCode, SectionHeading } from '@/components/brand/bits';
import { Brand } from '@/components/brand/brand';
import { SiteHeader } from '@/components/layout/site-header';
import { Button } from '@/components/ui/button';
import { LivePill, Pill } from '@/components/ui/pill';
import { EventCard } from '@/features/events/event-card';
import { serverApi } from '@/lib/api/server';
import { withBase } from '@/lib/utils';

const STEPS = [
  ['Find your event', 'Tap Interested and add it to your calendar. No seat booking, no forms yet.'],
  ['Make yourself at home', 'Pick a character once. Your mic starts muted, so you choose when to talk.'],
  ['Step into a booth', 'Everyone inside a booth hears each other like one room. Ask, listen, vote.'],
] as const;

const ROLES = [
  { icon: <Users />, title: 'Come curious. Leave connected.', text: 'Step into booths and talk to the people behind the projects.', tone: 'bg-blue-tint text-blue' },
  { icon: <Monitor />, title: 'Give your ideas a little room.', text: 'Present, share your screen, and collect feedback and votes.', tone: 'bg-lavender text-lavender-ink' },
  { icon: <Trophy />, title: 'Every perspective counts.', text: 'Judges score with one rubric, right in the booth.', tone: 'bg-orange-tint text-live-ink' },
];

export default async function Landing() {
  // the landing page still renders if the api is down
  const { data } = await serverApi()
    .GET('/api/v1/events', { params: { query: { limit: 3 } } })
    .catch(() => ({ data: undefined }));
  const events = data?.data ?? [];
  const live = events.filter((e) => e.status === 'LIVE').length;
  return (
    <div className="bg-[radial-gradient(ellipse_at_78%_15%,#ebf0ff_0%,transparent_44%)]">
      <SiteHeader transparent />
      <main id="main" className="container-page animate-page-in">
        <section className="grid items-center gap-12 pb-16 pt-10 lg:grid-cols-[.88fr_1.12fr] lg:gap-16 lg:pt-14">
          <div className="flex flex-col items-start gap-6">
            {live > 0 && <LivePill className="border border-border bg-white text-ink-2">{live === 1 ? '1 showcase live right now' : `${live} showcases live right now`}</LivePill>}
            <h1 className="max-w-[560px] text-[clamp(2.6rem,4.6vw,4.25rem)] leading-[1.08] tracking-[-0.03em]">
              Demo day,
              <br />
              without the venue.
            </h1>
            <p className="max-w-[430px] leading-[1.85]">Walk into a hall of student projects. Step into a booth to talk with the team, get feedback, and see what happens next.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/explore">
                  Explore events <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/manage/new">Host a showcase</Link>
              </Button>
            </div>
            <div className="flex items-center gap-3 text-sm text-muted">
              <AvatarStack avatars={[8, 9, 12]} />
              <span>Free for events up to 50 people at once.</span>
            </div>
          </div>
          <div className="relative pb-6">
            <div className="rotate-1 overflow-hidden rounded-[20px] border border-[#d6deef] bg-white shadow-[0_20px_60px_rgb(27_52_112/0.1)]">
              <div className="flex h-9 items-center justify-between gap-2 px-3 text-xs text-muted">
                <span className="flex gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => <i key={i} className="size-[5px] rounded-full bg-border" />)}
                </span>
                <span className="rounded-[5px] bg-canvas px-10 py-0.5">connecta · showcase</span>
                <span />
              </div>
              <div className="relative aspect-[1.5] overflow-hidden bg-subtle">
                <img src={withBase('/assets/images/hall-reference.png')} width={1536} height={855} alt="A Connecta showcase hall with colourful booths" className="size-full object-cover" />
                <Actor avatar={7} walk direction={3} name="You" you size={48} className="!absolute left-[55%] top-[64%]" />
                <Actor avatar={9} walk direction={2} size={48} className="!absolute left-[72%] top-[48%]" />
                <Actor avatar={12} size={48} className="!absolute left-[37%] top-[56%]" />
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-3 rounded-[9px] bg-ink px-4 py-2 text-white [&_svg]:size-3" aria-hidden>
                  <MicOff />
                  <MessageCircle />
                  <MapIcon />
                </div>
              </div>
            </div>
            <div className="absolute -top-4 right-6 flex -rotate-[4deg] items-center gap-2 rounded-[10px] bg-white px-3 py-2 text-xs font-bold shadow-card">
              <CheckCircle2 className="size-[15px] text-green" />A new connection is one hello away.
            </div>
            <div className="absolute -bottom-0.5 left-0 hidden w-[265px] rounded-2xl border border-border bg-white px-5 py-4 shadow-card sm:block lg:-left-8">
              <div className="flex items-center justify-between">
                <BoothCode>Booth 02</BoothCode>
                <LivePill className="bg-transparent p-0 text-xs">Live</LivePill>
              </div>
              <h3 className="my-2.5 text-md leading-[1.5]">Sign-language recognition on edge devices</h3>
              <div className="flex items-center gap-3">
                <AvatarStack avatars={[9, 2, 4]} size={30} />
                <span className="text-xs text-muted">22 people in the booth</span>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Who Connecta is for" className="mb-[76px] grid gap-6 border-y border-border py-7 md:grid-cols-3 md:gap-0">
          {ROLES.map((r, i) => (
            <div key={r.title} className={`flex items-start gap-[15px] md:px-[30px] ${i === 0 ? 'md:pl-0' : ''} ${i < 2 ? 'md:border-r md:border-border' : ''}`}>
              <span className={`grid size-[42px] shrink-0 place-items-center rounded-[13px] [&_svg]:size-5 ${r.tone}`}>{r.icon}</span>
              <div>
                <h3 className="mb-1 text-md">{r.title}</h3>
                <p className="text-sm leading-[1.75]">{r.text}</p>
              </div>
            </div>
          ))}
        </section>

        {events.length > 0 && (
          <section className="pb-[76px]">
            <SectionHeading
              title="Happening on Connecta"
              text="Every event is listed. Some are only for one university."
              aside={
                <Link className="inline-flex items-center gap-2 text-md font-bold text-blue" href="/explore">
                  All events <ArrowRight className="size-4" />
                </Link>
              }
            />
            <div className="grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => <EventCard key={e.id} event={e} />)}
            </div>
          </section>
        )}

        <section className="pb-[76px]">
          <SectionHeading title="How it works" text="No downloads. Works in your browser." />
          <div className="grid gap-7 md:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <div key={title}>
                <div className="mb-5 h-[170px] overflow-hidden rounded-2xl bg-subtle">
                  <img src={withBase(`/assets/images/step-${i + 1}.png`)} alt="" className="size-full object-cover" loading="lazy" />
                </div>
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="grid size-[25px] place-items-center rounded-full bg-blue-tint text-sm font-bold text-blue">{i + 1}</span>
                  <h3 className="text-base">{title}</h3>
                </div>
                <p className="text-md">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mb-14 flex flex-col items-start justify-between gap-6 overflow-hidden rounded-[24px] bg-blue px-8 py-10 text-white md:flex-row md:items-center md:px-11">
          <div>
            <h2 className="text-[1.9rem] text-white">Your students&rsquo; work deserves an audience.</h2>
            <p className="mt-2.5 text-md text-[#dbe5ff]">Set up a showcase in minutes. Booths place themselves.</p>
          </div>
          <Button asChild variant="onBlue">
            <Link href="/manage/new">Create an event</Link>
          </Button>
        </section>
      </main>
      <footer className="container-page flex flex-wrap items-center gap-6 border-t border-border pb-20 pt-6 text-sm text-muted">
        <span className="mr-auto">
          <Brand small />
        </span>
        <span>KMUTT Capstone CP26SSI3</span>
        <Pill tone="light">A little closer, wherever you are</Pill>
      </footer>
    </div>
  );
}
