"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AvatarStack, Empty, Icon, Pill, Poster } from "@/components/ui";
import { CATEGORIES, PROJECTS, type Project } from "@/lib/data";

const FILTERS = ["All projects", ...CATEGORIES] as const;

export function ProjectGrid({ slug }: { slug: string }) {
  const [filter, setFilter] = useState<string>("All projects");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Project | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const shown = PROJECTS.filter((p) => (filter === "All projects" || p.category === filter) && `${p.title} ${p.code} ${p.tag}`.toLowerCase().includes(q.toLowerCase()));
  const show = (p: Project) => { setOpen(p); dialog.current?.showModal(); };
  return (
    <>
      <div className="project-toolbar">
        <div className="chips">{FILTERS.map((f) => <button key={f} type="button" className={`chip ${filter === f ? "active" : ""}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>)}</div>
        <div className="search"><Icon name="search" /><input className="search-input" type="search" aria-label="Search projects" placeholder="Search title, team or tag…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="project-grid">
        {shown.length ? shown.map((p) => (
          <button key={p.code} type="button" className="project-card" onClick={() => show(p)}>
            <div className="card-top"><span className="booth-code">Booth {p.code}</span><Pill>{p.category}</Pill></div>
            <h3>{p.title}</h3>
            <p className="project-abstract">{p.abstract}</p>
            <div className="project-foot"><AvatarStack ids={p.team} /><span>Team {p.short}</span><span className="project-tag">{p.tag}</span></div>
          </button>
        )) : <Empty title="No projects found" text="Try another word or zone." />}
      </div>
      <dialog ref={dialog} className="modal" aria-labelledby="project-title" onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
        <button type="button" className="icon-btn modal-close" aria-label="Close dialog" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
        {open && (
          <>
            <div className="flex between"><span className="booth-code">Booth {open.code}</span><Pill>{open.category}</Pill></div>
            <h2 id="project-title" style={{ margin: "18px 0 8px" }}>{open.title}</h2>
            <p>{open.abstract}</p>
            <div className="project-poster"><Poster p={open} /></div>
            <div className="modal-footer"><Link className="btn" href={`/e/${slug}/join`}>Go to this booth <Icon name="arrow" /></Link></div>
          </>
        )}
      </dialog>
    </>
  );
}
