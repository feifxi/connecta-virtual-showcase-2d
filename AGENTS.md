# Connecta — Capstone CP26SSI3

> คำสั่งสำหรับ AI agent ทุกตัวในทีม (Claude Code อ่านผ่าน `CLAUDE.md` · Codex อ่าน `AGENTS.md` โดยตรง) · **แก้ที่ไฟล์นี้ที่เดียว**

Repo หลักของโปรเจคจบ · Connecta — แพลตฟอร์มงานนำเสนอผลงานออนไลน์ ผู้ชมเดินไปตามบูธในโลก 2D แล้วคุยสดกับผู้นำเสนอ

## เอกสาร

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `docs/connecta.md` | ⭐ Product & Business: direction · pain · solution · target · value & competition · business model · SDG · ความเสี่ยง |
| `docs/features.md` | ⭐ spec ฟีเจอร์: กฎร่วม · ลำดับ core/cut · role · spec รายฟีเจอร์ตามแม่แบบ (ทำไม · ใครทำอะไร · เปิด/ปิด · ใครเห็น · Plan · กติกา · ไม่ทำ · ข้อมูล · Test) |
| `docs/data-model.md` | ⭐ database design: ER diagram · ตาราง · constraint · index · enum · สถานะงาน · ข้อมูลที่ไม่เก็บ · state ใน memory · ไฟล์ · lifecycle/PDPA |
| `docs/api.md` | ⭐ REST API ทั้งหมด · error · status code · message ของ Colyseus · สิทธิ์ใน LiveKit |
| `docs/technical.md` | ⭐ stack · architecture · deployment · reference ด้านเทคนิค |
| `poc/README.md` | ⭐ POC ทั้งหมด: แผน spike · สถานะ · วิธีทดสอบ · ผล · capacity · สเปก VM · สิ่งที่ต้องขอจาก IT · fallback |
| `docs/consult_connecta.md` | ผลสอบกรรมการภายนอก (26 ก.ย. 2569) ของทีมเรา · ที่พลาด · สิ่งที่ควรทำต่อ |
| `docs/archive/` | ไม่ต้องอ่านเว้นแต่ถูกขอ · `connecta.md` เวอร์ชันเก่า · ผล consult ของทีมอื่น · template proposal |

## Direction

- **โฟกัสงานนำเสนอผลงานของนักศึกษา** (งานโปรเจคจบ · โปสเตอร์ในรายวิชา) — ใกล้ตัว ทดสอบได้จริง และเป็นส่วนที่ Zoom/Teams ทำได้ไม่ดี
- core โลก 2D ใช้ได้ทุก domain → ถ้าพบ insight ที่ดีกว่า (เช่น poster session งานประชุมวิชาการ) ปรับ use case ได้โดยไม่ต้องรื้อ
- รายละเอียดอยู่ใน `docs/connecta.md` · **ก่อนเขียนโค้ดให้อ่าน `docs/features.md` · `docs/data-model.md` · `docs/technical.md`**

## กติกาเอกสาร context หลัก

- กติกาเลขเวอร์ชันใช้กับ `connecta.md` (Product & Business) เท่านั้น · `features.md` · `data-model.md` · `technical.md` แก้ในไฟล์เดิมได้เลย · เพิ่มหรือแก้ฟีเจอร์ต้องตอบ checklist บนหัว `features.md` และแก้ตารางใน `data-model.md` ให้ตรงกัน
- เปลี่ยน direction ใหญ่ → ย้ายไฟล์ปัจจุบันไป `docs/archive/deprecated-connecta-vN.md` (N = เลขถัดจากไฟล์ล่าสุดใน archive) แล้วเขียน `docs/connecta.md` ใหม่
- ไฟล์ใหม่ต้อง**แทนที่ไฟล์เก่า 100%** — ข้อมูลที่ยังใช้ต้องยกมาครบ **ห้ามอ้างถึงไฟล์เก่า**
- ชื่อไฟล์ใน `archive/` ใช้รูปแบบ `deprecated-<ชื่อ>-vN.md`

## วิธีทำงาน

- ตอบและเขียนเอกสารเป็น**ภาษาไทย** · ใช้คำทับศัพท์อังกฤษ (Presenter, Booth, Judge) แทนคำแปล
- **อย่าเดา ให้ research** และบอกแหล่งที่มา · ตอบตรงๆ ไม่อวย
- เอกสาร**กระชับ** อ่านได้ทั้งคนและ agent · ไม่อธิบายเกินจำเป็น · ไม่เว้นบรรทัดเกิน
- **เขียนแค่สถานะปัจจุบัน** — ไม่บอกว่าก่อนหน้านี้เป็นอะไร เปลี่ยนจากอะไร หรืออะไรใหม่ (ไม่มี "เดิม" · "🆕" · "เปลี่ยนจาก" · วันที่ที่แก้) · ประวัติอยู่ใน git และ `archive/`
- **ตัดสินใจแล้วเขียนแค่สิ่งที่เลือก** + เหตุผลสั้นๆ · ไม่เก็บการเปรียบเทียบตัวเลือก
- **Pain → Solution ก่อน แล้วค่อยชูจุดแข็ง** · ห้ามเอาจุดแข็งไปเปลี่ยนตัวตนของ product
- **ไม่เขียนออกตัว/ลดค่าตัวเอง** (เช่น "ไม่ได้แข่งเรื่อง X เพราะเจ้าใหญ่ทำแล้ว") · ชูข้อดี แต่ไม่เคลมเกินจริง
- **ห้ามแก้นิยามหลักที่ผู้ใช้/ทีมเขียนเอง** (แนวคิด · pain point · problem statement) · แก้ใหญ่ต้องให้ดูก่อน · ย่อเอกสารห้ามตัดของผู้ใช้ทิ้งเงียบๆ ต้องบอกว่าตัดอะไร
- เนื้อหา proposal **ส่งในแชท** ไม่แก้ไฟล์ เว้นแต่สั่ง · ถ้าจะแปะลง Word: ห้าม code block · ห้าม `<br>` · ตารางไม่เกิน 4 คอลัมน์
- โปรเจคนักศึกษา **ไม่ต้องชนะคู่แข่ง** แต่ต้องบอกได้ว่าต่างยังไง · เรียนรู้ pattern จากเจ้าใหญ่ได้
- เอกสารที่ไม่ใช้แล้วลบได้ (ประวัติอยู่ใน git) · ยกเว้น `connecta.md` ที่ต้องย้ายไป `archive/` ตามกติกาเลขเวอร์ชัน
- ห้าม commit `.env`/key (ใช้ `.env.example`) · ไฟล์ใหญ่ (วิดีโอ สไลด์หนัก) เก็บ Drive แล้ววางลิงก์ หรือใช้ Git LFS · repo เป็น private

## เกณฑ์ของวิชา (INT365/371)

| Exam | กำหนด | สิ่งที่ประเมิน |
|---|---|---|
| Exam 2 Pre-Game (30) | ✅ สอบแล้ว 19–20 ต.ค. 2569 | POC · ออกแบบทางเทคนิค R1 · Revised IT Solution · Roadmap |
| Exam 3 Release 1 (35) | 30 พ.ย. 13:30–18:00 / 1 ธ.ค. 09:00–18:00 (tentative) | ความก้าวหน้า/ความยาก/ปริมาณงาน 13 · Potentially Shippable Increment 7 (test case ปกติ + exception · exception handling · ไม่มี error · **deploy บน server ไม่ใช่ localhost**) · หลักฐาน AI-assisted development 5 · ความเข้าใจระบบ 10 · ส่ง Retrospective Report รายคน |

- **Release 1 = core feature อย่างน้อย 1 ตัว ครบ Frontend → Backend → DB** · login ไม่นับเป็น core feature
- ข้อมูลความต้องการต้องมาจากผู้ใช้เป้าหมาย **ที่ไม่ใช่ทีมพัฒนา** · คาดหวังระบบใหญ่ขึ้น (ผู้ใช้จำนวนมาก · platform · ข้อมูลส่วนบุคคล) · AI feature แบ่งระดับ Low / Intermediate / Advance
- คะแนนนำเสนอ + ถาม-ตอบรวม 3 รอบ · แต่งกายผิดระเบียบหักคะแนนทีม 2 · พบอาจารย์ที่ปรึกษา ≥ 7 ครั้ง (คะแนน Project Management)
- งบวิชา ≤ 3,000 บาท/ทีม **เบิกค่าโครงสร้างพื้นฐาน (server/cloud) ไม่ได้** · ผลงานเป็นลิขสิทธิ์ของมหาวิทยาลัย · D-Day ปลาย เม.ย.

**แนวที่อาจารย์เน้น**: Pain → Challenge → Solution → Outcome · วัดผลที่ **Outcome** (ผู้ใช้ได้ผลจริง) ไม่ใช่ Output (มีระบบ) · Challenge ต้องเป็นพฤติกรรม/ข้อจำกัดของผู้ใช้ ไม่ใช่ "ยังไม่มีระบบ" (ตัวอย่างอาจารย์: ทำระบบรีวิวไม่ยาก แต่ทำให้คนเขียนรีวิวยาก)

**กรรมการภายนอกไม่ถามเทคนิค** ถามแต่ value · ใครใช้/ใครจ่าย · ทำไมไม่ใช้ Zoom / MS365 / Google Workspace / Gather → รายละเอียดใน `docs/consult_connecta.md`

## ทีม

- CP26SSI3 · อาจารย์ที่ปรึกษา: อ.สนิท ศิริสวัสดิ์วัฒนา
- สมาชิก: กิตติกัญ วิวเมฆ · ณัฐชนน เจริญเสริมสิริ · สุชัย ชลชัยไพศาล · ตอนสอบแบ่งบทบาท UX/UI · front end · back end
- **หัวข้อในรุ่นที่ทับกับเรา**: KMUTT Event Discovery and Management System · ระบบจัดการเข้าชมและประเมินโครงงานปี 4 · แพลตฟอร์มนำเสนอแบบมีปฏิสัมพันธ์สำหรับห้องเรียน มจธ. → จุดต่างของเราคือ งานออนไลน์ที่เดินชมและคุยสดได้

## เทคนิค

- stack · architecture อยู่ใน `docs/technical.md` · spike และผลทดสอบอยู่ใน `poc/README.md`
- ใช้ **nginx** (ทีมมีประสบการณ์) · ต้องตั้งเอง: certbot · header WebSocket (`Upgrade`/`Connection`) · TURN over TLS บน 443 ด้วย `stream` + `ssl_preread`
- spike **S1–S7** (S1 Phaser 4+Tiled · S2 LiveKit hello · S3 Movement sync · S4 Proximity media · S5 เสียงโซนบูธ · S6 Poster/3D viewer sync · S7 NAT+TURN) · S1–S6 = POC app เดียว · S7 ทดสอบบน VM แยก · S1–S4 เสร็จแล้ว · เหลือ S5–S7 · สถานะอยู่ใน `poc/README.md`
- ไม่ต้องเข้าไปดู repo `poc-connecta`

## กติกาเขียนโค้ด

- **POC: ทำทีละ spike · จบ spike ต้องหยุด รายงานผล และรอเจ้าของ POC อนุมัติก่อนเริ่ม spike ถัดไป** · ห้ามทำข้าม spike · อนุมัติแล้วค่อย tag `s<N>-done` (กติกาเต็มใน `poc/README.md`)

- **Phaser 4 ไม่ใช่ Phaser 3** — AI มักเขียน API ของ v3 ปนมา (เช่น `setTintFill()`, `Geom.Point`, custom pipeline, Mesh) · ก่อนใช้ API ที่ไม่แน่ใจ ตรวจกับ docs ของ v4 และ [migration guide](https://phaser.io/news/2026/04/migrating-from-phaser-3-to-phaser-4-what-you-need-to-know) · ตัวอย่างโค้ด v3 (เช่น SkyOffice) ใช้เป็นแนวทางได้แต่ต้องแปลง
- **ห้ามปล่อย server/process รันค้าง** — ทดสอบเสร็จต้องหยุดทุก process ที่เปิดเอง แล้วบอกคำสั่งให้ผู้ใช้รันทดสอบเอง
- library ที่ API เปลี่ยนบ่อย (Colyseus · LiveKit · Next.js) ให้เช็คเวอร์ชันใน `package.json` แล้วอ่าน docs ของเวอร์ชันนั้น ไม่เดาจากความจำ · Next.js มี docs ตรงเวอร์ชันใน `node_modules/next/dist/docs/` · Phaser มีใน `node_modules/phaser/skills/`
- **ห้ามเชื่อ client** — role check ครบ 3 ทาง: REST · WebSocket message · ตอนออก token / เปลี่ยนสิทธิ์ใน LiveKit (กฎร่วมทั้งหมดอยู่ใน `docs/features.md`)

## โครง repo

- `apps/web` (Next.js + Phaser 4) · `apps/server` (game server + API) · `packages/` (type ที่ใช้ร่วม เมื่อจำเป็น) · `infra/` (docker-compose, nginx, TURN, LiveKit, deploy)
- `poc/` ของทดลองก่อน implement · `poc/demo-app/` POC app เดียว (`web/` + `realtime/`) ต่อยอดทีละ spike S1–S6 · โฟลเดอร์อื่นใน `poc/` เช่น UI mockup · แมป 2D · ทุกอย่างของ POC อยู่ใน `poc/README.md` ไฟล์เดียว

## งานถัดไป

1. Exam 3 Release 1 (30 พ.ย.): implement ใน `apps/` + deploy บน server · ขอบเขตอยู่ใน `docs/features.md` → Release plan · UI ใช้ `poc/ui-mockup-v2/` เป็น theme หลัก
2. ทีมเขียน one-liner · pain · problem statement เอง แทนร่างใน `docs/connecta.md`
3. ทำ survey + นัดคุยผู้จัด D-Day / อาจารย์ · ความเป็นไปได้ทางธุรกิจต้องใช้ข้อมูลจากผู้ใช้เป้าหมายจริง (ไม่ใช่ทีม)
4. UI mockup v1 + v2 ตรงกับ `docs/features.md` แล้ว (รายการหน้าอยู่ใน `poc/README.md`) · หน้าที่ยังไม่ทำ: Profile · Billing · Platform Console · สรุปของผู้นำเสนอ · ฟอร์มส่งผลงาน
5. เช็ค SpatialChat ว่ามี judging หรือไม่
