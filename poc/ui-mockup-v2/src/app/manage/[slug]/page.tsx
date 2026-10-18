import Link from "next/link";
import { Btn, Icon, Initials, Kpis, Pill, RoleChip, Status, Workspace } from "@/components/ui";
import { EVENT, PROJECTS, RUBRIC, type Role } from "@/lib/data";

const card = "surface panel-card";

function Overview() {
  return (
    <>
      <Kpis items={[["Interested", String(EVENT.interested), "before the event", "bell"], ["Joined", "438", "371 tapped Interested first", "users"], ["Booths ready", "21 / 24", "3 still missing a poster", "grid"], ["Scores submitted", "201 / 336", "close when the event ends", "trophy"]]} />
      <div className="workspace-grid">
        <section className="surface">
          <div className="panel-card" style={{ paddingBottom: 12 }}><div className="flex between"><h2 style={{ fontSize: "1.1rem" }}>Booths</h2><Link className="text-link" href={`/manage/${EVENT.slug}/projects`}>All {EVENT.booths} projects <Icon name="arrow" /></Link></div></div>
          <div className="table-wrap"><table><thead><tr><th>Booth</th><th>Project</th><th>Zone</th></tr></thead><tbody>
            {PROJECTS.map((p) => <tr key={p.code}><td><span className="booth-code">{p.code}</span></td><td>{p.short}</td><td>{p.category}</td></tr>)}
          </tbody></table></div>
        </section>
        <section className={card}>
          <h2>Setup checklist</h2>
          {[["Details, time, access", true], ["Hall preset · Hall (30 booths)", true], [`${EVENT.booths} projects · presenters invited`, true], ["Booths complete · 21 of 24", false], ["Rubric & judges", true], ["Published", true]].map(([k, ok]) => <div key={k as string} className={`check-row ${ok ? "" : "todo"}`}><Icon name={ok ? "checkCircle" : "clock"} />{k}</div>)}
        </section>
      </div>
    </>
  );
}

const PEOPLE: [string, string, Role, string][] = [["Nont Chaiyaporn", "NC", "Admin", "Created the event"], ["Fah Chaiyaporn", "FC", "Admin", "Online"], ["Dr. Pim Rattanakul", "PR", "Judge", "In the hall"], ["Prae Srisuwan", "PS", "Presenter", "At booth 02"], ["guest.judge@company.com", "?", "Judge", "Invitation pending"]];

function People() {
  return (
    <div className="workspace-grid">
      <section className="surface">
        <div className="panel-card" style={{ paddingBottom: 15 }}>
          <div className="flex between"><h2 style={{ fontSize: "1.1rem" }}>Your people</h2><button type="button" className="btn small"><Icon name="plus" />Invite</button></div>
          <p className="field-note" style={{ marginTop: 7 }}>Roles come from invitations. One person can have more than one role. Every invitation reserves a seat.</p>
        </div>
        <div className="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>
          {PEOPLE.map(([n, i, r, s]) => <tr key={n}><td><span className="table-person"><Initials name={i === "?" ? "?" : n} size={31} />{n}</span></td><td><RoleChip role={r} /></td><td><span className="small-text" style={{ color: s.includes("pending") ? "var(--muted)" : "var(--green)" }}>{s}</span></td><td><button type="button" className="icon-btn" aria-label={`Manage ${n}`}><Icon name="more" /></button></td></tr>)}
        </tbody></table></div>
        <p className="field-note" style={{ padding: "14px 18px" }}>Admins can do everything. The last admin can&rsquo;t leave — add another admin first.</p>
      </section>
      <section className={card}>
        <h2>Banned from this event</h2>
        <div className="person"><Initials name="Tee K" size={31} /><div><strong>Tee K.</strong><small>Spamming nearby chat · by Fah, 10:42</small></div><button type="button" className="btn secondary small" style={{ marginLeft: "auto" }}>Lift ban</button></div>
        <p className="field-note" style={{ marginTop: 12 }}>Banned people can&rsquo;t enter this event again. Other events aren&rsquo;t affected.</p>
      </section>
    </div>
  );
}

function Judging() {
  return (
    <>
      <div className="workspace-grid">
        <section className="surface chart-card">
          <div className="chart-head"><h3>Scoring progress</h3><small>Closes when the event ends · {EVENT.ends}</small></div>
          <div className="booth-bars">{PROJECTS.map((p, i) => <div key={p.code} className="booth-bar-row" style={{ gridTemplateColumns: "30px 1fr 40px" }}><span>{p.code}</span><div className="bar-track"><div className="bar-fill" style={{ ["--bar" as string]: `${[100, 60, 80, 40, 100, 20][i]}%`, background: "var(--blue)" }} /></div><strong>{[5, 3, 4, 2, 5, 1][i]}/5</strong></div>)}</div>
          <button type="button" className="btn secondary small" style={{ marginTop: 18 }}><Icon name="bell" />Remind judges who aren&rsquo;t done</button>
        </section>
        <section className={card}>
          <div className="flex between"><h2 style={{ marginBottom: 0 }}>Rubric</h2><Pill>Locked · scoring started</Pill></div>
          {RUBRIC.map((r) => <div key={r.k} className="module-row"><h3>{r.k}</h3><span className="small-text muted">0–10 · {r.w}%</span></div>)}
          <p className="field-note">Criteria and weights lock after the first score. Descriptions can still change.</p>
        </section>
      </div>
      <section className="surface panel-card flex between" style={{ marginTop: 22 }}>
        <div><h3>Announce results</h3><p className="small-text">After the event ends. Only winners show on the event page; teams see their own detailed scores.</p></div>
        <label className="field" style={{ flexDirection: "row", alignItems: "center" }}>Show top<input type="number" defaultValue={3} style={{ width: 70 }} /></label>
        <button type="button" className="btn" disabled><Icon name="trophy" />Announce results</button>
      </section>
    </>
  );
}

function Moderation() {
  return (
    <div className="workspace-grid">
      <section className={card}>
        <h2>Reports to review</h2>
        {[["Rude messages in nearby chat", "Tee K. · by 3 people · message copied"], ["Inappropriate feedback on booth 06", "reported by the team"]].map(([t, s]) => (
          <div key={t} className="notice" style={{ marginBottom: 10, alignItems: "center" }}><div style={{ flex: 1 }}><strong>{t}</strong><div className="small-text">{s}</div></div><button type="button" className="btn secondary small">Dismiss</button><button type="button" className="btn secondary small">Kick</button><button type="button" className="btn small dark">Ban</button></div>
        ))}
        <h3 style={{ fontSize: ".875rem", margin: "20px 0 8px" }}>Audit log</h3>
        {["10:42 · Fah banned Tee K. · “spamming nearby chat”", "10:15 · Nont made Ken S. a presenter of booth 03", "09:58 · Prae edited booth 02 during the event"].map((l) => <p key={l} className="small-text" style={{ padding: "4px 0" }}>{l}</p>)}
      </section>
      <section className={card}>
        <h2>Emergency switches</h2>
        <label className="module-row"><div><h3>Stop new arrivals</h3><p>Nobody new can enter the hall</p></div><input type="checkbox" className="switch" aria-label="Stop new arrivals" /></label>
        <label className="module-row"><div><h3>Mute everyone</h3><p>People can unmute themselves afterwards</p></div><input type="checkbox" className="switch" aria-label="Mute everyone" /></label>
        <p className="field-note">Kick removes someone for now. Ban keeps them out of this event.</p>
      </section>
    </div>
  );
}

function Settings() {
  return (
    <div className="workspace-grid">
      <section className={card}>
        <h2>Event</h2>
        <div className="resource"><Icon name="link" />connecta.space/e/{EVENT.slug}<small>Copy</small></div>
        <label className="module-row"><div><h3>Only visitors from</h3><p>Invited people can always get in</p></div><input defaultValue={EVENT.access.replace(" only", "")} className="search-input" style={{ width: 160, paddingLeft: 14 }} /></label>
        <label className="module-row"><div><h3>Ends at</h3><p>The event ends by itself at this time</p></div><span className="flex"><input type="time" defaultValue="16:00" className="search-input" style={{ width: 110, paddingLeft: 14 }} /><button type="button" className="btn secondary small">+30 min</button></span></label>
        {["Judging", "Popular Vote", "Feedback", "AI booth assistant", "3D model viewer"].map((m, i) => <label key={m} className="module-row"><h3>{m}</h3><input type="checkbox" className="switch" defaultChecked={i < 4} aria-label={m} /></label>)}
      </section>
      <section className={card} style={{ borderColor: "#f3c0b6", height: "fit-content" }}>
        <h2 style={{ color: "var(--red)" }}>Delete event</h2>
        <p className="small-text">Removes the hall, projects, scores and files for good. Type the event name to confirm.</p>
        <div className="chat-input"><input placeholder={EVENT.name} aria-label="Type the event name" /><button type="button" className="btn danger small" disabled>Delete</button></div>
      </section>
    </div>
  );
}

const TABS: Record<string, [string, string, () => React.ReactElement]> = {
  overview: ["Overview", "Overview", Overview],
  people: ["People & roles", "People & roles", People],
  judging: ["Judging", "Judging", Judging],
  moderation: ["Moderation", "Moderation", Moderation],
  settings: ["Settings", "Settings", Settings],
};

export default async function Manage({ searchParams }: PageProps<"/manage/[slug]">) {
  const q = await searchParams;
  const key = typeof q.tab === "string" && q.tab in TABS ? q.tab : "overview";
  const [active, title, Tab] = TABS[key];
  return (
    <Workspace active={active}>
      <div className="section-heading">
        <div><div className="flex" style={{ marginBottom: 8 }}><Status text={`Live · ends ${EVENT.ends}`} /><Pill cls="lav">Admin</Pill></div><h1>{title}</h1><p>{EVENT.name}</p></div>
        <div className="flex">
          <button type="button" className="btn secondary small"><Icon name="megaphone" />Announce</button>
          <button type="button" className="btn secondary small"><Icon name="clock" />Extend</button>
          <button type="button" className="btn danger small">End event</button>
          <Btn href={`/e/${EVENT.slug}/hall?as=Admin`} cls="small" icon="arrow">Visit the hall</Btn>
        </div>
      </div>
      <Tab />
    </Workspace>
  );
}
