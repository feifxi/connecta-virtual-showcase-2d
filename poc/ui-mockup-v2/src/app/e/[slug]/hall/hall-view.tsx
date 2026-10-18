"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HallControl } from "@/components/hall-game";
import { Actor } from "@/components/actor";
import { DemoControls, DemoGroup, DemoOption } from "@/components/preview-tools";
import { Icon, Pill, Portrait, Poster, RoleChip, Status } from "@/components/ui";
import type { BoothInfo, Hearing } from "@/game/HallScene";
import { AGENDA, CHARACTERS, EVENT, HALL_PEOPLE, HALL_PROJECTS, PROJECTS, RUBRIC, START_ZOOM, type Role } from "@/lib/data";

const HallGame = dynamic(() => import("@/components/hall-game"), { ssr: false });
const MY_BOOTH = "02"; // the booth this mock presenter belongs to
// three panel slots that never close each other: left = find & go (opened from the rail) · right = the booth you're in (opens/closes as you walk in/out) · chat = bottom-left, under the left panel · the middle stays clear so you can see yourself
type Side = "booths" | "people" | "agenda" | "admin" | null;
const narrow = () => typeof window !== "undefined" && window.matchMedia("(max-width:700px)").matches; // phones: one panel at a time
export type Net = "ok" | "server" | "audio" | "reconnecting";
const NETS: [Net, string][] = [["ok", "Normal"], ["server", "Server down"], ["audio", "No audio"], ["reconnecting", "Reconnecting"]];
const LOAD_STEPS = ["Loading the hall", "Joining the event", "Connecting audio"];
const REACTIONS = ["👏", "❤️", "😂", "❓", "🔥"];
const ZONE_DOT: Record<string, string> = { Engineering: "#3fae7f", Computing: "#8a6ee0", Health: "#f08a5d", Design: "#4b95e0" }; // same as the carpets
type Announcement = { text: string; time: string };

export function HallView({ initialRole, initialNet }: { initialRole: Role; initialNet: Net }) {
  const [role, setRole] = useState<Role>(initialRole);
  const [avatar, setAvatar] = useState<number | null>(null);
  const [booth, setBooth] = useState<BoothInfo | null>(null);
  const [peek, setPeek] = useState<BoothInfo | null>(null); // booth you're standing next to
  const [side, setSide] = useState<Side>(null);
  const [boothOpen, setBoothOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [hearing, setHearing] = useState<Hearing>({ people: [], inBooth: null });
  const [mic, setMic] = useState(false); // everyone enters muted
  const [cam, setCam] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [zoom, setZoom] = useState(START_ZOOM);
  const [leaving, setLeaving] = useState(false);
  const [menu, setMenu] = useState(false);
  // entering: 0–2 = step in progress, 3 = in the hall · failed = the game server never answered (mock timings)
  const [net, setNet] = useState<Net>(initialNet);
  const [step, setStep] = useState(0);
  const [failed, setFailed] = useState(false);
  const [run, setRun] = useState(0);
  const [range, setRange] = useState(false); // demo only: the real hall doesn't draw the hearing circle
  // movement hint: shown once you're in, gone after your first move or 8 s
  const [hint, setHint] = useState(true);
  useEffect(() => {
    if (step < 3 || !hint) return;
    const hide = (e: Event) => { if (!(e instanceof KeyboardEvent) || /^(w|a|s|d|arrow)/i.test(e.key)) setHint(false); };
    const t = setTimeout(() => setHint(false), 8000);
    window.addEventListener("keydown", hide);
    document.querySelector(".hall-page canvas")?.addEventListener("pointerdown", hide);
    return () => { clearTimeout(t); window.removeEventListener("keydown", hide); document.querySelector(".hall-page canvas")?.removeEventListener("pointerdown", hide); };
  }, [step, hint]);
  useEffect(() => {
    const t = [setTimeout(() => setStep(1), 700), setTimeout(() => (net === "server" ? setFailed(true) : setStep(2)), 1400)];
    if (net !== "server") t.push(setTimeout(() => setStep(3), net === "audio" ? 3000 : 2000));
    return () => t.forEach(clearTimeout);
  }, [net, run]);
  const audio = net !== "audio";
  const restart = (n: Net) => { setNet(n); setStep(0); setFailed(false); setRun((r) => r + 1); };
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [menu]);
  const control = useRef<HallControl | null>(null);
  const [reacting, setReacting] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([{ text: "Judging closes at 16:00 with the event. Results go up on the event page afterwards.", time: "13:05" }]);
  const [banner, setBanner] = useState<Announcement | null>(null);
  const announce = (text: string) => { const a = { text, time: new Date().toTimeString().slice(0, 5) }; setAnnouncements((l) => [...l, a]); setBanner(a); };
  const react = (e: string) => { control.current?.say(e, "reaction"); setReacting(false); };

  useEffect(() => {
    let a = 7;
    try { a = Number(localStorage.getItem("connecta-avatar") ?? 7) || 7; } catch {}
    setAvatar(a);
  }, []);

  const mine = role === "Presenter" && booth?.no === MY_BOOTH;
  const open = (p: Side) => { if (narrow()) { setChatOpen(false); setBoothOpen(false); } setSide(side === p ? null : p); };
  const toggleChat = () => { if (narrow()) { setSide(null); setBoothOpen(false); } setChatOpen(!chatOpen); };
  const expandBooth = () => { if (narrow()) { setSide(null); setChatOpen(false); } setBoothOpen(true); };
  const zoomBy = (d: number) => { const z = Math.min(2.6, Math.max(0.9, Math.round((zoom + d) * 10) / 10)); setZoom(z); control.current?.zoom(z); };
  const goTo = (no: string) => control.current?.goTo(no);

  return (
    <main id="main" className={`page hall-page ${chatOpen ? "chat-open" : ""}`} aria-label="Exhibition hall">
      <h1 className="sr-only">Exhibition hall</h1>
      {avatar !== null && (
        <HallGame projects={HALL_PROJECTS} avatar={avatar} name={`${CHARACTERS[avatar].name} (you)`} control={control}
          onEnter={(b) => { setBooth(b); if (narrow()) { setSide(null); setChatOpen(false); } setBoothOpen(true); }} onLeave={() => { setBooth(null); setSharing(false); }} onHearing={setHearing} onPeek={setPeek} />
      )}

      {/* event card doubles as the hall menu: logo, way out and links live here, away from the controls */}
      <div className="hall-title" ref={menuRef}>
        <button type="button" className="hall-title-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <span className="brand-mark" aria-hidden="true" />
          <span className="hall-title-event"><strong>{EVENT.name}</strong><small><span className="dot" style={{ color: "var(--green)" }} /> {EVENT.inHall} in the hall, ends {EVENT.ends}</small></span>
          <Icon name="chevron" className="hall-title-chevron" />
        </button>
        {menu && (
          <div className="hall-menu" role="menu">
            <a role="menuitem" href={`/e/${EVENT.slug}`} target="_blank" rel="noopener" onClick={() => setMenu(false)}><Icon name="info" />Event page<small>New tab</small></a>
            <span className="hall-menu-sep" />
            <button type="button" role="menuitem" className="danger" onClick={() => { setMenu(false); setLeaving(true); }}><Icon name="leave" />Leave the hall</button>
          </div>
        )}
      </div>

      <div className="hall-top-right">
        {net === "reconnecting" ? <Pill cls="live"><span className="spinner" aria-hidden="true" />Reconnecting</Pill> : net === "audio" ? <Pill cls="live"><Icon name="headphones" className="xs" />No audio</Pill> : <Pill cls="green"><span className="dot" />Connected</Pill>}
      </div>

      <DemoControls>
        <DemoGroup label="Preview as">{(["Visitor", "Presenter", "Judge", "Admin"] as Role[]).map((r) => <DemoOption key={r} active={role === r} onClick={() => { setRole(r); if (side === "admin") setSide(null); }}>{r}</DemoOption>)}</DemoGroup>
        <DemoGroup label="Network">{NETS.map(([n, l]) => <DemoOption key={n} active={net === n} onClick={() => restart(n)}>{l}</DemoOption>)}</DemoGroup>
        <DemoGroup label="Hearing range">{([[false, "Hidden"], [true, "Shown"]] as const).map(([v, l]) => <DemoOption key={l} active={range === v} onClick={() => { setRange(v); control.current?.showRange(v); }}>{l}</DemoOption>)}</DemoGroup>
      </DemoControls>

      <div className="hall-top-center">
        {role === "Judge" && <div className="judge-banner"><Icon name="trophy" /><strong>7 of 12 scored</strong><span>Closes at {EVENT.ends}</span></div>}
        {banner && <div className="announce-banner" role="alert"><Icon name="megaphone" /><span><strong>Announcement from the organizers</strong>{banner.text}</span><button type="button" className="icon-btn" aria-label="Dismiss announcement" onClick={() => setBanner(null)}><Icon name="close" /></button></div>}
        {step === 3 && net === "reconnecting" && <div className="hall-notice"><span className="spinner" aria-hidden="true" /><span><strong>Connection lost. Reconnecting…</strong> Your spot in the hall is kept.</span></div>}
        {step === 3 && net === "audio" && <div className="hall-notice"><Icon name="headphones" /><span><strong>Audio isn&rsquo;t connected.</strong> You can still walk around and chat.</span><button type="button" className="btn small secondary" onClick={() => setNet("ok")}>Try again</button></div>}
        {peek && <div className="hall-notice peek"><span className="booth-code">{peek.no}</span><span><strong>{peek.short}</strong> {peek.live ? <>· <b className="live-text">● Live</b></> : "· No presenter now"} · {peek.people} inside<small>Step onto the carpet to join</small></span></div>}
        {booth?.live && (
          <div className="video-tiles" aria-label="Inside the booth">
            <div className="share-tile"><Icon name="monitor" />{mine && sharing ? "You are sharing" : `${booth.presenter} is sharing`}</div>
            <div className="video-tile speaking"><span className="initials">{booth.presenter.slice(0, 2).toUpperCase()}</span><small>{booth.presenter} · camera</small><Icon name="mic" /></div>
          </div>
        )}
        {step === 3 && hint && <div className="hall-hint">Move with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or click · Step onto a booth carpet to join it</div>}
      </div>

      <nav className="hall-left-tools" aria-label="Hall tools">
        {([["booths", "grid", "All booths"], ["people", "users", "People in the hall"], ["agenda", "calendar", "Agenda"], ...(role === "Admin" ? [["admin", "shield", "Admin tools"]] : [])] as [Side, string, string][]).map(([p, i, l]) => (
          <button key={p} type="button" className={`icon-btn ${side === p ? "active" : ""} ${p === "admin" ? "admin" : ""}`} aria-label={l} aria-pressed={side === p} title={l} onClick={() => open(p)}><Icon name={i} /></button>
        ))}
      </nav>

      {/* right: the booth you're standing in */}
      {booth && (boothOpen
        ? (role === "Judge" ? <RubricPanel booth={booth} onClose={() => setBoothOpen(false)} /> : <BoothPanel booth={booth} role={role} mine={mine} people={hearing.people} onClose={() => setBoothOpen(false)} />)
        : <button type="button" className="booth-mini" onClick={expandBooth} aria-label={`Show booth ${booth.no} details`}><span className="booth-code">{booth.no}</span><span><strong>{booth.short}</strong><small>{booth.live ? "Presenter is here" : "No presenter now"}</small></span>{booth.live && <Status text="Live" />}<Icon name="chevron" className="booth-mini-chevron" /></button>)}

      {chatOpen && <ChatPanel announcements={announcements} say={(t) => control.current?.say(t, "chat")} onClose={() => setChatOpen(false)} />}

      {/* left: find & go */}
      {side === "admin" && <AdminPanel onAnnounce={announce} onClose={() => setSide(null)} />}
      {side === "people" && <PeoplePanel onClose={() => setSide(null)} />}
      {side === "booths" && (
        <Frame title="All booths" onClose={() => setSide(null)}>
          <p className="field-note" style={{ marginBottom: 6 }}>{HALL_PROJECTS.length} booths in 4 zones. Pick one to walk straight there.</p>
          {Object.keys(ZONE_DOT).map((zone) => {
            const list = HALL_PROJECTS.filter((p) => p.category === zone);
            return (
              <section key={zone} className="zone-group">
                <h3><span className="zone-dot" style={{ background: ZONE_DOT[zone] }} />{zone}<small>{list.length} booths</small></h3>
                {list.map((p) => (
                  <button key={p.no} type="button" className="person" style={{ width: "100%", background: "none", textAlign: "left" }} onClick={() => goTo(p.no)}>
                    <span className="booth-code">{p.no}</span><div><strong>{p.short}</strong>{p.title !== p.short && <small>{p.title}</small>}</div>{p.live && <span style={{ marginLeft: "auto" }}><Status text="Live" /></span>}
                  </button>
                ))}
              </section>
            );
          })}
        </Frame>
      )}
      {side === "agenda" && (
        <Frame title="Today’s agenda" onClose={() => setSide(null)}>
          <Pill cls="blue">{EVENT.date}</Pill>
          {AGENDA.map((a) => <div key={a.time} style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}><span className="small-text muted">{a.time}</span><h3 style={{ fontSize: ".8125rem", marginTop: 4 }}>{a.label}</h3></div>)}
          <p className="field-note" style={{ marginTop: 12 }}>Booths are open all day. The stage and lounge are places to meet; voices there fade with distance.</p>
        </Frame>
      )}

      <div className="hall-toolbar" aria-label="Hall controls">
        {audio ? <Tool label={mic ? "Mic on" : "Mic off"} icon={mic ? "mic" : "micOff"} active={mic} cls={mic ? "" : "mic-off"} onClick={() => setMic(!mic)} /> : <Tool label="No audio" icon="micOff" cls="disabled" />}
        {mine && <Tool label={cam ? "Camera on" : "Camera off"} icon={cam ? "video" : "videoOff"} active={cam} onClick={() => setCam(!cam)} />}
        {mine && <Tool label={sharing ? "Stop share" : "Share screen"} icon="share" active={sharing} onClick={() => setSharing(!sharing)} />}
        <Tool label="Chat" icon="chat" active={chatOpen} onClick={toggleChat} />
        <span className="toolbar-separator" />
        <div className="toolbar-presence">
          <strong><span className="dot" />{hearing.inBooth ? `Booth ${hearing.inBooth} · ${hearing.people.length + 1} hear each other` : `${hearing.people.length} ${hearing.people.length === 1 ? "person" : "people"} near you`}</strong>
        </div>
        <span className="toolbar-separator" />
        <div className="react-wrap">
          <Tool label="React" icon="smile" active={reacting} onClick={() => setReacting(!reacting)} />
          {reacting && <div className="react-picker" role="menu" aria-label="Reactions">{REACTIONS.map((e) => <button key={e} type="button" role="menuitem" aria-label={`React ${e}`} onClick={() => react(e)}>{e}</button>)}</div>}
        </div>
      </div>

      <div className="hall-zoom">
        <button type="button" className="icon-btn" aria-label="Zoom out" onClick={() => zoomBy(-0.1)}><Icon name="minus" /></button>
        <span>{Math.round((zoom / START_ZOOM) * 100)}%</span>
        <button type="button" className="icon-btn" aria-label="Zoom in" onClick={() => zoomBy(0.1)}><Icon name="plus" /></button>
      </div>


      {leaving && (
        <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="survey-title" style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgb(15 26 58 / .42)" }}>
          <form className="modal" style={{ position: "static", display: "block" }} onSubmit={(e) => e.preventDefault()}>
            <h2 id="survey-title">Before you go — how was it?</h2>
            <p>One quick question. Asked once per event.</p>
            <div className="score-cells" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>{[1, 2, 3, 4, 5].map((n) => <label key={n} className="score-cell" style={{ display: "grid", placeItems: "center", height: 40, fontSize: ".875rem", cursor: "pointer" }}><input type="radio" name="sat" className="sr-only" />{n}</label>)}</div>
            <label className="field" style={{ marginTop: 16 }}>Anything to improve? <span className="field-note">optional</span><textarea style={{ minHeight: 70 }} /></label>
            <div className="modal-footer"><Link className="btn secondary" href="/home">Skip</Link><Link className="btn" href={`/e/${EVENT.slug}`}>Send & leave</Link></div>
          </form>
        </div>
      )}
      {step < 3 && (
        <div className="hall-loading" role="status" aria-live="polite">
          <div className="hall-loading-card">
            <div className="hall-loading-actor">{avatar !== null && <Actor index={avatar} walk={!failed} style={{ left: "50%", top: 0, marginLeft: -48, ["--sprite-size" as string]: "96px" }} />}</div>
            <h2>{failed ? "Can’t reach the hall right now" : `Entering ${EVENT.name}`}</h2>
            <p>{failed ? "The hall isn’t answering. Your internet looks fine, so try again in a moment." : "Your mic starts muted."}</p>
            <ol className="load-steps">
              {LOAD_STEPS.map((l, i) => {
                const state = failed && i === 1 ? "failed" : i < step ? (i === 2 && !audio ? "warn" : "done") : i === step && !failed ? (i === 2 && !audio && step === 2 ? "warn" : "now") : "todo";
                return (
                  <li key={l} className={state}>
                    {state === "done" ? <Icon name="check" /> : state === "now" ? <span className="spinner" aria-hidden="true" /> : state === "failed" || state === "warn" ? <Icon name="info" /> : <span className="todo-dot" aria-hidden="true" />}
                    <span>{l}{state === "failed" && <small>No answer from the server</small>}{state === "warn" && <small>Audio unavailable, entering without it</small>}</span>
                  </li>
                );
              })}
            </ol>
            {failed && <div className="flex" style={{ justifyContent: "center", marginTop: 20 }}><button type="button" className="btn" onClick={() => restart("ok")}>Try again</button><Link className="btn secondary" href={`/e/${EVENT.slug}`}>Browse the projects</Link></div>}
          </div>
        </div>
      )}
    </main>
  );
}

function Tool({ label, icon, active = false, cls = "", onClick }: { label: string; icon: string; active?: boolean; cls?: string; onClick?: () => void }) {
  return <button type="button" className={`tool ${active ? "active" : ""} ${cls}`} title={label} aria-label={label} onClick={onClick}><Icon name={icon} /><span>{label}</span></button>;
}

function Frame({ title, onClose, side = "left", children }: { title: string; onClose: () => void; side?: "left" | "right" | "chat"; children: React.ReactNode }) {
  // right = booth context: it collapses to a small card instead of closing (you're still in the booth)
  return (
    <aside className={`hall-panel ${side}`} aria-label={title}>
      <header className="panel-head"><h2>{title}</h2><button type="button" className="icon-btn" aria-label={side === "right" ? "Minimise panel" : "Close panel"} title={side === "right" ? "Minimise" : "Close"} onClick={onClose}><Icon name={side === "right" ? "minus" : "close"} /></button></header>
      <div className="panel-body">{children}</div>
    </aside>
  );
}

function BoothPanel({ booth, role, mine, people, onClose }: { booth: BoothInfo; role: Role; mine: boolean; people: string[]; onClose: () => void }) {
  const p = PROJECTS.find((x) => x.code === booth.no);
  const [voted, setVoted] = useState(false);
  const [contact, setContact] = useState<"closed" | "open" | "sent">("closed");
  const canMute = mine || role === "Admin";
  return (
    <Frame title={booth.short} side="right" onClose={onClose}>
      <div className="flex between"><span className="booth-code">Booth {booth.no} · {booth.category}</span>{booth.live ? <Status text="Live" /> : <Pill>No presenter now</Pill>}</div>
      <h2>{booth.title}</h2>
      {p && <p>{p.abstract}</p>}
      {p && <div className="project-poster"><Poster p={p} /></div>}
      <div className="resource"><Icon name="file" />Poster · follows the presenter&rsquo;s zoom<small>PDF</small></div>
      {!booth.live && (
        <div className="info-note" style={{ marginTop: 16, flexDirection: "column", background: "var(--lavender)", color: "#5b3fb0" }}>
          <strong className="flex"><Icon name="bot" />The team is away — ask the AI</strong>
          <span>Answers only from the team&rsquo;s poster and report.</span>
          <div className="chat-input" style={{ marginTop: 6 }}><input placeholder="How does it work offline?" aria-label="Ask the AI" /><button type="button" className="btn small">Ask</button></div>
        </div>
      )}

      {mine ? (
        <Link className="btn secondary wide small" href={`/e/${EVENT.slug}/my-booth`} style={{ marginTop: 18 }}><Icon name="monitor" />Edit booth</Link>
      ) : (
        <>
          <div className="panel-section-title">Your say</div>
          <button type="button" className={`vote-btn ${voted ? "on" : ""}`} aria-pressed={voted} onClick={() => setVoted(!voted)}>
            <Icon name="heart" /><span><strong style={{ display: "block" }}>{voted ? "You voted for this project" : "Vote for this project"}</strong><span className="field-note" style={{ color: "inherit" }}>Popular Vote · as many projects as you like, once each</span></span>
          </button>
          <label className="field" style={{ marginTop: 14 }}>Feedback for the team<textarea placeholder="What did you like? What could be better?" style={{ minHeight: 70 }} /></label>
          <label className="consent" style={{ marginTop: 8 }}><input type="checkbox" /><span>Hide my name from the team · only the team and admins see feedback</span></label>
          <button type="button" className="btn small" style={{ marginTop: 10 }}>Send feedback</button>
          {contact === "closed" && <button type="button" className="btn secondary wide small" style={{ marginTop: 14 }} onClick={() => setContact("open")}><Icon name="user" />Ask the team to contact me</button>}
          {contact === "open" && (
            <form className="surface" style={{ padding: 14, marginTop: 14 }} onSubmit={(e) => { e.preventDefault(); setContact("sent"); }}>
              <label className="field">Email<input defaultValue="nont@kmutt.ac.th" /></label>
              <label className="field" style={{ marginTop: 10 }}>Phone or LinkedIn <span className="field-note">optional</span><input /></label>
              <p className="field-note" style={{ margin: "10px 0" }}>The team will see your name, organization and what you enter.</p>
              <button type="submit" className="btn small wide">Send to the team</button>
            </form>
          )}
          {contact === "sent" && <div className="info-note" style={{ marginTop: 14, background: "var(--green-tint)", color: "var(--green)" }}><Icon name="checkCircle" />Sent. You can withdraw it any time.</div>}
        </>
      )}

      <div className="panel-section-title">In this booth · you all hear each other</div>
      {[`${booth.presenter} · Presenter`, ...people.filter((n) => !n.startsWith(booth.presenter))].map((n) => {
        const i = Math.max(0, CHARACTERS.findIndex((c) => n.startsWith(c.name)));
        const presenter = n.includes("Presenter");
        return (
          <div key={n} className="person">
            <Portrait index={i} /><div><strong>{n.split(" · ")[0]}</strong><small>{n.split(" · ")[1] ?? "Visitor"}</small></div>
            {canMute && !presenter ? <button type="button" className="btn ghost small" style={{ marginLeft: "auto" }}><Icon name="micOff" />Mute</button> : <span className="dot" />}
          </div>
        );
      })}
      {canMute && <p className="field-note" style={{ marginTop: 8 }}>Muted people can unmute themselves. Nobody can turn on someone else&rsquo;s mic.</p>}
    </Frame>
  );
}

function RubricPanel({ booth, onClose }: { booth: BoothInfo; onClose: () => void }) {
  const [values, setValues] = useState([0, 0, 0, 0]);
  const [submitted, setSubmitted] = useState(false);
  const total = RUBRIC.reduce((a, r, i) => a + values[i] * r.w, 0) / 100;
  return (
    <Frame title="Project evaluation" side="right" onClose={onClose}>
      <div className="flex between"><span className="booth-code">Booth {booth.no}</span><Pill cls={submitted ? "green" : "blue"}>{submitted ? "Submitted" : "Draft · saved"}</Pill></div>
      <h2 style={{ fontSize: "1rem" }}>{booth.title}</h2>
      <p className="field-note">Score 1–10 for each criterion. Weights come from the event&rsquo;s rubric.</p>
      {RUBRIC.map((r, j) => (
        <div key={r.k} className="rubric-item">
          <div className="rubric-label">{r.k} · {r.w}%<span>{values[j] || "–"} / 10</span></div>
          <div className="score-cells" role="group" aria-label={r.k}>
            {Array.from({ length: 10 }, (_, i) => <button key={i} type="button" disabled={submitted} className={`score-cell ${i < values[j] ? "filled" : ""}`} aria-label={`${r.k}: ${i + 1} out of 10`} onClick={() => setValues(values.map((v, k) => (k === j ? i + 1 : v)))}>{i + 1}</button>)}
          </div>
        </div>
      ))}
      <label className="field">Comment for the team<textarea placeholder="Sent after results are announced…" disabled={submitted} /></label>
      <div className="rubric-total"><span className="small-text muted">Weighted</span><strong>{total.toFixed(1)}<small> / 10</small></strong></div>
      <button type="button" className="btn wide" disabled={submitted || values.some((v) => !v)} onClick={() => setSubmitted(true)}><Icon name={submitted ? "checkCircle" : "check"} />{submitted ? "Score submitted" : "Submit score"}</button>
      <p className="field-note" style={{ textAlign: "center", marginTop: 10 }}>When the event ends, complete drafts count; incomplete ones don&rsquo;t.</p>
    </Frame>
  );
}

function AdminPanel({ onAnnounce, onClose }: { onAnnounce: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState("Judging closes in 30 minutes. Judges, please submit your drafts.");
  return (
    <Frame title="Admin tools" onClose={onClose}>
      <div className="flex between" style={{ marginBottom: 14 }}>{[["211", "in hall"], ["13", "Live"], ["2", "reports"]].map(([v, k]) => <div key={k} className="surface" style={{ padding: "8px 14px", textAlign: "center" }}><strong style={{ fontSize: "1.1rem" }}>{v}</strong><div className="field-note">{k}</div></div>)}</div>
      <label className="field">Announce to everyone<textarea placeholder="e.g. Judging closes in 30 minutes" style={{ minHeight: 60 }} value={text} onChange={(e) => setText(e.target.value)} /></label>
      <p className="field-note">Shows on everyone&rsquo;s screen and stays in the Everyone chat.</p>
      <button type="button" className="btn small" style={{ marginTop: 8 }} disabled={!text.trim()} onClick={() => { onAnnounce(text.trim()); setText(""); }}><Icon name="megaphone" />Send</button>
      <div className="panel-section-title">Reports</div>
      {["Rude messages in nearby chat · Ren", "Shouting in booth 04 · Sora"].map((t) => (
        <div key={t} className="notice" style={{ marginBottom: 8, flexDirection: "column" }}><strong>{t}</strong><div className="flex"><button type="button" className="btn secondary small">Mute</button><button type="button" className="btn secondary small">Kick</button><button type="button" className="btn dark small">Ban</button></div></div>
      ))}
      <p className="field-note">Kick = removed, can come back · Ban = can&rsquo;t enter this event again.</p>
      <label className="module-row"><h3>Stop new arrivals</h3><input type="checkbox" className="switch" aria-label="Stop new arrivals" /></label>
      <label className="module-row"><h3>Mute everyone</h3><input type="checkbox" className="switch" aria-label="Mute everyone" /></label>
      <div className="info-note"><Icon name="users" />Click someone in People in the hall to make them a Presenter, Judge or Admin.</div>
    </Frame>
  );
}

const PEOPLE_FILTERS: [string, Role | null][] = [["Everyone", null], ["Presenters", "Presenter"], ["Judges", "Judge"], ["Organizers", "Admin"]];

function PeoplePanel({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<Role | null>(null);
  const [q, setQ] = useState("");
  const shown = HALL_PEOPLE.filter((p) => (!filter || p.role === filter) && p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Frame title={`People in the hall · ${EVENT.inHall}`} onClose={onClose}>
      <div className="search" style={{ marginBottom: 10 }}><Icon name="search" /><input className="search-input" type="search" aria-label="Search people" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="chips" style={{ marginBottom: 6 }}>{PEOPLE_FILTERS.map(([l, r]) => <button key={l} type="button" className={`chip ${filter === r ? "active" : ""}`} style={{ padding: "5px 11px" }} aria-pressed={filter === r} onClick={() => setFilter(r)}>{l}</button>)}</div>
      <div className="people-list">
        {shown.length ? shown.map((p) => (
          <div key={p.name} className="person">
            <Portrait index={p.avatar} />
            <div><strong>{p.name}</strong><small>{p.where}</small></div>
            {p.role !== "Visitor" && <span className="person-tags"><RoleChip role={p.role} /></span>}
          </div>
        )) : <p className="body-text" style={{ paddingTop: 12 }}>Nobody by that name is in the hall right now.</p>}
      </div>
      <p className="field-note" style={{ marginTop: 12 }}>Showing {shown.length} of {EVENT.inHall}. Search to find someone.</p>
    </Frame>
  );
}

// Nearby: no history — messages show up, float above heads and fade (~5 s) · Everyone: history for the event, announcements included
function ChatPanel({ announcements, say, onClose }: { announcements: Announcement[]; say: (text: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"Nearby" | "Everyone">("Nearby");
  const [draft, setDraft] = useState("");
  const [nearby, setNearby] = useState<{ id: number; who: string; text: string }[]>([{ id: 0, who: "Prae", text: "Hi! Want to see how our sign-language model works?" }]);
  const [mine, setMine] = useState<{ who: string; text: string }[]>([]);
  useEffect(() => {
    const t = nearby.map((m) => setTimeout(() => setNearby((l) => l.filter((x) => x.id !== m.id)), 5000));
    return () => t.forEach(clearTimeout);
  }, [nearby]);
  const everyone: { who: string; text: string; time?: string; announce?: boolean }[] = [
    { who: "Mika", text: "Booth 02 is amazing, go see it", time: "12:48" },
    ...announcements.map((a) => ({ who: "Organizers", text: a.text, time: a.time, announce: true })),
    ...mine,
  ];
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (tab === "Nearby") { setNearby((l) => [...l, { id: Date.now(), who: "You", text }]); say(text); } else setMine((l) => [...l, { who: "You", text }]);
    setDraft("");
  };
  return (
    <Frame title="Chat" side="chat" onClose={onClose}>
      <div className="role-segment">{(["Nearby", "Everyone"] as const).map((t) => <button key={t} type="button" className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>)}</div>
      <p className="field-note" style={{ marginBottom: 16 }}>{tab === "Nearby" ? "Only people close to you. Messages fade after a few seconds and aren’t kept." : "The whole hall, including announcements. Cleared when the event ends."}</p>
      <div className="chat-messages" aria-live="polite">
        {tab === "Nearby"
          ? nearby.length ? nearby.map((m) => <div key={m.id} className="chat-fade"><div className="chat-name">{m.who}</div><div className={`chat-bubble ${m.who === "You" ? "you" : ""}`}>{m.text}</div></div>) : <p className="body-text muted">Nothing right now. Say hi to whoever is close by.</p>
          : everyone.map((m, i) => m.announce
            ? <div key={i} className="chat-announce"><div className="chat-name"><Icon name="megaphone" />Announcement<span>{m.time}</span></div><div>{m.text}</div></div>
            : <div key={i}><div className="chat-name">{m.who}{m.time && <span>{m.time}</span>}</div><div className={`chat-bubble ${m.who === "You" ? "you" : ""}`}>{m.text}</div></div>)}
      </div>
      <form className="chat-input" onSubmit={send}><input aria-label="Your message" placeholder={tab === "Nearby" ? "Say something to people nearby…" : "Message everyone…"} value={draft} onChange={(e) => setDraft(e.target.value)} /><button className="btn small" aria-label="Send" type="submit"><Icon name="arrow" /></button></form>
      <button type="button" className="btn ghost small" style={{ marginTop: 10 }}>Report a message</button>
    </Frame>
  );
}
