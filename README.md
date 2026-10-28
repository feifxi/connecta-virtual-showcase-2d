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

```
cp .env.example .env
npm install
npm run infra:up            # Postgres · Redis · SeaweedFS · LiveKit · Mailpit
npm run db:migrate && npm run db:seed
npm run dev:api             # :4000
npm run dev:realtime        # :2567
npm run dev:web             # :3000
```

login ด้วยอีเมลที่ seed ไว้ (`admin@` · `mika@` · `judge@` · `visitor@connecta.local`) แล้วเปิดลิงก์จาก Mailpit http://localhost:8025

## ทดสอบ

```
npm test                    # unit + API integration (ต้อง infra:up)
npm run e2e                 # Playwright บน stack ที่รันอยู่ · BASE=<url> ได้
npm run smoke -w @connecta/realtime
```

## Deploy

```
cp infra/.env.prod.example infra/.env.prod                   # กรอก secret
cp infra/seaweedfs/s3.prod.json.example infra/seaweedfs/s3.prod.json
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod up -d --build
docker compose -f infra/docker-compose.yml --env-file infra/.env.prod run --rm migrate npm run seed -w @connecta/db   # ถ้าต้องการข้อมูลตัวอย่าง
```

คำสั่งสำหรับ AI agent อยู่ใน `AGENTS.md`
