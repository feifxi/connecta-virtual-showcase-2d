import Link from "next/link";
import { DemoControls, DemoGroup, DemoOption } from "@/components/preview-tools";
import { Actor } from "@/components/actor";
import { Header, Icon, Pill } from "@/components/ui";
import { EVENT, VISITOR_TYPES } from "@/lib/data";

// First time into this event's hall (every role) · ?full=1 shows the hall-full state for visitors
export default async function Join({ params, searchParams }: PageProps<"/e/[slug]/join">) {
  const { slug } = await params;
  const q = await searchParams;
  return (
    <>
      <Header active="Events" />
      <main id="main" className="page container narrow page-content">
        <DemoControls><DemoGroup label="Join"><DemoOption href="?" active={!q.full}>Form</DemoOption><DemoOption href="?full=1" active={!!q.full}>Hall is full</DemoOption></DemoGroup></DemoControls>
        <div className="breadcrumb"><Link href={`/e/${slug}`}>{EVENT.name}</Link><Icon name="chevron" /><span>Before you go in</span></div>
        {q.full ? (
          <section className="surface panel-card" style={{ textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
            <h1 style={{ fontSize: "1.9rem" }}>The hall is full right now.</h1>
            <p className="body-text" style={{ margin: "12px 0 20px" }}>{EVENT.capacity} of {EVENT.capacity} people are inside. Seats free up as people leave — try again in a minute.</p>
            <div className="flex" style={{ justifyContent: "center" }}><button type="button" className="btn"><Icon name="arrow" />Try again</button><Link className="btn secondary" href={`/e/${slug}`}>Browse the projects</Link></div>
          </section>
        ) : (
          <div className="lobby-layout">
            <section>
              <div className="avatar-stage">
                <div className="avatar-stage-caption"><Pill cls="blue">How people will see you</Pill></div>
                <Actor index={7} name="Nont" />
              </div>
              <div className="info-note" style={{ marginTop: 18 }}><Icon name="users" /><span>People in this event see <b>Nont</b> · SIT, KMUTT · 4th year. <Link href="/profile" className="text-link">Edit profile</Link></span></div>
              <div className="info-note" style={{ marginTop: 10 }}><Icon name="headphones" /><span>Inside a booth, everyone there hears each other. Outside, voices fade with distance. Headphones help.</span></div>
            </section>
            <form action={`/e/${slug}/hall`} className="surface lobby-settings stack">
              <h2 style={{ marginBottom: 0 }}>Before you go in.</h2>
              <p className="small-text" style={{ marginTop: -12 }}>Only the first time for this event.</p>
              <label className="field">Your name in this event<input defaultValue="Nont" maxLength={30} /></label>
              <label className="field">Coming as<select defaultValue={VISITOR_TYPES[0]}>{VISITOR_TYPES.map((t) => <option key={t}>{t}</option>)}</select><span className="field-note">From your profile. Change it just for this event, e.g. if you come as an alumnus.</span></label>
              <label className="field">From the organizer: how did you hear about this event?<select><option>Faculty page</option><option>A friend</option><option>My teacher</option></select><span className="field-note">Used for: planning next year&rsquo;s publicity.</span></label>
              <label className="device-row"><span className="flex"><Icon name="micOff" />Microphone starts muted</span><input className="switch" type="checkbox" disabled aria-label="Mic starts muted" /></label>
              <label className="consent"><input type="checkbox" /><span>Email me about future events from this organizer.</span></label>
              <button className="btn wide" type="submit">Enter the hall <Icon name="arrow" /></button>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
