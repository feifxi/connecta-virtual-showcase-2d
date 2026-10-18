"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SCREENS } from "@/lib/data";
import { Icon } from "./ui";

// One floating "Demo" panel for every mockup-only control · pages put their own options in it with <DemoControls>
let slot: HTMLElement | null = null;
const subs = new Set<() => void>();
const setSlot = (el: HTMLElement | null) => { slot = el; subs.forEach((f) => f()); };
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function DemoControls({ children }: { children: ReactNode }) {
  const el = useSyncExternalStore(subscribe, () => slot, () => null);
  return el ? createPortal(children, el) : null;
}

// a labelled row of options · pass links (URL states) or buttons (client states)
export function DemoGroup({ label, children }: { label: string; children: ReactNode }) {
  return <div className="demo-group" role="group" aria-label={label}><span>{label}</span><div className="demo-options">{children}</div></div>;
}

export function DemoOption({ active, href, onClick, children }: { active: boolean; href?: string; onClick?: () => void; children: ReactNode }) {
  return href
    ? <Link href={href} className={active ? "active" : ""} aria-current={active ? "true" : undefined}>{children}</Link>
    : <button type="button" className={active ? "active" : ""} aria-pressed={active} onClick={onClick}>{children}</button>;
}

export function PreviewTools() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const path = usePathname();
  const inHall = path.endsWith("/hall");
  useEffect(() => { dialog.current?.close(); }, [path]);
  return (
    <>
      <div className={`demo-panel ${inHall ? "in-hall" : ""}`} aria-label="Mockup controls">
        <div className="demo-body" hidden={!open}>
          <button type="button" className="demo-screens" onClick={() => dialog.current?.showModal()}><Icon name="grid" />All screens <span>{SCREENS.length}</span></button>
          <div ref={setSlot} />
        </div>
        <button type="button" className="demo-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name={open ? "close" : "settings"} />Demo</button>
      </div>
      <dialog ref={dialog} className="modal page-picker" aria-labelledby="pages-title" onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
        <button type="button" className="icon-btn modal-close" aria-label="Close dialog" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
        <h2 id="pages-title">Take a look around.</h2>
        <p>Every screen of the current spec in one interactive preview. Each page&rsquo;s states are in the Demo panel.</p>
        <div className="page-links">
          {SCREENS.map(([href, name, desc, icon]) => (
            <Link key={href} href={href} className={`page-link ${path === href ? "current" : ""}`}><Icon name={icon} /><div>{name}<small>{desc}</small></div></Link>
          ))}
        </div>
      </dialog>
    </>
  );
}
