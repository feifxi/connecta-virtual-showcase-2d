# Connecta — Capstone CP26SSI3

> Instructions for every AI agent on the team (Claude Code reads this via `CLAUDE.md` · Codex reads `AGENTS.md` directly) · **edit this file only**

Main repo of the capstone project · Connecta — an online platform for presenting student work: visitors walk between booths in a 2D world and talk live with presenters.

## Docs

| File | Purpose |
|---|---|
| `docs/connecta.md` | ⭐ Product & Business: direction · pain · solution · target · value & competition · business model · SDG · risks |
| `docs/features.md` | ⭐ Feature spec: shared rules · core/cut order · Release plan · roles · per-feature spec (why · who does what · on/off · who sees · plan · rules · won't do · data · tests) |
| `docs/data-model.md` | ⭐ Database design: tables · constraints · indexes · enums · event status · data not stored · in-memory state · files · lifecycle/PDPA |
| `docs/api.md` | ⭐ All REST endpoints · errors · status codes · Colyseus messages · LiveKit permissions |
| `docs/technical.md` | ⭐ Stack · versions · architecture · ports · deployment · technical references |
| `poc/README.md` | ⭐ Everything POC: spike plan · status · how to test · results · capacity · VM spec · requests to IT · fallbacks |
| `docs/archive/` | Don't read unless asked · old versions of `connecta.md` · external committee consult notes (ours + other teams) · proposal template |

## Direction

- **Focus on student work presentations** (capstone showcases · in-course poster sessions) — close to us, testable for real, and something Zoom/Teams do poorly
- The 2D-world core works for any domain → if a better insight appears (e.g. academic conference poster sessions), the use case can shift without a rewrite
- Details in `docs/connecta.md` · **before writing code, read `docs/features.md` · `docs/data-model.md` · `docs/technical.md`**

## Doc rules

- Versioning applies only to `connecta.md` (Product & Business) · edit `features.md` · `data-model.md` · `api.md` · `technical.md` in place · adding or changing a feature must answer the checklist at the top of `features.md` and keep `data-model.md` and `api.md` in sync
- Major direction change → move the current file to `docs/archive/deprecated-connecta-vN.md` (N = next number after the latest in archive), then write a new `docs/connecta.md`
- A new file must **replace the old one 100%** — carry over everything still valid · **never reference the old file**
- Archive file names: `deprecated-<name>-vN.md`
- Docs no longer needed may be deleted (history is in git) · except `connecta.md`, which goes to `archive/` per the versioning rule

## Working style

- **Reply to the user and write docs in Thai** · keep English loanwords (Presenter, Booth, Judge) instead of translating · agent-only files (`AGENTS.md`, `CLAUDE.md`, agent memory) are in English
- **Don't guess — research** and cite sources · answer directly, no flattery
- Docs are **concise**, readable by humans and agents · no over-explaining · no extra blank lines
- **Write only the current state** — never say what it was before, what changed, or what's new (no "เดิม" · "🆕" · "เปลี่ยนจาก" · edit dates) · history lives in git and `archive/`
- **Once decided, write only the choice** + a short reason · don't keep option comparisons
- **Pain → Solution first, then strengths** · never let a strength change the product's identity
- **No self-deprecating or defensive writing** (e.g. "we don't compete on X because big players already do") · highlight strengths without overclaiming
- **Never alter core definitions the user/team wrote** (concept · pain points · problem statement) · show big edits first · when condensing, never silently drop the user's content — say what was cut
- Proposal content is **sent in chat**, not written to files, unless asked · if it will be pasted into Word: no code blocks · no `<br>` · tables ≤ 4 columns
- Student project: **no need to beat competitors**, but must explain how we differ · learning patterns from big players is fine
- Never commit `.env`/keys (use `.env.example`) · large files (video, heavy slides) go to Drive with a link, or Git LFS · repo is private

## Course criteria (INT365/371)

| Exam | When | Assessed |
|---|---|---|
| Exam 2 Pre-Game (30) | ✅ done 19–20 Oct 2026 | POC · R1 technical design · Revised IT Solution · Roadmap |
| Exam 3 Release 1 (35) | 30 Nov 13:30–18:00 / 1 Dec 09:00–18:00 (tentative) | Progress/difficulty/workload 13 · Potentially Shippable Increment 7 (normal + exception test cases · exception handling · no errors · **deployed on a server, not localhost**) · AI-assisted development evidence 5 · system understanding 10 · individual Retrospective Report |

- **Release 1 = at least 1 core feature end-to-end Frontend → Backend → DB** · login does not count as a core feature
- Requirements data must come from target users **who are not the dev team** · larger systems expected (many users · platform · personal data) · AI features graded Low / Intermediate / Advance
- Presentation + Q&A scored over 3 rounds · dress-code violation −2 team points · meet the advisor ≥ 7 times (Project Management score)
- Course budget ≤ 3,000 THB/team · **infrastructure (server/cloud) is not reimbursable** · work is university copyright · D-Day late April

**What instructors emphasize**: Pain → Challenge → Solution → Outcome · measure **Outcome** (users actually benefit), not Output (a system exists) · Challenge must be a user behavior/constraint, not "no system exists yet" (instructor's example: building a review system is easy, getting people to write reviews is hard)

**External committee doesn't ask technical questions** — only value · who uses / who pays · why not Zoom / MS365 / Google Workspace / Gather → details in `docs/archive/consult_connecta.md`

## Team

- CP26SSI3 · advisor: อ.สนิท ศิริสวัสดิ์วัฒนา
- Members: กิตติกัญ วิวเมฆ · ณัฐชนน เจริญเสริมสิริ · สุชัย ชลชัยไพศาล · exam roles: UX/UI · front end · back end
- **Overlapping topics in our cohort**: KMUTT Event Discovery and Management System · ระบบจัดการเข้าชมและประเมินโครงงานปี 4 (year-4 project visit & evaluation system) · แพลตฟอร์มนำเสนอแบบมีปฏิสัมพันธ์สำหรับห้องเรียน มจธ. (interactive classroom presentation platform) → our difference: an online event you can walk through and talk live in

## Technical

- Stack · architecture in `docs/technical.md` · spikes and test results in `poc/README.md`
- **nginx** (team has experience) · must configure: certbot · WebSocket headers (`Upgrade`/`Connection`) · TURN over TLS on 443 via `stream` + `ssl_preread`
- Spikes **S1–S7** (S1 Phaser 4+Tiled · S2 LiveKit hello · S3 Movement sync · S4 Proximity media · S5 booth-zone audio · S6 Poster/3D viewer sync · S7 NAT+TURN) · S1–S6 = one POC app · S7 tested on a separate VM · S1–S4 done · S5–S7 remaining (S7 before Exam 3) · status in `poc/README.md`
- Don't open the `poc-connecta` repo

## Coding rules

- **POC: one spike at a time · when a spike ends, stop, report results, and wait for the POC owner's approval before the next** · never skip ahead · tag `s<N>-done` after approval (full rules in `poc/README.md`)
- **Phaser 4, not Phaser 3** — AI tends to mix in v3 APIs (e.g. `setTintFill()`, `Geom.Point`, custom pipelines, Mesh) · check unfamiliar APIs against v4 docs and the [migration guide](https://phaser.io/news/2026/04/migrating-from-phaser-3-to-phaser-4-what-you-need-to-know) · v3 examples (e.g. SkyOffice) are guidance only and must be converted
- **Never leave servers/processes running** — stop every process you started after testing, then give the user the commands to run it themselves
- Fast-changing libraries (Colyseus · LiveKit · Next.js · Better Auth): check the version in `package.json` and read that version's docs, don't rely on memory · Next.js docs for the installed version are in `node_modules/next/dist/docs/` · Phaser's in `node_modules/phaser/skills/`
- **Never trust the client** — role checks on all 3 paths: REST · WebSocket messages · LiveKit token issue / permission change (all shared rules in `docs/features.md`)

## Repo layout

- npm workspaces · `apps/web` (Next.js + Phaser 4 + Better Auth) · `apps/api` (NestJS) · `apps/realtime` (Colyseus) · `packages/db` (Prisma schema, migrations, seed) · `packages/shared` (zod schemas, constants, hall map/placement logic) · `infra/` (docker-compose, nginx, LiveKit, deploy)
- Dev: `cp .env.example .env` → `npm install` → `npm run infra:up` → `npm run db:migrate` → `npm run db:seed` → `npm run dev:api` · `dev:realtime` · `dev:web`
- `poc/` experiments before implementation · `poc/demo-app/` the single POC app (`web/` + `realtime/`) grown spike by spike S1–S6 · other `poc/` folders: UI mockups · 2D maps · everything POC is documented in `poc/README.md`

## Next up

1. Exam 3 Release 1 (30 Nov): implement in `apps/` + deploy on a server · scope in `docs/features.md` → Release plan · UI uses `poc/ui-mockup-v2/` as the main theme
2. Team writes the one-liner · pain · problem statement themselves, replacing the draft in `docs/connecta.md`
3. Survey done (users confirm time/travel is the main pain) · still to do: interview D-Day organizers / course instructors · business feasibility needs data from real target users (not the team)
4. UI mockups v1 + v2 match `docs/features.md` (page list in `poc/README.md`) · pages not built yet: Profile · Billing · Platform Console · Presenter summary · project submission form
5. Check whether SpatialChat has judging
