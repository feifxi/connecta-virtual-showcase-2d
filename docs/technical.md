# Connecta — Technical

> stack · architecture · deployment · reference ด้านเทคนิค · อิง `connecta-v3.md` และ `features.md`

## Stack

| ชั้น | เลือก | เหตุผลหลัก |
|---|---|---|
| Language | **TypeScript** ทั้งระบบ | ชั้น realtime อยู่บน Node อยู่แล้ว ถ้า API ใช้ภาษาอื่นต้องดูแลเครื่องมือและประกาศโครงสร้างข้อมูลซ้ำสองชุด |
| Rendering | **Phaser 4** | tilemap · collision · camera · sprite animation ครบในตัว · เริ่มจาก template ทางการ `phaserjs/template-nextjs` |
| Map | **Tiled** → export JSON | template ฮอลล์ preset มี "ช่องบูธ" ให้ระบบเติมผลงานอัตโนมัติ · เก็บเป็น `map_json` + `booth_slots` เพื่อให้ map editor ในเว็บ (ภายหลัง) สร้างรูปแบบเดียวกันได้ |
| Web | **Next.js (App Router)** | หน้า public (หน้างาน + รายการผลงาน) ได้ SEO/OG ใน codebase เดียว |
| Realtime | **Colyseus** | room lifecycle · delta state sync · client SDK สำเร็จรูป · 1 room ต่อ 1 ฮอลล์ · `StateView` แยกข้อมูลตามโซน |
| API | **NestJS** | โครงสร้างบังคับ เหมาะทีมหลายคน · guard เป็นที่ของ permission · แยก service จาก Colyseus |
| Media | **LiveKit** (self-host) | SFU + TURN/TLS ในตัวเดียว · เปลี่ยนสิทธิ์ publish / mute ฝั่ง server ได้ (เสียงโซนบูธ · mute โดย Presenter) |
| DB | **PostgreSQL + Prisma + pgvector** | ข้อมูลเชิง relation + vector สำหรับ RAG ในที่เดียว |
| Cache | **Redis** | MVP ยังไม่ใช้จริง แต่วาง interface ไว้ |
| Storage | **MinIO** (S3-compatible) | โปสเตอร์ · สไลด์ · โมเดล 3D · serve ด้วย signed URL |
| Auth | **Better Auth** (self-host) · Microsoft + Google + magic link | บังคับ login ทุกคน ไม่มี guest · user/session อยู่ใน Postgres ของเราเอง · มี magic link · rate limit · account linking · JWT/JWKS ในตัว · Auth.js อยู่ในการดูแลของทีม Better Auth และทีมแนะนำให้โปรเจคใหม่ใช้ Better Auth |
| AI | **LLM API + pgvector** | AI ผู้ช่วยตอบเรื่องผลงาน (RAG) · AI สรุป feedback |
| 3D | **`<model-viewer>`** | ดูโมเดล `.glb` ในบูธ ไม่ต้องเขียน three.js เอง (Could) |
| Poster | PDF → รูปตอนอัปโหลด (server) | ซูม/ชี้ sync ผ่าน Colyseus |
| Infra | **Docker Compose + nginx** บน VM ของมหาวิทยาลัย | ฟรี · ย้ายขึ้น cloud ได้โดยไม่ต้องแก้โค้ด · nginx เพราะทีมมีประสบการณ์ |

**ขนาดงานเป้าหมาย**: 150 คนพร้อมกันต่อ 1 ฮอลล์ (ประมาณจาก D-Day 600+ คนทั้งวัน · 39 ผลงาน) · เพดาน 300 คน/ฮอลล์ · capacity และสเปก VM อยู่ใน `poc/README.md`

**Frontend ใน `apps/web`** (mockup ใน `poc/` ไม่ได้ใช้ชุดนี้ · ย้ายมาเป็นแอปจริงต้องเขียนใหม่ตามนี้ ไม่ copy ตรงๆ)
- Styling: **Tailwind v4** · token สี/ฟอนต์/ขนาดตัวอักษรจาก theme `ui-mockup-v2` อยู่ใน `@theme` · ไม่ใช้ inline style และ CSS ไฟล์ใหญ่ไฟล์เดียว
- UI พื้นฐาน: **shadcn/ui** แต่งเป็นหน้าตา v2 (Dialog · DropdownMenu · Popover · Tabs · Tooltip) + **sonner** (toast) · ได้ focus trap · Esc · คีย์บอร์ดครบ · icon ใช้ **lucide-react**
- State: **Zustand** (`hallStore` สถานะในฮอลล์ · Phaser ส่ง event เข้า store) + **TanStack Query** (ข้อมูลจาก REST · cache · loading/error)
- Type ของ API: NestJS สร้าง OpenAPI → **openapi-typescript + openapi-fetch** · type ที่ใช้ร่วมอื่นๆ อยู่ใน `packages/`
- Form: **React Hook Form + Zod** (สร้างงาน · แก้บูธ · rubric)
- โครง code: แยกตาม feature เช่น `features/hall/` → `HallToolbar` · `BoothPanel` · `ChatPanel` · `PeoplePanel` · ไม่รวมไว้ในไฟล์เดียว
- Test: **Vitest + Testing Library** (unit) · **Playwright** (E2E) · Prettier + ESLint (ต้องผ่าน `react-hooks`)
- ไม่ใช้: MUI / Chakra (หน้าตาสำเร็จรูปดึงออกจาก theme) · Redux (หนักเกินขนาดโปรเจค) · styled-components (ซ้อนกับ Tailwind · ไม่เข้ากับ Server Components) · axios (openapi-fetch ใช้ `fetch` อยู่แล้ว · `fetch` ใน Server Components ใช้ cache ของ Next.js ได้)

**Phaser 4**
- ⚠️ AI มักเขียน API ของ v3 (`setTintFill()` · `Geom.Point` · custom pipeline · Mesh) → ตรวจกับ docs v4 / migration guide ก่อน
- ตัวอย่างโค้ด v3 (เช่น SkyOffice) ใช้เป็นแนวทางได้แต่ต้องแปลง
- plugin ของ community (เช่น rexUI) ต้องเช็คว่ารองรับ v4 · UI ทำด้วย React
- ⚠️ ห้ามใช้ `Graphics.generateTexture()` — ถือ scene และ WebGL context ของทุก game ที่ถูก destroy ไว้ผ่าน `Graphics.TargetCamera` (memory leak) · ใช้ไฟล์รูปแทน
- Phaser ต้องโหลดฝั่ง client เท่านั้น (`next/dynamic` + `ssr: false`) · ตอน unmount ต้อง `game.destroy(true)`

**3D viewer (Could)**
1. รับ `.glb` / `.gltf` ≤20 MB · ตรวจ MIME/magic bytes ที่ server · เก็บ MinIO · ไฟล์ CAD/STL/OBJ ผู้นำเสนอแปลงเอง (Blender)
2. บีบอัดด้วย `gltf-transform` (Draco/Meshopt) ตอนอัปโหลดถ้าจำเป็น
3. `<model-viewer src camera-controls>` ในแผงบูธ · โหลด lazy ตอนเปิดแผง
4. Sync: ผู้นำเสนอฟัง `camera-change` → ส่ง `getCameraOrbit()` + `getCameraTarget()` + `getFieldOfView()` ผ่าน Colyseus (throttle ~10/วินาที · เฉพาะคนในบูธ) → ผู้ชมตั้ง `cameraOrbit` / `cameraTarget` · กด "ดูเอง" เพื่อหลุด sync
5. ถ้า model-viewer ไม่พอ (scene หลายวัตถุ · ชี้ตำแหน่งละเอียด) → three.js / React Three Fiber

## Architecture

```
Browser (Next.js + Phaser 4)
 ├─ TCP 443 ──→ nginx (TLS) ──┬──→ api        (NestJS   :3000)  งาน · ผลงาน · rubric · คะแนน · feedback · analytics · AI
 │                             ├──→ realtime   (Colyseus :2567)  1 room ต่อ 1 ฮอลล์ · ตำแหน่ง · สถานะบูธ · viewer sync
 │                             └──→ livekit    (signaling :7880)
 └─ UDP 50000-60000 ─────────────→ livekit    (media ตรง ไม่ผ่าน nginx)
    (fallback: TURN over TLS 443)

api      → postgres :5432 · redis :6379 · livekit :7880 (ออก token / เปลี่ยนสิทธิ์) · minio :9000 · LLM API
realtime → postgres :5432 · redis :6379 · api (ตรวจสิทธิ์ · เขียน analytics event)
```

⭐ **media เป็น UDP ผ่าน reverse proxy ไม่ได้ → browser ต้องต่อ LiveKit ตรง** ข้อนี้กำหนดการเลือก infra ทั้งหมด

**Media ในฮอลล์ (ออกแบบ)**
- 1 ฮอลล์ = 1 LiveKit room · ทุกคน publish ไมค์ได้ (ปกติ) · **client subscribe เฉพาะคนในรัศมี** (เริ่มที่ 5 ช่อง เท่า Gather · ตัดที่ 7 ช่อง)
- จอแชร์ + กล้องผู้นำเสนอ: จอแชร์ + กล้อง publish ได้เฉพาะ PRESENTER ของบูธนั้น (ตรวจตอนออก token) · subscribe เฉพาะคนในโซนบูธ · simulcast
- **เสียงโซนบูธ**: คนในโซนบูธ subscribe กันทุกคนที่ความดังเต็ม · ไม่ subscribe คนนอกบูธ · คนนอกบูธไม่ subscribe คนในบูธ (ไม่ทะลุทั้งสองทาง) · Presenter/Admin mute คนในบูธผ่าน LiveKit server API (`mutePublishedTrack`)
- สิทธิ์ทุกอย่างเปลี่ยนที่ **server** (LiveKit server API / token) ไม่ใช่แค่ปิดไมค์ฝั่ง client
- ฮอลล์ที่ไม่มีคน = ไม่มี Colyseus room (`autoDispose` ทิ้ง room เมื่อว่าง) และ LiveKit ปิด room ว่างเอง → งานที่เปิดทิ้งไว้ (Exhibition) ไม่กิน CPU · ต้นทุนที่เหลือคือ storage

**Auth (Better Auth)**
- รันใน Next.js ที่ `/api/auth/*` · ต้องตั้ง `basePath` และ OAuth redirect URI ตาม path `/capstone26/CP26SSI3`
- session เก็บใน DB → ban แล้วตัด session ได้ทันที
- NestJS และ Colyseus (`onAuth`) ตรวจตัวตนด้วย **JWT plugin + JWKS** (`jose`) ไม่ต้องรู้ secret · JWT มีแค่ `userId` + app role · **event role เช็คจาก DB ทุกครั้ง**
- Microsoft: tenant `common` (บัญชีองค์กร + ส่วนตัว) · scope `openid profile email` · @kmutt.ac.th เป็นบัญชี Microsoft · ⚠️ ต้องลอง login ด้วยบัญชี kmutt ว่ากดยินยอมแอปภายนอกเองได้ไหม — ถ้าเจอ "Need admin approval" ต้องขอ IT ทำ admin consent · ระหว่างนั้นใช้ magic link ไปที่เมล kmutt
- API เปลี่ยนระหว่าง minor version → **pin version และอ่าน docs ตรงเวอร์ชัน**
- อีเมล (magic link · คำเชิญ · ผลคะแนนถึงผู้นำเสนอ): **Gmail ของทีมผ่าน SMTP** (nodemailer + app password) · ฟรี ส่งได้ ~500 ฉบับ/วัน · ⚠️ ส่งอัตโนมัติเยอะ Google อาจระงับชั่วคราว → magic link เป็นทางสำรอง (ปุ่ม Google/Microsoft อยู่บน) · ไม่พอค่อยเปลี่ยนเป็น Brevo (ฟรี 300/วัน) แค่แก้ค่า SMTP · Interested / survey ใช้ in-app + `Add to calendar` ไม่ส่งอีเมล

**สิ่งที่ nginx ต้องตั้งเอง**
- **cert**: certbot + ต่ออายุอัตโนมัติ
- **WebSocket**: ใส่ header `Upgrade` / `Connection` ให้ realtime (Colyseus) และ livekit signaling ไม่งั้นต่อไม่ติด
- **TURN over TLS บน 443**: ใช้ `stream` module + `ssl_preread` แยกตามชื่อโดเมน ให้ HTTPS กับ TURN ใช้พอร์ต 443 ร่วมกัน — ⚠️ ถ้าย้าย TURN ไปพอร์ตอื่น คนบนเน็ตองค์กรที่เปิดแค่ 443 จะเข้าไม่ได้

## Deployment

- **พัฒนาบน localhost ได้เลย ไม่ต้องรอ VM** — ยกเว้นเรื่อง NAT/TURN ที่ localhost ผ่านเสมอ ต้องทดสอบจากเน็ตจริง
- **Exam 3 ต้องเดโมบน server จริง** → เช็ค VM ให้เร็วที่สุด
- **VM ที่ได้ (ค่าเริ่มต้นที่อาจารย์ตั้งให้ · น่าจะขอแก้/ขอเพิ่มได้ ยังไม่ยืนยัน)**: `CP26SSI3` · 4 vCPU · 8 GB · 80 GB · Ubuntu 26.04 LTS · IP ภายใน `10.4.82.27` (SSH ต้องต่อ VPN มหาวิทยาลัย) · ผู้ใช้เข้าจากภายนอกผ่าน reverse proxy (nginx) ของคณะเท่านั้น: `https://bscit.sit.kmutt.ac.th/capstone26/CP26SSI3` · พอร์ต 80 · 443 · 5173 · 8080 · รองรับ SSE · ขอเพิ่ม spec และขอ VM อีกเครื่องได้
- ⚠️ ด้วยค่าเริ่มต้นนี้ **LiveKit บน VM ใช้จากภายนอกไม่ได้** (media ต้องต่อตรงด้วย UDP/TCP ผ่าน HTTP reverse proxy ไม่ได้) · **พัฒนาตาม architecture เดิมไปก่อน** (LiveKit self-host ใช้โค้ดเดียวกับ LiveKit Cloud) · ถ้าขอ public IP + พอร์ต media ไม่ได้ → ใช้แผนสำรอง: LiveKit Cloud หรือ VPS (เปลี่ยนแค่ URL + key)
- web อยู่ใต้ path `/capstone26/CP26SSI3` → Next.js `basePath` · cookie path · OAuth redirect URI ต้องตั้งตาม path · Colyseus ต้องผ่าน WebSocket ของ proxy (ยังไม่รู้ว่ารองรับ)
- สเปก VM · รายการที่ต้องขอจาก IT · fallback ทั้งหมด → `poc/README.md`

## Spike

แผน · สถานะ · ผลทดสอบ · capacity · สเปก VM · fallback อยู่ใน `poc/README.md`

---

## Reference

| Source | License | ใช้ยังไง |
|---|---|---|
| ⭐ **SkyOffice** `kevinshen56714/SkyOffice` | **MIT ✅** | Gather clone ด้วย Phaser 3 + Colyseus + React — **อ้างอิงหลัก** สำหรับ 2D + movement sync · ⚠️ **อย่าลอกชั้น media** (ใช้ PeerJS = mesh) · repo ปี 2021 dependency เก่า ให้ดูโครงสร้าง |
| `livekit/hq` | เช็คใน repo | virtual office ด้วย LiveKit + game server port 2567 (default ของ Colyseus) |
| `livekit-examples/spatial-audio` | เช็คใน repo | เดโม 2D + stereo audio ตามตำแหน่ง มี live demo |
| **LiveKit blog**: Using WebRTC + React + WebAudio to create spatial audio | — | ⭐ อธิบาย `PannerNode` และการ map แกน y ของ 2D ไปเป็น z — ตรงกับ proximity audio |
| **WorkAdventure** | ⚠️ **AGPL v3 + Commons Clause** | production-grade ที่ใกล้ที่สุด · **อ่านได้ ห้ามลอกโค้ด** — license ห้ามขายเป็น SaaS |
| LiveKit server | Apache 2.0 ✅ | ใช้เชิงพาณิชย์ได้ |
| [`<model-viewer>`](https://modelviewer.dev) · [releases](https://github.com/google/model-viewer/releases) (Google) | Apache 2.0 ✅ | ดูโมเดล 3D ในบูธ · event `camera-change` · `getCameraOrbit()` |
| [Colyseus 0.16 — StateView](https://colyseus.io/blog/colyseus-016-is-here/) · [Migrating to 0.17](https://docs.colyseus.io/migrating/0.17) | MIT ✅ | แยกข้อมูลที่ client เห็นตามฮอลล์/โซน |
| [Phaser 4 download](https://phaser.io/download/stable) · [Phaser 3 → 4 migration](https://phaser.io/news/2026/04/migrating-from-phaser-3-to-phaser-4-what-you-need-to-know) · [Phaser v3.90](https://phaser.io/news/2025/05/phaser-v390-released) | MIT ✅ | ⭐ ใช้ตรวจ API ของ v4 · โค้ดตัวอย่างของ v3 ต้องแปลงตาม migration guide |
| [`phaserjs/template-nextjs`](https://github.com/phaserjs/template-nextjs) | MIT ✅ | template ทางการ Phaser 4 + Next.js — จุดเริ่มของ S1 |
| `github.com/topics/virtual-office` | — | หลายตัวใช้ Phaser + Colyseus + LiveKit |

**ลำดับที่แนะนำ**: spatial-audio demo → บทความ Web Audio → livekit/hq → SkyOffice → WorkAdventure

⚠️ **ไม่มี repo ไหนทำชั้นงานนำเสนอเลย** (ผลงาน · rubric · คะแนน · feedback · analytics) — ทุกตัวหยุดที่ "โลก 2D ที่คุยกันได้" → ส่วนที่ยากลอกได้ ส่วนที่ทำให้โปรเจคมีคุณค่าต้องเขียนเอง
