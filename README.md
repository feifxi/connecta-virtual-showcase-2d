# Connecta

แพลตฟอร์มงานนำเสนอผลงานออนไลน์ ผู้ชมเดินไปตามบูธในโลก 2D แล้วคุยสดกับผู้นำเสนอ · KMUTT Capstone CP26SSI3

| โฟลเดอร์ | |
|---|---|
| `apps/web` | Next.js + Phaser 4 · Better Auth |
| `apps/api` | REST API (NestJS) |
| `apps/realtime` | ฮอลล์ realtime (Colyseus) |
| `packages/db` | Prisma schema · migration · seed |
| `packages/shared` | zod schema · ค่าคงที่ · logic ฮอลล์ที่ใช้ร่วม |
| `infra/` | docker-compose · nginx · TURN · LiveKit · deploy |
| `poc/` | ของทดลอง · `demo-app/` POC app ต่อยอดทีละ spike S1–S6 · UI mockup · แมป 2D |
| `docs/` | product · features · technical · research |

## รันบนเครื่อง

ต้องมี: Docker Desktop (เปิดไว้) · Node 24 · Google Chrome (ใช้กับ E2E)

**1. ติดตั้ง** (ครั้งแรกครั้งเดียว)
```
cp .env.example .env
npm install
npm run build:packages      # build packages/shared + packages/db
npm run db:generate         # Prisma client
```

**2. บริการพื้นหลัง** — Postgres · Redis · SeaweedFS · LiveKit · Mailpit
```
npm run infra:up
```

**3. ตารางและข้อมูลตัวอย่าง**
```
npm run db:migrate
npm run db:seed             # งาน Senior Design Showcase 2026 · Live 6 ชม. · 10 บูธ
```
งานตัวอย่างจบเองเมื่อครบเวลา (เข้า Exhibition) · รัน `npm run db:seed` อีกครั้งเพื่อให้กลับมา Live

**4. แอป** (3 terminal)
```
npm run dev:api             # :4000
npm run dev:realtime        # :2567
npm run dev:web             # :3000
```
port 3000 ไม่ว่าง → ตั้ง `APP_ORIGIN=http://localhost:3100` ใน `.env` · รัน api ใหม่ · `npm run dev -w @connecta/web -- --port 3100`

**5. Login** — http://localhost:3000/login → ใส่อีเมล → เปิดลิงก์ในอีเมลที่ Mailpit http://localhost:8025

| อีเมล | role |
|---|---|
| `admin@connecta.local` | Admin + Platform Admin |
| `mika@connecta.local` | Presenter บูธ 01 |
| `prae@connecta.local` | Presenter บูธ 07 |
| `judge@connecta.local` | Judge |
| `visitor@connecta.local` | Visitor |

**6. ลองใช้**
- ฮอลล์ 2 คน: หน้าต่างปกติ (`visitor@`) + หน้าต่าง Incognito (`mika@`) → `/e/senior-design-2026` → Join → ปุ่มรายการบูธ → "Mapping urban heat…" → เห็น `● Live` · ลองไมค์ · แชร์จอ (mika) · แชท Nearby
- Admin (`admin@`): `/manage/senior-design-2026` · สร้างงาน `/manage/new` · `/platform`
- Presenter (`mika@`): `/e/senior-design-2026/my-booth` · Judge (`judge@`): `/e/senior-design-2026/judge`

**7. ปิด** — Ctrl+C ทั้ง 3 terminal แล้ว `npm run infra:down` (ข้อมูลยังอยู่ · ลบด้วย `docker compose -f infra/docker-compose.dev.yml down -v`)

ข้อควรรู้
- ไมค์/กล้องใช้ได้เฉพาะ localhost หรือ https → เปิดจากเครื่องอื่นใน LAN ไม่ได้
- AI ต้องใส่ `LLM_API_KEY` ใน `.env` และเปิด module AI ในหน้า Settings · ไม่มี key = ตอบ 503
- วัด fps ให้ใช้ build จริง (`npm run build -w @connecta/web` → `npm run start -w @connecta/web`) · dev mode ช้ากว่า

## ทดสอบ

ต้อง `infra:up` ก่อน · E2E ต้องเปิดแอปทั้ง 3 ตัวและเพิ่ง seed
```
npm test                               # API integration + shared + web unit
npx playwright test                    # E2E · BASE=http://localhost:3100/ ถ้าใช้ port อื่น
npm run smoke -w @connecta/realtime    # ห้อง realtime 11 ข้อ
```
magic link จำกัด 5 ครั้ง/นาที → รัน E2E ติดกันเร็วเกินจะล้ม รอ 1 นาทีแล้วรันใหม่

## Deploy

```
cp infra/.env.prod.example infra/.env.prod                   # กรอก secret
cp infra/seaweedfs/s3.prod.json.example infra/seaweedfs/s3.prod.json
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod run --rm migrate npm run seed -w @connecta/db   # ถ้าต้องการข้อมูลตัวอย่าง
```

คำสั่งสำหรับ AI agent อยู่ใน `AGENTS.md`
