import Link from "next/link";
import { DemoControls, DemoGroup, DemoOption } from "@/components/preview-tools";
import { AvatarStack, Header, Icon, Pill, Status } from "@/components/ui";
import { AGENDA, EVENT, PROJECTS, type EventState } from "@/lib/data";
import { EventCta } from "./event-cta";
import { ProjectGrid } from "./project-grid";

// Public event page (no login needed) · ?state=published|live|exhibition previews each phase
export default async function EventPage({ params, searchParams }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  const q = await searchParams;
  const state: EventState = q.state === "published" || q.state === "exhibition" ? q.state : "live";
  const judges = [...PROJECTS].sort((a, b) => b.score - a.score).slice(0, 3);
  const audience = [...PROJECTS].sort((a, b) => b.votes - a.votes).slice(0, 3);
  return (
    <>
      <Header active="Events" />
      <main id="main" className="page container page-content">
        <DemoControls><DemoGroup label="Event phase">{(["published", "live", "exhibition"] as EventState[]).map((p) => <DemoOption key={p} href={`?state=${p}`} active={p === state}>{p[0].toUpperCase() + p.slice(1)}</DemoOption>)}</DemoGroup></DemoControls>
        <div className="breadcrumb"><Link href="/explore">Events</Link><Icon name="chevron" /><span>{EVENT.name}</span></div>
        <section className="event-hero">
          <div className="event-hero-copy">
            <div className="flex">
              {state === "live" ? <Status text="Live now" /> : state === "published" ? <Pill cls="blue">Opens {EVENT.dateShort} · 10:00</Pill> : <Pill cls="green">Exhibition · open until 15 Nov</Pill>}
              <Pill cls="lav">🔒 {EVENT.access}</Pill>
            </div>
            <h1>Senior Design<br />Showcase 2026</h1>
            <p>{EVENT.blurb}</p>
            <div className="flex" style={{ marginTop: 23 }}><AvatarStack ids={[8, 9, 12, 4]} extra={EVENT.interested - 4} /><span className="small-text muted">interested</span></div>
          </div>
          <div className="event-meta">
            {[["calendar", EVENT.date], ["clock", `${EVENT.time} ICT · ends by itself at ${EVENT.ends}`], ["grid", `${EVENT.booths} booths in 4 zones`], ["globe", `Online · log in with ${EVENT.access.replace(" only", "")}`]].map(([i, t]) => <div key={t} className="event-meta-row"><Icon name={i} />{t}</div>)}
            <EventCta slug={slug} state={state} />
          </div>
        </section>

        {state === "exhibition" && (
          <div className="analytics-grid" style={{ marginBottom: 32 }}>
            {[["Judges' award", judges, "trophy"], ["Audience award · Popular Vote", audience, "heart"]].map(([t, list, i]) => (
              <section key={t as string} className="surface chart-card">
                <div className="chart-head"><h3 className="flex"><Icon name={i as string} />{t as string}</h3></div>
                {(list as typeof PROJECTS).map((p, n) => <div key={p.code} className="ranking-row"><span className="rank-num">{n + 1}</span><div className="rank-info"><strong>{p.title}</strong><small>Booth {p.code}</small></div><span /></div>)}
              </section>
            ))}
          </div>
        )}

        <div className="section-heading"><div><h2>Projects</h2><p>Browse before you go in.</p></div><span className="small-text muted">{PROJECTS.length} featured projects</span></div>
        <ProjectGrid slug={slug} />

        <section className="agenda">
          <div><h2>Agenda</h2><p>Booths are open all day. Walk in whenever you like.</p></div>
          <ol className="agenda-list">{AGENDA.map((a) => <li key={a.time}><time>{a.time}</time><span>{a.label}</span></li>)}</ol>
        </section>
      </main>
    </>
  );
}
