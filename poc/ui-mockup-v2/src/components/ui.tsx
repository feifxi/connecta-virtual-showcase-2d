import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { PATHS } from "@/lib/icons";
import { CHARACTERS, EVENT, type Project, type Role } from "@/lib/data";
import { Actor } from "./actor";

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.grid} />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="Connecta home">
      <span className="brand-mark" aria-hidden="true" />
      <span translate="no">Connecta</span>
    </Link>
  );
}

export function Btn({ href, children, cls = "", icon }: { href: string; children: ReactNode; cls?: string; icon?: string }) {
  return <Link className={`btn ${cls}`} href={href}>{icon && <Icon name={icon} />}{children}</Link>;
}

export function Pill({ children, cls = "", style }: { children: ReactNode; cls?: string; style?: CSSProperties }) {
  return <span className={`pill ${cls}`} style={style}>{children}</span>;
}

// "● Live" = a presenter is inside the booth right now
export function Status({ text = "Live now", count }: { text?: string; count?: string | number }) {
  return <Pill cls="live"><span className="dot" />{text}{count !== undefined ? ` · ${count}` : ""}</Pill>;
}

const ROLE_CLS: Record<Role, string> = { Admin: "lav", Presenter: "green", Judge: "blue", Visitor: "" };
export function RoleChip({ role }: { role: Role }) {
  return <Pill cls={ROLE_CLS[role]}>{role}</Pill>;
}

export function Initials({ name, size = 36 }: { name: string; size?: number }) {
  const t = name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  return <span className="avatar-dot" style={{ width: size, height: size }}>{t}</span>;
}

const FACE_TONES = ["#ffe6d8", "#e5f5ed", "#fff4cf", "#e6dcfb", "#e8efff"];

// Character heads on pastel circles, overlapping · extra = "+N" bubble at the end
export function AvatarStack({ ids = [8, 9, 12], extra }: { ids?: number[]; extra?: number }) {
  return (
    <div className="avatar-stack" aria-hidden="true">
      {ids.map((i) => <span key={i} className="mini-face" style={{ backgroundColor: FACE_TONES[i % FACE_TONES.length], backgroundImage: `url(${CHARACTERS[i].portrait})` }} />)}
      {extra ? <span className="mini-face more">+{extra}</span> : null}
    </div>
  );
}

export function Portrait({ index, size = 41 }: { index: number; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={CHARACTERS[index].portrait} width={size} height={size} alt="" style={{ width: size, height: size, imageRendering: "pixelated", background: "var(--subtle)", borderRadius: 10, objectFit: "contain" }} />;
}

export function Header({ home = false, active }: { home?: boolean; active?: string }) {
  const links: [string, string][] = [["Events", "/explore"], ["My events", "/home"], ["For organizers", `/manage/${EVENT.slug}`]];
  return (
    <header className={home ? "home-nav" : "nav-wrap"}>
      <nav className="nav container" aria-label="Main navigation">
        <Brand />
        <div className="nav-links">
          {links.map(([l, h]) => <Link key={l} href={h} className={active === l ? "active" : ""}>{l}</Link>)}
        </div>
        <div className="nav-actions">
          {home ? (
            <>
              <Btn href="/login" cls="ghost">Log in</Btn>
              <Btn href="/login">Create event</Btn>
            </>
          ) : (
            <>
              <button type="button" className="icon-btn" aria-label="Notifications"><Icon name="bell" /></button>
              <span className="divider" />
              <Link className="avatar-pill" href="/profile" aria-label="Open your profile"><span className="avatar-dot">N</span><Icon name="down" /></Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

const ADMIN_LINKS: [string, string, string][] = [
  ["Overview", "", "grid"], ["Projects & hall", "/projects", "monitor"], ["People & roles", "?tab=people", "users"],
  ["Judging", "?tab=judging", "trophy"], ["Event report", "/analytics", "chart"], ["Moderation", "?tab=moderation", "shield"], ["Settings", "?tab=settings", "settings"],
];

export function Workspace({ active, children, kind = "admin" }: { active: string; children: ReactNode; kind?: "admin" | "presenter" | "judge" }) {
  const links: [string, string, string][] = kind === "admin"
    ? ADMIN_LINKS.map(([l, h, i]) => [l, `/manage/${EVENT.slug}${h}`, i])
    : kind === "presenter"
      ? [["My booth", `/e/${EVENT.slug}/my-booth`, "monitor"], ["Visit the hall", `/e/${EVENT.slug}/hall?as=Presenter`, "map"], ["Event page", `/e/${EVENT.slug}`, "calendar"]]
      : [["Judging list", `/e/${EVENT.slug}/judge`, "trophy"], ["Visit the hall", `/e/${EVENT.slug}/hall?as=Judge`, "map"], ["Event page", `/e/${EVENT.slug}`, "calendar"]];
  return (
    <>
      <Header active={kind === "admin" ? "For organizers" : "My events"} />
      <div className="workspace page">
        <aside className="sidebar">
          <div className="sidebar-caption">{kind === "admin" ? "Your showcase" : kind === "presenter" ? "Presenter workspace" : "Judge workspace"}</div>
          {links.map(([l, h, i]) => <Link key={l} href={h} className={active === l ? "active" : ""} title={l}><Icon name={i} /><span>{l}</span></Link>)}
          <div className="sidebar-event"><Status text="Event is live" /><p><strong>{EVENT.name}</strong><br />16 Oct, {EVENT.time}<br />Ends by itself at {EVENT.ends}</p></div>
        </aside>
        <main id="main" className="workspace-main">{children}</main>
      </div>
    </>
  );
}

export function Kpis({ items }: { items: [string, string, string, string][] }) {
  return (
    <div className="kpi-grid">
      {items.map(([l, v, n, i]) => (
        <div key={l} className="surface kpi"><div className="kpi-label">{l}<Icon name={i} /></div><div className="kpi-value">{v}</div><div className="kpi-note">{n}</div></div>
      ))}
    </div>
  );
}

const POSTER_COLORS = { blue: ["#e8efff", "#1d5cf5", "#97b3fc"], purple: ["#ede5fb", "#7651b1", "#c4afe9"], green: ["#e4f2df", "#36865e", "#a7ce98"], orange: ["#fff0df", "#c56f27", "#f1c390"] } as const;

// Resolution-independent project poster (from TestUI)
export function Poster({ p }: { p: Project }) {
  const [bg, ink, soft] = POSTER_COLORS[p.color];
  return (
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`${p.short} project poster`}>
      <rect width="320" height="200" fill={bg} />
      <circle cx="291" cy="48" r="76" fill={soft} opacity=".45" />
      <circle cx="290" cy="48" r="55" fill="none" stroke={ink} strokeOpacity=".12" />
      <text x="24" y="35" fill={ink} fontSize="10" fontFamily="sans-serif" fontWeight="700">BOOTH {p.code} / SENIOR DESIGN SHOWCASE</text>
      <text x="24" y="78" fill="#0f1a3a" fontSize="29" fontFamily="sans-serif" fontWeight="800">{p.short}</text>
      <text x="24" y="104" fill={ink} fontSize="10" fontFamily="sans-serif">{p.tag}</text>
      <path d="M24 133h113m-113 11h94m-94 11h107" stroke={ink} strokeWidth="3" opacity=".3" />
      <rect x="24" y="175" width="36" height="3" rx="1.5" fill={ink} />
      <text x="68" y="179" fill={ink} fontSize="8" fontFamily="sans-serif">Explore the project. Meet the people.</text>
      <circle cx="238" cy="79" r="31" fill="none" stroke={ink} strokeWidth="8" />
    </svg>
  );
}

export function EventArt({ art, title, sub, actor }: { art: "map" | "purple" | "orange"; title?: ReactNode; sub?: string; actor?: number }) {
  if (art === "map") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src="/assets/images/hall-reference.png" width={1536} height={855} alt="A top-down exhibition hall with booths and a stage" loading="lazy" />;
  }
  return (
    <div className={`event-art ${art}`}>
      <div className="art-orbit" />
      <strong>{title}</strong>
      <span>{sub}</span>
      {actor !== undefined && <Actor index={actor} walk style={{ position: "absolute", left: "auto", right: 24, top: 66, ["--sprite-size" as string]: "80px" }} />}
    </div>
  );
}

export function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><Icon name="search" /><h3>{title}</h3><p className="body-text">{text}</p></div>;
}
