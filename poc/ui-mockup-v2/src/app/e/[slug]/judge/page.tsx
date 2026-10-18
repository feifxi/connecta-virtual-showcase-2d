"use client";

import { useState } from "react";
import { Btn, Icon, Pill, Workspace } from "@/components/ui";
import { EVENT, PROJECTS, RUBRIC } from "@/lib/data";

type Sheet = "Submitted" | "Draft" | "Not started";
const SHEETS: Sheet[] = ["Submitted", "Draft", "Not started", "Submitted", "Draft", "Not started"];
const SHEET_CLS: Record<Sheet, string> = { Submitted: "green", Draft: "live", "Not started": "" };

// Judge's assigned projects · score here or from the booth panel in the hall (same API)
export default function JudgeList() {
  const [open, setOpen] = useState(1);
  const [values, setValues] = useState([7, 8, 0, 0]);
  const p = PROJECTS[open];
  const done = SHEETS.filter((s) => s === "Submitted").length;
  const total = RUBRIC.reduce((a, r, i) => a + values[i] * r.w, 0) / 100;
  return (
    <Workspace active="Judging list" kind="judge">
      <div className="section-heading">
        <div><div className="flex" style={{ marginBottom: 9 }}><Pill cls="blue">Judge</Pill><span className="small-text muted">{done} of {PROJECTS.length} submitted</span></div><h1>Your judging list</h1><p>Scoring closes when the event ends at {EVENT.ends}. Complete drafts count; incomplete ones don&rsquo;t.</p></div>
        <Btn href={`/e/${EVENT.slug}/hall?as=Judge`} icon="arrow">Enter the hall</Btn>
      </div>
      <div className="workspace-grid">
        <section className="surface">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Booth</th><th>Project</th><th>Your score</th></tr></thead>
              <tbody>
                {PROJECTS.map((x, i) => (
                  <tr key={x.code} onClick={() => setOpen(i)} style={{ cursor: "pointer", background: open === i ? "var(--blue-tint)" : undefined }}>
                    <td><span className="booth-code">{x.code}</span></td>
                    <td><strong style={{ fontWeight: 600 }}>{x.short}</strong><div className="small-text muted">{x.category}</div></td>
                    <td><Pill cls={SHEET_CLS[SHEETS[i]]}>{SHEETS[i]}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <aside className="surface panel-card">
          <div className="flex between"><span className="booth-code">Booth {p.code}</span><Pill cls="blue">Draft · saved</Pill></div>
          <h2 style={{ fontSize: "1rem", margin: "12px 0 6px" }}>{p.title}</h2>
          <Btn href={`/e/${EVENT.slug}/hall?as=Judge`} cls="secondary small" icon="map">Go to the booth</Btn>
          {RUBRIC.map((r, j) => (
            <div key={r.k} className="rubric-item">
              <div className="rubric-label">{r.k} · {r.w}%<span>{values[j] || "–"} / 10</span></div>
              <div className="score-cells" role="group" aria-label={r.k}>
                {Array.from({ length: 10 }, (_, i) => <button key={i} type="button" className={`score-cell ${i < values[j] ? "filled" : ""}`} aria-label={`${r.k}: ${i + 1} out of 10`} aria-pressed={values[j] === i + 1} onClick={() => setValues(values.map((v, k) => (k === j ? i + 1 : v)))}>{i + 1}</button>)}
              </div>
            </div>
          ))}
          <label className="field">Comment for the team<textarea placeholder="Sent after results are announced…" /></label>
          <div className="rubric-total"><span className="small-text muted">Weighted</span><strong>{total.toFixed(1)}<small> / 10</small></strong></div>
          <button type="button" className="btn wide" disabled={values.some((v) => !v)}><Icon name="check" />Submit score</button>
        </aside>
      </div>
    </Workspace>
  );
}
