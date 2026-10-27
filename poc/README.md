# POC

ทุกอย่างของ POC อยู่ไฟล์นี้: แผน spike · สถานะ · วิธีรัน · วิธีทดสอบ · ผลทุกตัวเลข · capacity · สเปก VM · fallback

## สถานะ

| Spike | สถานะ | Tag | ผล / ตัวเลข |
|---|---|---|---|
| S1 Phaser 4 + Tiled + Next.js | ✅ ผ่าน | `s1-done` | Phaser 4.2.1 · Next 16.4 · WebGL 58 fps · เดิน 197 px/s (ทแยง 199 = normalize ถูก) · ชนกำแพง/โต๊ะบูธ · คลิกเพื่อเดิน · เข้า/ออกบูธส่ง event ถึง React · mount/unmount 100 รอบ heap คงที่ ~18 MB · ⚠️ ห้ามใช้ `Graphics.generateTexture()` (Phaser 4 ถือ scene + WebGL context ไว้ตลอดผ่าน `Graphics.TargetCamera`) ใช้ไฟล์รูปแทน |
| S2 LiveKit: เสียง · กล้อง · แชร์จอ | ✅ ผ่าน | `s2-done` | LiveKit server 1.13.9 (Docker) · livekit-client 2.22.4 · ทดสอบ 2 client บนเครื่องเดียว (กล้อง/ไมค์ปลอมของ Chrome): เสียงไป-กลับ ~76 kbps · กล้อง 640×360 · จอ 960×540 · join 0.2–1.6 วิ (เจอ 10.7 วิ 1 ครั้ง ทำซ้ำไม่ได้) · ภาพแรกของกล้อง 0.26–0.41 วิ · จอ 0.48–0.55 วิ · simulcast 3 layer · หยุดแชร์/ออก ฝั่งอื่นเห็นใน 28 ms · ออกห้องหรือเปลี่ยนหน้าแล้วไมค์หยุดและหลุดจาก server · ยังไม่ได้ทดสอบข้ามเครื่อง/ข้ามเน็ต (S7) |
| S3 Movement sync + loadtest | ✅ ผ่าน | `s3-done` | Colyseus 0.18 · tick 15 Hz · client prediction + server ตรวจโควตาระยะทาง/กำแพง/รูปแบบ · ตำแหน่งตรงกัน 0 px · กด → อีกแท็บเห็น 122–189 ms (รวม interpolation 120 ms) · **150 คน**: 11.6 KB/s ต่อคน · CPU server ≤ 7% · RTT p99 ≤ 7 ms · แท็บจริง 60 fps · ฮอลล์เดียวถึง 1,000 คน server ไม่ตัน (CPU 23%) แต่ bandwidth 0.7 Mbps/คน → เพดาน 300 · 1 process รับ 8 งาน × 150 สบาย · ทดสอบบนเครื่องเดียว |
| S4 Proximity media | ✅ ผ่าน | `s4-done` | subscribe ตามระยะ (5 ช่อง ตามแบบ Gather · hysteresis 5/7) + จอ/กล้องผู้นำเสนอเฉพาะในโซนบูธ · test อัตโนมัติ 12/12 ผ่าน 3 รอบติด · สลับจอ: ตัดสิน → ภาพแรก 100–141 ms · เสียงเข้า ~50 ms · ถอด track ~250 ms · ไม่กะพริบที่ขอบรัศมี · browser รับเสียง 40 track ได้ (CPU +15%) · ภาระหลักคือวิดีโอ · **ยังไม่ได้ทดสอบกับคนจริง 8–10 คน** |
| S5 เสียงโซนบูธ + mute | ยังไม่เริ่ม | — | |
| S6 Poster / 3D viewer sync | ยังไม่เริ่ม | — | |
| S7 NAT + TURN (แยก) | ยังไม่เริ่ม | — | |


## แผน spike

ลำดับ (ง่าย → ยาก ตาม dependency): S1 → S2 → S3 → S4 → S5 → S6 · S7 ทำได้ทันทีที่มี VM (ต้องเสร็จก่อน Exam 3)
- S1 · S2 ไม่พึ่ง spike อื่น · S3 ต้องใช้แมปของ S1 + Colyseus server · S4 รวม S2 + S3

| ด้าน | Spike | ใช้อะไร | คำถาม | ความสำคัญ |
|---|---|---|---|---|
| **2D** | **S1** Phaser 4 + Tiled | Phaser 4 + Tiled + Next.js (ไม่มี server) | โหลดแมป · เดินชนกำแพง · Phaser 4 ทำงานร่วมกับ Next ได้โดยไม่ leak | Exam 2 |
| **Media** | **S2** LiveKit hello | LiveKit + token API route (หน้าแยก `/s2`) | 2 client ได้ยินเสียง · เห็นกล้อง · เห็นจอแชร์ของกัน | Exam 2 |
| **2D** | **S3** Movement sync | S1 + Colyseus | 150 client ต่อฮอลล์ลื่นไหม (loadtest) · tick rate เท่าไร | Exam 2 |
| **Media** | **S4** Proximity media 🔴 | S2 + S3 · ตำแหน่งจาก Colyseus ตัดสินว่าจะ subscribe ใคร | เข้าใกล้ได้ยินเสียง · เข้าโซนบูธเห็นจอ/กล้องผู้นำเสนอ · ออกแล้วหาย · ทดสอบกับ**คนจริง 8–10 คน** · เปลี่ยนเร็วแค่ไหน · browser รับได้กี่ track | Exam 2 |
| **Media** | **S5** เสียงโซนบูธ 🔴 | S4 + LiveKit server API (mute) | คนในบูธได้ยินกันเท่ากัน · เสียงไม่ทะลุเข้า/ออกโซนบูธ · Presenter mute คนในบูธจาก server เร็วแค่ไหน · ขอบโซนไม่กะพริบ · บูธ 50 คนยังไหว | core |
| **Viewer** | **S6** Poster / 3D viewer sync | S3 + PDF→รูป + `<model-viewer>` | sync ซูม/มุมกล้องผ่าน Colyseus ลื่นไหม · ไฟล์ใหญ่แค่ไหนยังโหลดทัน | ความเสี่ยงต่ำ |
| **Network** | **S7** Deploy + NAT/TURN (แยกจาก POC app) | VM คณะผ่าน reverse proxy (web · Colyseus) + LiveKit นอก VM (Cloud หรือ VM ที่มี public IP) | WebSocket ผ่าน proxy ได้ไหม · `basePath` ใช้ได้ · เสียง/ภาพเข้าได้จากบ้าน · wifi มหาลัย · 4G · เน็ตบริษัท · VPN | core (ก่อน Exam 3) |

ค่าตั้งต้น (ยืนยันจาก spike):
- tick rate **15 Hz** (S3)
- proximity **ระยะเท่า Gather** (เริ่มได้ยิน 5 ช่อง · เต็มภายใน 2 ช่อง) · **hysteresis**: subscribe < 5 ช่อง · unsubscribe > 7 ช่อง — ⚠️ ห้ามใช้ค่าเดียวกัน (S4 ยืนยันว่าไม่กะพริบ) · ตัดสินทุก 200 ms
- ความดังตามระยะ: 100% ที่ ≤ 2 ช่อง → ลดเป็นเส้นตรงถึง 15% ที่ 5 ช่อง (คงที่ 15% จนถูกตัดที่ 7) · ผู้นำเสนอของบูธที่ยืนอยู่ = 100% เสมอ
- bitrate เสียง ~40 kbps/คน · วิดีโอ/จอ ~1.5 Mbps

## โครงสร้าง

| โฟลเดอร์ | |
|---|---|
| `demo-app/` | POC app เดียว ต่อยอดทีละ spike S1–S6 |
| `demo-app/web/` | Next.js + Phaser 4 · LiveKit client · token API route |
| `demo-app/realtime/` | Colyseus game server (S3+) · `loadtest/run.sh` (ฮอลล์ × คน) |
| `demo-app/loadtest-media/` | load test LiveKit ด้วย `lk perf load-test` |
| `demo-app/tests/` | script ทดสอบอัตโนมัติ (Playwright + Chrome) ของแต่ละ spike |
| `demo-app/web` หน้า `/hall` | Hall art (ไม่ใช่ spike): ตัวละคร chibi + แมปจำลองงาน · offline ไม่ต้องรัน server · รายละเอียดในหัวข้อ Hall art |
| `demo-app/web` หน้า `/presets` | Hall presets (ไม่ใช่ spike): Room / Hall · บูธวางตามจำนวนผลงาน มี/ไม่มีหมวด · offline · รายละเอียดในหัวข้อ Hall presets |
| `ui-mockup-v1/` | UI mockup หน้าเว็บ (Next.js + Tailwind + shadcn/ui) · เก็บไว้เทียบ · ตรงกับ `docs/features.md` · ตัวละคร 2D จาก design ของ v2 (avatar ทุกที่ · คนเดินในแผนที่ Landing/หน้างาน · เลือกตัวละครใน Onboarding/Profile) · 15 หน้า: Landing `/` · Login `/login` · Onboarding `/onboarding` · Home `/home` · Profile `/profile` · รับคำเชิญ `/invite/demo` · หน้างาน `/e/[slug]` (`?state=published|live|exhibition`) · ฟอร์มเข้างาน `/e/[slug]/join` (`?full=1` = ฮอลล์เต็ม) · ฮอลล์ `/e/[slug]/hall` = Phaser 4 แบบเดียวกับ `ui-mockup-v2` (แมป Hall preset + วางบูธ 28 บูธตามหมวด + ตัวละคร TestUI) · Preview as: Visitor / Presenter / Judge / Admin (`?as=`) · แก้บูธ `/e/[slug]/my-booth` · รายการให้คะแนน `/e/[slug]/judge` · สร้างงาน `/manage/new` · Admin dashboard `/manage/[slug]` (`?tab=people|judging|moderation|settings`) · ผลงานและฮอลล์ `/manage/[slug]/projects` · Analytics `/manage/[slug]/analytics` · slug ตัวอย่าง `sit-capstone-2027` · ข้อมูลตัวอย่าง ไม่มี backend · `npm install && npm run dev` แล้วเปิด http://localhost:3000 |
| `ui-mockup-v2/` | ⭐ **theme หลักที่ทีมเลือก** · UI mockup ที่ใช้ **design จาก [Claude Design](https://claude.ai/design/p/526ec3a8-d5f8-4aaa-b753-d57037f31ff8)** (CSS tokens · component · ตัวละคร 14 แบบ · ฟอนต์) ปรับหน้าให้ตรง `docs/features.md` · Next.js ไม่ใช้ Tailwind · 16 หน้า: Landing · Explore · Login · Onboarding (เลือกตัวละคร) · My events · คำเชิญ · หน้างาน (`?state=`) · ฟอร์มเข้างาน (`?full=1`) · **ฮอลล์ Phaser** · My booth · Judging list · สร้างงาน · Admin overview (`?tab=`) · Projects & hall · Event report · Profile · ปุ่ม **Demo** มุมล่างซ้ายรวมทุกอย่างที่เป็นของ mockup (All screens · สถานะของแต่ละหน้า · Preview as · Network · วงระยะเสียงที่แอปจริงไม่แสดง) · **ฮอลล์** = Phaser 4 ใช้แมป Hall preset + วางบูธตอนรันแบบ `/presets` ของ `demo-app` (1 block = 1 หมวด) + ตัวละครจาก TestUI + ปุ่ม/แผงแบบ TestUI · Preview as: Visitor / Presenter / Judge / Admin (`?as=`) · offline ไม่มีเสียงจริง · `npm install && npm run dev` |

โฟลเดอร์อื่นใน `poc/` ใช้เก็บของทดลองที่ไม่ใช่ spike เช่น UI mockup · แมป 2D · S7 (NAT + TURN) ทดสอบบน VM แยก

## กติกา (`demo-app/`)

- ทำทีละ spike ตามลำดับ · **จบแต่ละ spike ต้องหยุด รายงานผล แล้วรอเจ้าของ POC อนุมัติก่อนไปต่อ**
- อนุมัติแล้ว → git tag `s<N>-done` (ใช้ย้อนกลับไปเดโมได้ถ้า spike ถัดไปพัง)
- S2 ทำในหน้าแยก (route `/s2`) แล้วรวมกับ S3 ใน S4
- loadtest ของ S3 วัดตอนยังไม่มี media
- POC ไม่ต้องมี auth / NestJS / DB · ส่วนที่ใช้ได้ค่อยย้ายเข้า `apps/` ตอน implement

## รัน

```
cd poc/demo-app
docker compose up -d          # LiveKit (S2 ขึ้นไป) · ต้องเปิด Docker Desktop ก่อน

cd poc/demo-app/realtime      # terminal 1 · Colyseus :2567 (S3 ขึ้นไป)
npm install
npm start

cd poc/demo-app/web           # terminal 2
npm install
cp .env.example .env.local    # ครั้งแรกครั้งเดียว
npm run gen:map               # สร้างแมป + tileset + sprite (เปิดแก้ hall.json ใน Tiled ได้)
npm run gen:hall              # art + แมปของหน้า /hall (สร้างไว้แล้วใน public/assets/hall · รันใหม่เมื่อแก้ script)
npm run gen:presets           # แมป preset ของหน้า /presets (สร้างไว้แล้วใน public/assets/presets)
npm run dev                   # http://localhost:3000
```

เลิกใช้: Ctrl+C ทั้ง 2 terminal แล้ว `docker compose down` ใน `poc/demo-app`

เครื่องอื่นในวง LAN: เปิด `http://<IP เครื่องที่รัน>:3000` (ดู IP ได้จากบรรทัด `Network:` ตอน `npm run dev`) · Colyseus ใช้ IP เดียวกัน port 2567

### รันชุดทดสอบ

```
cd poc/demo-app && docker compose up -d                 # LiveKit (S2)
cd realtime && npm install && npm start                 # Colyseus :2567 (S3) · STATS=1 พิมพ์ CPU/RAM ทุก 5 วิ
cd ../web && npm install && npm run dev                  # :3000
cd ../tests && npm install && npm run s1 | s3 | s2 | hall | presets   # BASE=http://localhost:3000 (default)
cd ../realtime && loadtest/run.sh 150 4 40               # capacity: 4 งาน × 150 คน 40 วิ (เปิด/ปิด server เอง · พิมพ์สรุป)
cd ../loadtest-media && LAYOUT=speaker ./run.sh 15 1 3 10 40   # media: ต้องมี LiveKit + CLI `lk`
```

## สภาพแวดล้อม

| | |
|---|---|
| เครื่อง | Apple M4 · 10 core · RAM 16 GB · macOS 26.6 |
| Browser | Chrome 155 แบบ headless (คุมด้วย `playwright-core`) · WebGL ผ่าน SwiftShader (render ด้วย CPU ไม่ใช่ GPU จริง) |
| Version | Next 16.4.0 · Phaser 4.2.1 · livekit-client 2.22.4 · livekit-server-sdk 2.19.1 · LiveKit server 1.13.9 (Docker 28.2) · colyseus 0.18.9 (@colyseus/core 0.18.18) · @colyseus/schema 5.0.39 · @colyseus/sdk 0.18.5 · Node 24.21 |
| เครือข่าย | ทุกอย่างอยู่บนเครื่องเดียว (localhost) · **ยังไม่มีผลข้ามเครื่อง/ข้ามเน็ต** → S7 |

⚠️ ข้อจำกัดที่ใช้ตีความทุกตัวเลข: latency/RTT ในไฟล์นี้ไม่มี delay ของเครือข่ายจริง · fps วัดบน SwiftShader ซึ่งช้ากว่า GPU จริง · bot และ server รันบนเครื่องเดียวกันจึงแย่ง CPU กัน

---

## S1 Phaser 4 + Tiled + Next.js ✅ (`s1-done`)

**คำถาม**: โหลดแมป Tiled · เดินชนกำแพง · ใช้กับ Next.js ได้โดยไม่ leak

**วิธีทดสอบ** (`demo-app/tests/s1-check.mjs` · `demo-app/tests/s1-heap.mjs`)
1. เปิด `/s1` → อ่าน renderer และตำแหน่งเกิด
2. กด W ค้าง 4 วิ → ต้องหยุดที่กำแพงบน
3. กด D+S ค้าง 1 วิ → วัดระยะ (ต้อง ~200 px ถ้า normalize ถูก)
4. คลิกกลางบูธ 2 → ต้องเดินไปถึง และ header แสดง "Project 2"
5. กด W ในบูธ 1.5 วิ → ต้องติดโต๊ะ (y ≥ 160)
6. leak: unmount/mount 20 รอบผ่านปุ่มในหน้า · และ 100 รอบ วัด heap หลังสั่ง GC (CDP `HeapProfiler.collectGarbage`) ทุก 20 รอบ

**ผล**

| เรื่อง | ผล |
|---|---|
| Renderer | WebGL · 56–60 fps |
| เดินตรง / ทแยง | 197 / 199 px/s (velocity = 200 ทั้งคู่ → normalize ถูก) |
| ชนกำแพงและโต๊ะ | ✅ หยุดที่ขอบ (เช่น y = 170 ที่โต๊ะบูธ 2 · y = 426 ที่บูธ 7) |
| คลิกเพื่อเดิน | ✅ ถึงเป้า ±2 px |
| event เข้า/ออกบูธ → React | ✅ |
| mount/unmount 20 รอบ | games 1→1 · canvas 1→1 |
| heap 100 รอบ (MB หลัง GC ทุก 20 รอบ) | 15.4 → 17.5 → 17.9 → 17.9 → 18.1 → 18.2 · WebGL context เหลือ 2 (1 ใช้งาน + 1 รอ GC) |
| รันซ้ำหลังเพิ่ม S3 (14 ต.ค.) | 31.1 → 34.1 → 34.6 → 34.7 → 34.8 → 35.1 · ฐานสูงขึ้นเพราะ HallScene import Colyseus SDK · หลังรอบแรกโต ~0.25 MB ต่อ 20 รอบ เท่ากับตอน `s1-done` |

**ปัญหาที่เจอ**
- 🔴 **leak จาก Phaser 4**: ก่อนแก้ heap โต ~1 MB ต่อ 20 รอบ และค้าง WebGLRenderingContext 1 ตัวต่อการ mount · heap snapshot ชี้ว่า `Graphics.generateTexture()` ใส่ object ลง `renderList` ของ `Graphics.TargetCamera` (static ตัวเดียวทั้ง library · `Graphics.js` บรรทัด ~1615) ซึ่งไม่มีใครล้าง → ถือ scene → game → renderer → GL context ไว้ · **แก้**: ใช้ไฟล์ PNG แทน `generateTexture()` · ยังไม่ได้เช็คว่ามีคนรายงาน upstream แล้วหรือยัง
- ความเร็วต่อวินาทีจริงตกเหลือ 148–175 px/s เมื่อเครื่องมี load สูง (load avg 6.8) ทั้งที่ velocity = 200 · สาเหตุ: Phaser ชะลอเวลาในเกมเมื่อเฟรมมาช้า (delta smoothing) ไม่ใช่บั๊กของโค้ด · server ของ S3 ยอมรับความเร็วต่ำกว่าได้อยู่แล้ว
- เครื่องมือวัดของเราเอง: `Runtime.queryObjects` ถือ object ไว้จนตัวเลขฟ้อง leak ผิด → ต้อง `releaseObjectGroup` · การเรียก `WEBGL_lose_context.loseContext()` ไม่ช่วยอะไร (ลบออกแล้ว)

---

## S2 LiveKit: เสียง · กล้อง · แชร์จอ ✅ (`s2-done`)

**คำถาม**: 2 client ได้ยินเสียง · เห็นกล้อง · เห็นจอแชร์ของกัน

**วิธีทดสอบ** (`demo-app/tests/s2-check.mjs` · `s2-join.mjs` · `s2-nav.mjs`) · Chrome ใช้กล้อง/ไมค์ปลอม (`--use-fake-device-for-media-stream`) และเลือกจอให้อัตโนมัติ
1. Alice และ Bob join ห้อง `s2` (คนละ browser context)
2. Alice เปิดกล้อง → วัดเวลาจนวิดีโอของ Bob มีภาพ (`videoWidth > 0`)
3. Alice แชร์จอ → วัดแบบเดียวกัน
4. อ่าน `getReceiverStats()` ของ Bob 2 ครั้งห่าง 2 วิ → bytes ต่อ track · ขนาดภาพ · energy เสียง
5. อ่าน encodings ของ sender กล้อง Alice → จำนวน layer simulcast
6. หยุดแชร์ → จอต้องหายจากหน้า Bob · Alice ออก → Bob ต้องเห็นเหลือ 0 คน
7. join 4 คนติดกัน วัดเวลา + ชนิด ICE candidate · ออกแล้วเช็ค track ไมค์ `readyState`
8. join แล้วเปลี่ยนหน้า (client-side navigation) → ถาม LiveKit server API ว่าคนลดลง 1

**ผล**

| เรื่อง | ผล |
|---|---|
| เสียงไป-กลับ | ✅ ~19 KB ต่อ 2 วิต่อทาง (~76 kbps) · `<audio>` เล่นอยู่ |
| กล้อง | ✅ 640×360 · ~80 KB/2 วิ · ภาพแรก 0.26–0.41 วิ |
| แชร์จอ | ✅ 960×540 · ~73 KB/2 วิ · ภาพแรก 0.48–0.55 วิ |
| simulcast | ✅ 3 layer (q / h / f) |
| join | 0.18–1.6 วิ (คนแรกช้ากว่าเพราะ compile route ครั้งแรก) · ⚠️ เจอ 10.7 วิ 1 ครั้งในรอบแรกสุด รันซ้ำ 5 รอบไม่เจอ ยังไม่รู้สาเหตุ |
| ICE | UDP `prflx` (ผ่าน Docker port 7882/udp) |
| หยุดแชร์ / ออก | อีกฝั่งเห็นใน 17–28 ms |
| ออกแล้ว | ไมค์ `ended` · หน้ากลับเป็นฟอร์ม join · เปลี่ยนหน้าแล้ว server นับคนลด 1 ✅ |

**ปัญหาที่เจอ**
- `next dev` 16.4 สร้าง `AGENTS.md` เองในโฟลเดอร์ `web/` เมื่อตรวจพบ AI agent และหน้าเว็บ reload วนไม่หยุดในช่วงนั้น · ปิดด้วย `agentRules: false` ใน `next.config.ts` แล้ว loop หาย (ยังไม่ได้พิสูจน์ว่าเป็นสาเหตุเดียว)
- ปิด browser แบบกระชาก (ไม่กดออก) → LiveKit ยังนับคนนั้นอยู่จนหมดเวลา timeout · ใน browser จริง livekit-client ส่ง disconnect ตอนปิดแท็บให้เอง
- favicon 404 → เพิ่ม `app/icon.svg`

---

## S3 Movement sync (Colyseus) + loadtest ✅ (`s3-done`)

**คำถาม**: 150 client ต่อฮอลล์ลื่นไหม · tick rate เท่าไร

**การออกแบบที่ทดสอบ**
- Client เดินเองทันที (client prediction) แล้วส่งตำแหน่ง `move {x, y}` สูงสุด 15 ครั้ง/วิ เฉพาะตอนขยับ
- Server **ไม่เชื่อ client**: ตรวจรูปแบบด้วย zod (ผิด = ตัดการเชื่อมต่อ) · **โควตาระยะทาง**: เติม 240 px/วิ (200 × 1.2) สะสมได้สูงสุด 100 px · แต่ละก้าวหักตามระยะ เกินโควตา = ปฏิเสธ (รับ message ที่มากระจุกกันได้ แต่ teleport ไม่ได้) · จุดกลางตัวต้องไม่อยู่ใน tile ที่ชนได้ (อ่านจาก `hall.json` ชุดเดียวกับ client) · ไม่ผ่าน → ส่ง `correct` ให้ client กลับไปตำแหน่งเดิม · จำกัด 60 message/วิ
- State: `players` map ของ `{name, x: uint16, y: uint16}` · server ส่ง patch ตาม `TICK_HZ` (default 15 = ทุก 67 ms)
- ผู้เล่นคนอื่นถูกวาดย้อนหลัง 120 ms แล้ว interpolate ระหว่าง 2 snapshot (เลยไม่กระตุกแม้ patch มา 15 ครั้ง/วิ)

**วิธีทดสอบ 2 แท็บ** (`demo-app/tests/s3-check.mjs`)
1. Alice และ Bob เปิด `/s3` → ต่างคนต่างเห็นกัน
2. Alice กด D 1 วิ → เทียบตำแหน่งจริงกับที่ Bob เห็น
3. Alice กด A → จับเวลาจนตัว Alice บนจอ Bob เริ่มขยับ (poll ทุก 5 ms)
4. โกง: ส่ง `move` ไปอีกฝั่งแมป (เกินโควตา) · เดินไปจนติดโต๊ะแล้วส่งตำแหน่งเข้าไปในโต๊ะ 16 px (อยู่ในโควตา จึงต้องโดนจับด้วยการเช็คกำแพง) · ส่ง payload ผิดรูปแบบ
5. Bob เปลี่ยนหน้า → Alice ต้องไม่เห็น Bob

| เรื่อง | ผล |
|---|---|
| เห็นกันทั้ง 2 ฝั่ง | ✅ |
| ตำแหน่งหลังหยุดเดิน | ตรงกัน 0 px |
| กดปุ่ม → อีกแท็บเห็นขยับ | 122–189 ms (รวม interpolation delay 120 ms · รอส่ง ≤ 67 ms · รอ patch ≤ 67 ms) |
| teleport | ✅ ปฏิเสธ (เกินโควตา) · คนอื่นยังเห็นที่ตำแหน่งเดิม |
| เข้าไปในโต๊ะ 16 px | ✅ ปฏิเสธ (เช็คกำแพง) · client ได้ `correct` 1 ครั้ง |
| payload ผิดรูปแบบ | ✅ ถูกตัดออกจากห้อง |
| ออก / เปลี่ยนหน้า | ✅ หายจากจอคนอื่น |
| เดินปกติ | correction 0 ครั้ง |

**วิธี loadtest** (`demo-app/realtime/loadtest/bots.ts` · `demo-app/tests/s3-observe.mjs`)
- bot แต่ละตัว join (เว้น 20 ms ต่อคน) แล้วเดินสุ่มไปเป้าหมายที่เดินได้ด้วย 200 px/s · ส่ง `move` 15 ครั้ง/วิ · ถึงเป้าแล้วหยุด 0–3 วิ (เลียนแบบคนแวะบูธ)
- รัน bot 3 process × 50 (150 ตัว) หรือ 6 × 50 (300 ตัว) · ใช้ script เอง ไม่ใช้ `@colyseus/loadtest` เพราะตัวนั้นเป็นหน้าจอ TUI อ่านผลอัตโนมัติไม่ได้
- วัด: KB/s ที่ bot ได้รับ (นับ byte จาก WebSocket) · RTT ของ `request('ping')` จาก 10 bot ทุกวินาที · CPU / RSS / event-loop p99 ของ server ทุก 5 วิ · Chrome จริง 1 แท็บเข้าไปเดินในฝูง วัด fps
- รอบละ 30–50 วิ

| tick | ผู้เล่น | รับต่อ client | CPU server | RAM (RSS) | RTT p99 | fps ของแท็บจริง |
|---|---|---|---|---|---|---|
| 10 Hz | 150 | 8.1 KB/s | 3.6–7.1% | 103–144 MB | ≤ 3 ms | 60 (เห็น 150 ตัว) |
| **15 Hz** | **150** | **11.1–13.1 KB/s** (เฉลี่ย 11.6) | **3.2–7.1%** | **75–91 MB** | **≤ 7 ms** | **60 (เห็น 150 ตัว)** |
| 20 Hz | 150 | 11.9 KB/s | 3.9–7.1% | 110–142 MB | ≤ 20 ms | 60 |
| 15 Hz | 300 | 23.4–28.0 KB/s | 6.7–14.0% | 117–188 MB | ≤ 12 ms | 60 (เห็น 300 ตัว) |

- event-loop p99 อยู่ที่ 11.5–17.9 ms ตลอด (ตอนว่างก็ ~11.5 ms เพราะตัววัดมีความละเอียด 10 ms) → server ไม่ติดขัด
- 50 bot ต่อ process join ครบใน ~1.2 วิ ทุกรอบ
- **ข้อสังเกต**
  - 20 Hz ใช้ bandwidth เท่า 15 Hz เพราะ client ส่งแค่ 15 ครั้ง/วิ · patch ที่ถี่กว่าแค่แบ่งข้อมูลเดิมเป็นชิ้นเล็กลง
  - bandwidth ต่อคนโตตามจำนวนคนในฮอลล์ (150 → 300 คน = ×2) → **รวมทั้ง server โตแบบกำลังสอง**: 150 คน ≈ 1.7 MB/s (~14 Mbps) · 300 คน ≈ 7.2 MB/s (~58 Mbps) · ต้องเช็ค bandwidth ของ VM · ถ้าเกินค่อยส่งเฉพาะคนในระยะ (Colyseus StateView)
  - ⚠️ ห้องเต็ม (`maxClients`) แล้ว `joinOrCreate` **เปิดฮอลล์ที่สองให้เงียบๆ** คนในงานเดียวกันจะแยกกันคนละโลก · POC ผูกห้องกับ `eventId` ด้วย `filterBy` แล้ว (งานต่างกันไม่ปนกัน) · ตอน implement ต้องปฏิเสธเมื่อเต็มแทนการเปิดห้องใหม่
  - เปิดจากเครื่องอื่นผ่าน IP วง LAN แล้วเกมไม่ต่อ: Next 16 ตอน dev บล็อก dev asset จาก origin ที่ไม่ใช่ `localhost` → หน้าแสดงได้ (SSR) แต่ JS ไม่ทำงาน · console เห็นแค่ `ws://…/_next/hmr failed` · แก้ด้วย `allowedDevOrigins` ใน `next.config.ts` (`192.168.*.*` · `10.*.*.*` · `172.*.*.*`) · ทดสอบ 2 client ผ่าน `192.168.1.9` + 1 client ผ่าน `localhost` เห็นกันครบ
  - 🔴 **บั๊กที่เจอและแก้แล้ว**: การตรวจความเร็วแบบเทียบทีละ message (ระยะ ≤ ความเร็ว × เวลาตั้งแต่ message ก่อน) · พอ message มากระจุกกัน (เน็ตกระตุก · CPU ตัน) ช่วงเวลาเกือบ 0 → ก้าวปกติ 13 px ถูกปฏิเสธ · ramp ฮอลล์เดียว: 500 คน = 49 ครั้ง · 750 = 100 · 1000 = 6,627 · ผู้ใช้ wifi ไม่เสถียรจะโดนแบบเดียวกัน · แก้เป็นโควตาระยะทาง → **0 ครั้งทุกระดับถึง 1,000 คน** · server นับการปฏิเสธแยกสาเหตุ (`rejected speed / wall` ใน log ของ `STATS=1`)

**ข้อสรุปที่เสนอ**
- **tick 15 Hz** (patch ทุก 67 ms) + client ส่ง 15 ครั้ง/วิ + interpolation delay 120 ms (≈ 2 patch)
- 10 Hz ประหยัด bandwidth ~30% แต่ 120 ms จะครอบคลุมแค่ ~1 patch ต้องเพิ่ม delay เป็น ~200 ms (ยังไม่ได้ลองดูด้วยตาว่าลื่นแค่ไหน)
- 150 คนต่อฮอลล์รับได้สบาย · 300 คนใน 1 ห้องก็ยังไหว (CPU ≤ 14%) · คอขวดถัดไปคือ bandwidth ไม่ใช่ CPU

**สิ่งที่ยังไม่ได้ทดสอบ**
- เครือข่ายจริง (latency · packet loss · มือถือ 4G) → ทดสอบพร้อม S7 บน VM
- bot ไม่ได้จำลองขนาดตัว (ตรวจแค่จุดกลาง) และไม่ได้จำลองคนเดินชนกัน
- fps บนเครื่องสเปกต่ำ / มือถือ · fps ในตารางวัดบนแท็บเดียวที่ตำแหน่งเดียว

---

---

## S4 Proximity media ✅ (`s4-done`)

**คำถาม**: เข้าใกล้ได้ยินเสียง · เข้าโซนบูธเห็นจอ/กล้องผู้นำเสนอ · ออกแล้วหาย · เปลี่ยนเร็วแค่ไหน · browser รับได้กี่ track · ทดสอบกับคนจริง 8–10 คน

**การออกแบบที่ทดสอบ** (`demo-app/web/src/media/ProximityMedia.ts` · หน้า `/s4`)
- 1 ฮอลล์ = 1 Colyseus room + 1 LiveKit room (`hall-<eventId>`) · join Colyseus ก่อน แล้วใช้ **sessionId เป็น identity ของ LiveKit** → จับคู่ตำแหน่งกับ media ได้
- token แยกสิทธิ์: ผู้ชม publish ได้แค่ไมค์ (`canPublishSources`) · ผู้นำเสนอได้ไมค์ · กล้อง · แชร์จอ · ผู้นำเสนอของบูธไหนเก็บใน Colyseus (`presenterOf` · server รับเฉพาะชื่อบูธที่มีจริง)
- LiveKit `autoSubscribe: false` · ทุก 200 ms client คำนวณจากตำแหน่งใน Colyseus แล้ว `setSubscribed()`:
  - ไมค์: เริ่มได้ยิน < 5 ช่อง · หยุด > 7 ช่อง · ความดังลดตามระยะ · ผู้นำเสนอของบูธที่ยืนอยู่ได้ยินเต็มเสมอ
  - จอ/กล้อง: subscribe เฉพาะของผู้นำเสนอบูธที่ตัวเองยืนอยู่ · ออกจากบูธ = unsubscribe (server หยุดส่ง ไม่ใช่แค่ซ่อน)
- คนที่อยู่ใน LiveKit แต่ไม่มีใน Colyseus → ไม่ subscribe

**วิธีทดสอบ** (`demo-app/tests/s4-check.mjs`) · Chrome 3 ตัว กล้อง/ไมค์/จอปลอม
1. P (ผู้นำเสนอ booth-2) เดินเข้าบูธ แล้วแชร์จอ
2. A และ B (ผู้ชม) เกิดที่จุด spawn ห่าง P ~20 ช่อง
3. A เดินเข้า booth-2 → วัดเวลาตั้งแต่ตัดสินใจจน subscribe และจนภาพแรกขึ้น · เช็คว่า B ถูกถอดที่ระยะเท่าไร
4. A เดินออกไปทางเดิน → จอต้องหาย · ยังได้ยิน P ตามระยะ
5. B เดินมาใกล้ A → ต้องได้ยินกันอีกครั้งเมื่อ < 5 ช่อง
6. ผู้ชมลองแชร์จอเอง → token ต้องไม่อนุญาต

**ผล** (รัน 3 รอบ · 12/12 ผ่านทุกรอบ · ไม่มี error)

| เรื่อง | ผล |
|---|---|
| ผู้ชมใกล้กันได้ยินกัน · เสียงไหลจริง | ✅ ~9.6 KB/s ต่อ track |
| ไกลและอยู่นอกบูธ ไม่ได้ยิน/ไม่เห็น P | ✅ |
| ผู้ชมแชร์จอเอง | ✅ ถูกปฏิเสธ (token grant) |
| เข้าบูธ → เห็นจอ + ได้ยิน P | ✅ ตัดสิน → subscribe 46–55 ms · ตัดสิน → ภาพแรก 99–109 ms |
| B ถูกถอดเมื่อห่าง | ✅ ที่ 7.2–7.9 ช่อง (ไม่ใช่ที่ 5) · ถอดเสร็จ 251–252 ms · ไม่กะพริบ (1 เปิด + 1 ปิด) |
| ความดังของผู้นำเสนอในบูธ | ✅ 100% · จากทางเดินเบาลงตามระยะ |
| B (นอกบูธ) ไม่เคย subscribe จอของ P | ✅ |
| ออกจากบูธ → จอหาย | ✅ server ถอด track ใน 248–249 ms |
| B กลับมาใกล้ → ได้ยิน A | ✅ ที่ 4.1–4.7 ช่อง · subscribe 46–54 ms |

**เวลาสลับทั้งหมด** (เดินข้ามเส้น → เห็น/ได้ยิน) ≈ รอ patch ตำแหน่ง ≤ 67 ms + รอรอบตัดสิน ≤ 200 ms + subscribe ~50 ms (เสียง) หรือภาพแรก ~120 ms (จอ) → **ไม่เกิน ~0.4 วิ**

**browser รับได้กี่ track** (`demo-app/tests/s4-tracks.mjs`) · `lk perf load-test` ปล่อย track เข้าฮอลล์ · Chrome 1 แท็บ subscribe ทุก track (`?subscribeAll`) · หยุด game loop ระหว่างวัด เพราะ headless วาด WebGL ด้วย CPU (ถ้าไม่หยุด CPU เกม 300% กลบทุกอย่าง)

| รับ | ได้ครบ | เข้า | CPU Chrome (1 core = 100%) |
|---|---|---|---|
| — (อยู่ในฮอลล์เฉยๆ) | — | — | 10% |
| เสียง 10 | 10/10 | 0.20 Mbps | 19% |
| เสียง 20 | 20/20 | 0.40 Mbps | 26% |
| เสียง 40 | 40/40 | 0.80 Mbps | 24% |
| เสียง 20 + วิดีโอ 2 | ครบ | 0.69 Mbps | 69% |
| เสียง 40 + วิดีโอ 4 | ครบ | 3.90 Mbps | 138% |

- เสียงถูกมาก (40 track +~15%) · ภาระหลักคือวิดีโอ (headless ถอดรหัสด้วย CPU · browser จริงใช้ hardware decode จะเบากว่า) → การออกแบบที่ให้เห็นแค่จอ/กล้องของบูธที่ยืนอยู่ (≤ 2 วิดีโอ) ถูกทางแล้ว
- วิดีโอในแผงข้าง (กว้าง 340 px) ได้ layer เล็กจาก adaptive stream อัตโนมัติ (~0.3 Mbps ต่อวิดีโอ)

**ปัญหาที่เจอ**
- `isSubscribed` เป็น false ทันทีที่สั่ง unsubscribe แต่ server ถอด track จริงหลังจากนั้น ~250 ms (event `TrackUnsubscribed`) → วัดเวลาจาก event ไม่ใช่จาก flag
- ปิด browser แบบกระชาก → participant ค้างใน LiveKit จนหมด timeout · ไม่กระทบ เพราะไม่มีใน Colyseus จึงไม่มีใคร subscribe
- 🔴 **เปิดจากเครื่องอื่นผ่าน IP วง LAN แล้วไมค์/media ใช้ไม่ได้** 3 สาเหตุ: (1) หน้า `http://<IP>` ไม่ใช่ secure context → `navigator.mediaDevices` ไม่มี (ยืนยันแล้ว) · (2) token ส่ง `ws://localhost:7880` · (3) LiveKit ประกาศ node IP เป็น `127.0.0.1` · แก้ (2) ให้ token ใช้ host เดียวกับหน้าเว็บ · (3) `NODE_IP` ใน docker compose · (1) ใช้ flag ของ Chrome ตอนทดสอบ · **ของจริงต้องเป็น HTTPS ทั้งหมด** (web · Colyseus `wss` · LiveKit `wss`) ผ่าน nginx + cert จริง → S7 · ทดสอบ `s4-check` ผ่าน `http://192.168.1.9:3000` (+ flag) ได้ 12/12

**ข้อจำกัดของ POC** (ต้องแก้ตอน implement)
- identity และ role ส่งมาจาก client (query string) → ของจริงต้องออก token จาก session และ role ใน DB · และต้องตรวจว่า sessionId เป็นของคนนั้นจริง
- ทุกคนในฮอลล์ publish ไมค์ตลอด (ปิดได้เอง) · เสียงโซนบูธ + mute โดย Presenter เป็นงานของ S5

**สิ่งที่ยังไม่ได้ทดสอบ**
- ⚠️ **คนจริง 8–10 คน** (เสียงจริง · เสียงสะท้อน · ความรู้สึกเรื่องความดังตามระยะ) → ทำตามขั้นตอนด้านล่าง
- ข้ามเครือข่าย / TURN → S7

**ทดสอบกับคนจริง** (ทุกคนอยู่วง LAN เดียวกัน · ใส่หูฟัง · ใช้ Chrome/Edge บนคอมฯ หรือ Chrome บน Android)

เครื่องที่รัน (ดู IP ได้จาก `ipconfig getifaddr en0` บน Mac):
```
cd poc/demo-app && NODE_IP=<IP> docker compose up -d     # LiveKit ต้องประกาศ IP วง LAN ไม่ใช่ 127.0.0.1
cd poc/demo-app/realtime && npm start                     # terminal 1
cd poc/demo-app/web && npm run dev                        # terminal 2
```
เครื่องผู้ทดสอบแต่ละคน (ครั้งแรกครั้งเดียว · browser ให้ใช้ไมค์เฉพาะ https หรือ localhost):
1. เปิด `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → ใส่ `http://<IP>:3000` → Enabled → Relaunch
2. เปิด `http://<IP>:3000/s4` · คนที่ 1 เลือก "ผู้นำเสนอ booth-2" เดินเข้า booth-2 แล้วกดแชร์จอ · คนอื่นเลือก "ผู้ชม" · อนุญาตไมค์
3. ลอง: ยืนใกล้กันแล้วคุย · เดินห่างทีละนิด (ดูตัวเลขช่องในแผงขวา) · เข้า/ออก booth-2 · 8–10 คนพร้อมกันในบูธเดียว
4. จด: ได้ยินชัดไหม · ระยะ 5/7 ช่องพอดีไหม · เสียงเบาตามระยะเป็นธรรมชาติไหม · มีเสียงสะท้อนไหม · เครื่องไหนกระตุก

---

## Hall art (ไม่ใช่ spike)

หน้า `/hall` ใน `demo-app/web` · ลองหน้าตาโลก 2D แบบ Gather: ตัวละคร 2D chibi เป็นนักศึกษา + แมปจำลองงานแสดงโปรเจคจบ · ไม่มี server/เสียง (ใช้ระบบเดินแบบ S1)

- **Art วาดด้วย code ทั้งหมด** (`web/scripts/gen-hall.mjs` + `scripts/lib/`) → ลิขสิทธิ์ของทีม ไม่ใช้ asset ภายนอก · ได้ `public/assets/hall/` (tileset 32 px · ตัวละคร 32×48 px 20 แบบ × 4 ทิศ × 4 เฟรม · props atlas · `hall.json` เปิดใน Tiled ได้)
- ตัวละคร: ชุดนักศึกษา (เชิ้ตขาว + เนคไท / กระโปรง) · Staff (เสื้อน้ำเงิน) · Judge (สูท) · ผู้ชม (ชุดไปรเวท) · สายคล้องคอสีตาม role
- แมป 60×40 ช่อง: 24 บูธใน 4 โซนตามหมวด (AI & Data · Web & Mobile · IoT & Robotics · Games & XR) · ป้ายชื่อบูธ + สถานะ LIVE · เวที + ที่นั่ง · Workshop · Lounge · โต๊ะกรรมการ · Popular Vote · จุดลงทะเบียน + ทางเข้า
- NPC ~120 คน: ผู้นำเสนอยืนหลังโต๊ะ · ผู้ชมเดินไปบูธอื่นเอง (A* บน grid 16 px) · มีบับเบิลพูด
- ใช้งาน: เดินด้วยลูกศร/WASD/คลิก (หาทางหลบโต๊ะเอง) · scroll ซูม · คลิก minimap เพื่อเดินไป · เข้าบูธแล้วมีการ์ดข้อมูล · แถบล่างแสดงคนในรัศมี 5 ช่อง (ค่าเดียวกับ S4)
- ทดสอบ `npm run hall` (headless Chrome): NPC 120 · คลิกเดินถึงบูธ · การ์ดบูธขึ้น · ชนโต๊ะบูธ · ไม่มี error · fps 49–57 (swiftshader ไม่มี GPU)
- ⚠️ แมปนี้ทำก่อนตกลง spec · โต๊ะกรรมการ · จุด Popular Vote · จุดลงทะเบียน ไม่มีใน spec แล้ว (เป็นฟังก์ชันใน UI) · แมปที่ตรง spec อยู่ในหัวข้อ Hall presets

## Hall presets (ไม่ใช่ spike)

หน้า `/presets` ใน `demo-app/web` · ทดลองกติกาฮอลล์ใน `docs/features.md`: แมปเดียวใช้ได้ทุกจำนวนผลงาน มี/ไม่มีหมวด · ใช้ art ชุดเดียวกับ Hall art · offline

- `web/scripts/gen-presets.mjs` → `public/assets/presets/` (`room.json` · `hall.json` เปิดใน Tiled ได้ · tileset · props · `boxes.json` กล่องชนของ prop) · แมปมีแค่พื้น ผนัง ของตกแต่ง + object layer `blocks` และ `slots` (ช่องบูธ 4×5 ช่อง เว้น 1 ช่องระหว่างบูธ · ลำดับเติมเริ่มจาก block ที่ใกล้ทางเข้า)
- **Room** 34×26 ช่อง: 2 block × 6 บูธ (แถวบน + แถวล่าง) · กลางห้องโล่งเป็นที่ยืนคุย
- **Hall** 70×42 ช่อง: 5 block × 6 บูธ · ทางเดินหิน · เวที + ที่นั่ง · workshop · lounge ข้างทางเข้า · ป้ายแผนผังที่ทางเข้า (เวที/workshop/lounge เป็นฉาก ใช้ proximity ปกติ)
- บูธวางตอนรัน (`src/game/PresetScene.ts`): ปูพรมสีตามหมวดด้วย `putTileAt` · ฉากหลัง + โต๊ะ + ป้ายชื่อ + ผู้นำเสนอ · ช่องว่างเป็นต้นไม้ + เก้าอี้ · block ที่ว่างทั้งกลุ่มเป็น lounge (พรม + ชุดโซฟา) · **1 block = 1 หมวด** (โซน) · ป้ายโซน · block ไม่พอขึ้นคำเตือน · คำนวณทางเดินใหม่ทุกครั้งที่จัด
- ใช้งาน: เลือก Room/Hall · By category / No categories · slider จำนวนผลงานก่อนงาน (จัดใหม่ทั้งหมด) · `+ Add booth during the event` (ลงช่องว่างในโซนของหมวดตัวเอง หรือ block ว่าง · บูธอื่นไม่ขยับ · เต็มแล้วขึ้นข้อความให้เลือก preset ใหญ่ขึ้น) · เดินเข้าบูธแล้วมีการ์ด · **ระยะได้ยินนอกบูธ** 5 ช่อง (ค่าที่ใช้ · เท่า Gather) / 8 ช่อง (ไว้เทียบ) แสดงเป็นวงรอบตัว + วงในเสียงเต็ม 2 ช่อง + จำนวนคนที่ได้ยิน (ในโซนบูธนับเฉพาะคนในบูธเดียวกัน)
- ทดสอบ `npm run presets` (headless Chrome): Hall 18/30 · 1 หมวดต่อ block (4 โซน + lounge 1) · 30 ผลงาน 4 หมวดต้องใช้ 7 block แต่มี 5 → ขึ้นคำเตือน วางได้ 23 · ไม่มีหมวดเรียงตามลำดับ · เพิ่มบูธแล้วบูธเดิมขยับ 0 · เต็มแล้วขึ้นข้อความ · คลิกเดินถึงบูธ · block ว่างเป็น lounge · ยืนกลาง lounge ได้ยิน 1 คน (5 ช่อง) vs 3 คน (8 ช่อง) · Room 12/12 · Room มี 2 block จึงรับได้ 2 หมวด · ไม่มี error · fps 58 · ภาพอยู่ `tests/out/presets-*.png`

## Capacity: ตัวเลขดิบ

### Colyseus: ramp ฮอลล์เดียว (`demo-app/realtime/loadtest/run.sh <คน> 1 40`)

แต่ละรอบ: เปิด server ใหม่ · bot เดินสุ่มตลอด 40 วิ · tick 15 Hz · หลังแก้บั๊กโควตาระยะทาง

| คนในฮอลล์ | รับต่อ client | server ส่งออกรวม (คำนวณ) | CPU server (1 core) | RSS | loop p99 | RTT p99 | correction | CPU เครื่องว่าง |
|---|---|---|---|---|---|---|---|---|
| 100 | 7.8 KB/s | 6 Mbps | 6.5% | 127 MB | 12.4 ms | 5 ms | 0 | 86% |
| 300 | 25.2 KB/s | 60 Mbps | 12.8% | 170 MB | 16.7 ms | 13 ms | 0 | 81% |
| 500 | 44.3 KB/s | 177 Mbps | 13.3% | 233 MB | 32.0 ms | 60 ms | 0 | 77% |
| 750 | 67.4 KB/s | 404 Mbps | 15.4% | 206 MB | 26.6 ms | 28 ms | 0 | 61% |
| 1,000 | 87.7 KB/s | 702 Mbps | 23.2% | 263 MB | 56.0 ms | 122 ms | 0 | 28% |

- รับต่อ client ≈ **0.088 KB/s × จำนวนคน** → server ส่งออกรวม ≈ 0.088 × N² KB/s
- ที่ 1,000 คน เครื่องทดสอบเหลือ CPU ว่าง 28% (bot 1,000 ตัวแย่ง CPU) → RTT / loop p99 ที่สูงขึ้นมีส่วนจากเครื่องทดสอบ ไม่ใช่ server ล้วน
- server ยังไม่ตันที่ 1,000 คน (CPU 23% ของ 1 core) · ข้อจำกัดจริงคือ bandwidth (0.7 Mbps ต่อคน · 700 Mbps รวม) และ browser ต้องวาด 1,000 ตัว (ทดสอบ fps แค่ถึง 300)

### Colyseus: หลายงานพร้อมกัน (`run.sh 150 <งาน> 40` · 1 process)

| งานพร้อมกัน × คน | รวม | รับต่อ client | CPU server (1 core) | RSS | loop p99 | RTT p99 | correction |
|---|---|---|---|---|---|---|---|
| 2 × 150 | 300 | 11.6 KB/s | 12.0% | 213 MB | 13.8 ms | 12 ms | 0 |
| 4 × 150 | 600 | 11.7 KB/s | 17.0% | 230 MB | 18.2 ms | 6 ms | 0 |
| 8 × 150 | 1,200 | 11.6 KB/s | 26.0% | 272 MB | 13.5 ms | 40 ms | 0 |
| 16 × 150 | 2,400 | 11.3 KB/s | 62.0% | 238 MB | 61.9 ms | 83 ms | 0 |

- แยกงานแล้ว bandwidth ต่อคนคงที่ ~11.6 KB/s (ขึ้นกับจำนวนคนในฮอลล์ตัวเอง ไม่ใช่ทั้ง server)
- 1 process (Node ใช้ 1 core) รับ 8 งาน × 150 สบาย · 16 งานเริ่มหน่วง (loop p99 62 ms) → เกิน ~8–10 งานต่อ process ให้เพิ่ม process (ต้องใช้ Redis presence/driver · 1 ห้องอยู่ได้ process เดียว)
- ที่ 16 งาน เครื่องทดสอบเหลือ CPU ว่าง 40%

### LiveKit: media load (`demo-app/loadtest-media/run.sh`)

เครื่องมือ: `lk perf load-test` (LiveKit CLI 2.19) · publisher ส่งวิดีโอ 720p simulcast วนซ้ำ (keyframe ทุก ~3 วิ) และเสียงเป็น packet เปล่าตาม bitrate · LiveKit รันใน Docker Desktop (VM 10 CPU · 7.6 GB) · restart LiveKit ทุกรอบ · วัด CPU / RAM / byte ส่งออกของ container ด้วย `docker stats` ช่วงกลางรอบ · รอบละ 40 วิ

สถานการณ์จำลองฮอลล์ 150 คน (ใช้ room ย่อยแทน "กลุ่มที่ subscribe กัน" เพราะใน app จริง client subscribe เฉพาะคนในระยะ/ในโซนบูธ)

| สถานการณ์ | ตั้งค่า | track ที่ได้ | ต่อผู้ชม | loss สูงสุด | CPU LiveKit (1 core = 100%) | RAM | ส่งออกรวม |
|---|---|---|---|---|---|---|---|
| **A บูธ** (ผู้ชมทุกคนดูจอในบูธ) | 15 บูธ × (จอ 720p 1 + เสียง 3 + ผู้ชม 10) | 600/600 | 1.36 Mbps | 0.07% | **101–126%** | 570 MB | **254–265 Mbps** |
| A ความละเอียด medium | เหมือน A แต่ `medium` | 600/600 | 0.39 Mbps | 0.01% | 92% | — | 80 Mbps |
| **B เวทีเดียว** | 1 ห้อง × (จอ 1 + เสียง 1 + ผู้ชม 150) | 300/300 | 1.2 Mbps | 0% | 67–88% | 350–700 MB | 232–237 Mbps |
| **C คุยกันเป็นกลุ่ม** | 19 กลุ่ม × (เสียง 8 + ผู้ฟัง 8) | 1216/1216 | 146 kbps | 0% | 179% | 1.46 GB | 56 Mbps |
| A × 2 ฮอลล์ | 30 บูธ | 1056/1200 | 0.17 Mbps | 6.1% | 377% | 1.2 GB | 143 Mbps |

- A × 2 **ใช้ไม่ได้เป็นตัวเลข capacity**: เครื่อง Mac เหลือ CPU ว่าง 6.8% (ตัวทดสอบ + LiveKit + Docker แย่งกัน) · loss และ bitrate ที่ตกมาจากเครื่องทดสอบตัน · ต้องวัดซ้ำบน VM โดยรันตัวทดสอบจากเครื่องอื่น
- C ใช้ CPU มากกว่า A เพราะงานของ SFU ขึ้นกับจำนวน packet: เสียง 1 track ≈ 50 packet/วิ × 1,216 subscription · ตัวทดสอบส่งเสียงตลอดเวลา ส่วนเบราว์เซอร์จริงใช้ Opus DTX (เงียบ = แทบไม่ส่ง) → ของจริงน่าจะเบากว่านี้ ต้องวัดกับ browser จริงใน S4
- ⚠️ ตัวทดสอบใน layout `speaker` subscribe สูงสุด 6 track ต่อคน · `3x3` ขอภาพ layer เล็ก (A ได้ 0.5 Mbps แทน 1.36) → A/B ใช้ `speaker` · C ใช้ `3x3`
- CPU ของ Apple M4 ต่อ core เร็วกว่า vCPU ของ VM ทั่วไป → อย่าใช้ % CPU ตรงๆ กับ VM · ต้องวัดซ้ำบน VM

### เทียบกับ benchmark ทางการของ LiveKit

เครื่อง `c2-standard-16` (16 core) บน Google Cloud · [LiveKit Benchmarks](https://docs.livekit.io/transport/self-hosting/benchmark/)

| สถานการณ์ | Pubs / Subs | ส่งออก | CPU |
|---|---|---|---|
| Large audio rooms | 10 / 3,000 | 23 MBps | 80% |
| Large meeting (720p) | 150 / 150 | 93 MBps (~744 Mbps) | 85% |
| Livestreaming | 1 / 3,000 | 531 MBps (~4.2 Gbps) | 92% |

LiveKit ระบุว่า 1 room ต้องอยู่ใน node เดียว · ข้อจำกัดหลักคือ CPU และ bandwidth · แนะนำ host networking ใน Docker และเครื่องแบบ compute-optimized ([Deployment](https://docs.livekit.io/transport/self-hosting/deployment/))

---

## Capacity: สรุป · สเปก VM · สิ่งที่ต้องขอ · วัดเพิ่ม · Fallback

ตีความจากตัวเลขดิบในหัวข้อก่อนหน้า

### สรุป

| คำถาม | คำตอบตอนนี้ | ความมั่นใจ |
|---|---|---|
| ฮอลล์เดียวรับได้กี่คน (ตำแหน่ง · Colyseus) | **ตั้งเพดาน 300 คน/ฮอลล์** · ทดสอบได้ถึง 1,000 server ยังไม่ตัน แต่แต่ละคนต้องรับ 88 KB/s และ server ส่งออก ~700 Mbps | สูง (วัดแล้ว) |
| ฮอลล์เดียวรับได้กี่คน (media · LiveKit) | 150 คนต่อฮอลล์ใช้ ~1–1.3 core ของ M4 และ ~255 Mbps เมื่อทุกคนดูจอ 720p | กลาง (วัดบน Mac · ต้องวัดซ้ำบน VM) |
| หลายงานพร้อมกัน (Colyseus) | 1 process รับ **8 งาน × 150 คน** สบาย · 16 งานเริ่มหน่วง | สูง |
| หลายงานพร้อมกัน (media) | **ถูกจำกัดด้วย bandwidth**: ~250 Mbps ต่องาน (720p) หรือ ~80 Mbps (medium) · uplink 1 Gbps ≈ 3 งาน (720p) หรือ ~10 งาน (medium) | กลาง (คำนวณจากผล 1 ฮอลล์) |
| คอขวดตัวแรก | **bandwidth ขาออกของ VM** · ถัดมาคือ CPU ของ LiveKit | สูง |

**นิยาม "รองรับได้"**: ทุกคนได้ track ครบ · packet loss < 1% · event-loop p99 ของ Colyseus < 50 ms · RTT p99 < 100 ms · correction ผิดพลาด = 0

### ตัวเลขที่ใช้คำนวณ

| รายการ | ค่า | ที่มา |
|---|---|---|
| ตำแหน่ง (Colyseus) ต่อผู้ใช้ | 0.088 KB/s × จำนวนคนในฮอลล์ (150 คน = 11.6 KB/s ≈ 0.1 Mbps) | วัด |
| จอแชร์ 720p ต่อผู้ชม | 1.2–1.4 Mbps | วัด |
| จอแชร์ medium ต่อผู้ชม | ~0.4 Mbps | วัด |
| เสียงต่อ track | ~20 kbps (ตัวทดสอบ) · ~40 kbps (ตั้งไว้ใน `technical.md`) · browser จริง ~76 kbps ไป-กลับ (S2) | วัด |
| LiveKit 150 คน ดูจอในบูธ | CPU 1–1.3 core (M4) · RAM ~0.6 GB · ส่งออก 254–265 Mbps | วัด |
| LiveKit 150 คน คุยเป็นกลุ่ม 8 คน | CPU ~1.8 core (M4) · RAM ~1.5 GB · ส่งออก 56 Mbps | วัด (ตัวทดสอบส่งเสียงตลอด → สูงกว่าจริง) |
| Colyseus ต่อฮอลล์ 150 คน | ~3% ของ 1 core (M4) · RAM ~30 MB ต่อฮอลล์ | วัด |
| LiveKit 150 pubs × 150 subs (720p) | 85% ของ 16 core · ส่งออก ~744 Mbps | [benchmark ทางการ](https://docs.livekit.io/transport/self-hosting/benchmark/) |

**Bandwidth ต่องาน 150 คน (ขาออกจาก server)**

| สถานการณ์ | ต่อผู้ใช้ | ทั้งงาน |
|---|---|---|
| ทุกคนดูจอ 720p + คุยกลุ่มเล็ก | ~1.6 Mbps | **~250–300 Mbps** |
| ทุกคนดูจอ medium + คุยกลุ่มเล็ก | ~0.6 Mbps | ~90–100 Mbps |
| เดินเล่น + คุยเสียงอย่างเดียว | ~0.3 Mbps | ~50–60 Mbps |

**ข้อมูลต่อผู้ใช้**: ดูจอ 720p ~0.6 GB/ชั่วโมง (สำคัญกับคนใช้ 4G) · ทั้งงาน 150 คน × 2 ชั่วโมง ≈ 180 GB (720p) หรือ ~55 GB (medium)

### VM ที่ได้ (CP26SSI3)

ค่าเริ่มต้นที่อาจารย์ตั้งให้ · น่าจะขอแก้หรือขอเพิ่มได้ (ยังไม่ยืนยัน) · **พัฒนาตามแผนไปก่อน** ถ้าขอไม่ได้ใช้แผนสำรองด้านล่าง

| | ได้ | เทียบกับที่ต้องการ |
|---|---|---|
| สเปก | 4 vCPU · 8 GB · 80 GB · Ubuntu 26.04 LTS | = ขั้นต่ำ · พอสำหรับ Exam 3 และงาน 1 งาน ≤ 150 คน **ถ้า LiveKit ไม่อยู่บน VM นี้** · ขอเพิ่มได้ |
| เครือข่าย | hostname `cp26ssi3.sit.kmutt.ac.th` → **`10.4.82.27` (IP ภายใน)** · คนนอกเข้าได้ทาง reverse proxy ของคณะ (`bscit.sit.kmutt.ac.th` → 202.44.9.103 · nginx) เท่านั้น | ❌ ไม่มี public IP · ไม่มี UDP |
| เข้า VM (SSH · พอร์ตตรง) | **ต้องต่อ VPN มหาวิทยาลัย** | ผู้ใช้งานจริงเข้าทาง URL ด้านล่าง ไม่ต้องใช้ VPN |
| URL | `https://bscit.sit.kmutt.ac.th/capstone26/CP26SSI3` (ตอนนี้ตอบ 404 เพราะยังไม่มีอะไรรัน) | web อยู่ใต้ path ไม่ใช่โดเมนของตัวเอง |
| พอร์ต | 80 · 443 · 5173 · 8080 · SSE ได้ | ยังไม่รู้ว่าเป็นพอร์ตที่ proxy ส่งต่อ หรือเปิดตรง · ยังไม่รู้ว่า WebSocket ผ่านได้ไหม |

**ผลต่อระบบ**
- **LiveKit**: media ต้องต่อตรงด้วย UDP 50000–60000 / TCP 7881 / TURN TLS ซึ่งผ่าน HTTP reverse proxy ไม่ได้ → คนนอกมหาวิทยาลัยใช้เสียง/ภาพไม่ได้ถ้า LiveKit อยู่บน VM นี้ → ถ้าขอ public IP + พอร์ต media ไม่ได้ **ย้าย LiveKit ออก** (LiveKit Cloud: ฟรี 5,000 participant-minute/เดือน พอสำหรับเดโม Exam 3 · งานจริง 150 คน × 2 ชม. = 18,000 นาทีต้องใช้แผนเสียเงิน · ราคาจากแหล่งรอง ต้องเช็คหน้า pricing) หรือขอ public IP จาก IT
- **Colyseus**: ใช้ได้ถ้า proxy ส่ง WebSocket (`Upgrade`) ต่อให้ · ถ้าไม่ได้ ต้องย้าย realtime ออกไปพร้อม LiveKit
- **Next.js**: ตั้ง `basePath: '/capstone26/CP26SSI3'` · asset · API route · cookie · OAuth redirect URI ต้องอยู่ใต้ path นี้
- **cert**: proxy ของคณะถือ TLS ให้แล้ว (ไม่ต้อง certbot บน VM สำหรับ web)

**คำถามที่ต้องถาม IT** (เรียงตามความสำคัญ)
1. proxy ส่ง `/capstone26/CP26SSI3/*` ไปที่พอร์ตไหนของ VM · ตัด path ออกหรือส่งทั้ง path · พอร์ต 5173 / 8080 ใช้ทำอะไร (เปิดตรงหรือผ่าน proxy คนละ path)
2. **WebSocket ผ่าน proxy ได้ไหม** (`Upgrade` / `Connection`) · timeout ของ connection ที่เปิดค้างนานเท่าไร
3. ขอ **public IP** (หรือ port forward) + **UDP 50000–60000** (หรือ UDP 7882 พอร์ตเดียว) + **TCP 7881** + TCP/UDP 443 ให้ VM ที่ 2 สำหรับ LiveKit ได้ไหม · ถ้าได้ต้องมี subdomain + cert ของตัวเอง (เช่น `livekit-cp26ssi3.sit.kmutt.ac.th`)
4. VM ออก internet ได้ไหม (OAuth Google/Microsoft · LLM API · ส่งอีเมล · ดึง Docker image)
5. bandwidth ขาออกของ proxy / VM จำกัดเท่าไร
6. ติดตั้ง Docker ได้ไหม · ทุกคนในทีมใช้ VPN มหาวิทยาลัยเข้า VM ได้พร้อมกันไหม
7. ใช้ได้ถึงเมื่อไร · snapshot/backup ได้ไหม

**ที่ควรขอตอนนี้**
- **VM ที่ 2** (2 vCPU / 4 GB พอ): (ก) ถ้า IT ให้ public IP + พอร์ต media ได้ → ใช้รัน LiveKit · (ข) ถ้าไม่ได้ → ใช้เป็น staging และเครื่องยิง load test (ตัวทดสอบต้องอยู่คนละเครื่องกับ server)
- **ยังไม่ต้องขอเพิ่ม spec** ของ VM แรก · ให้ deploy แล้ววัดซ้ำบน VM ก่อน (ตัวเลข POC วัดบน M4) · จะขอเพิ่มก็ต่อเมื่อย้าย LiveKit มาไว้บน VM ได้

### สเปก VM ที่ต้องขอ

ค่า CPU ใน POC วัดบน Apple M4 ซึ่งต่อ core เร็วกว่า vCPU ของ VM ทั่วไป → เผื่อ vCPU 2 เท่าจากที่วัดได้ และ **ต้องวัดซ้ำบน VM จริง**

| | ขั้นต่ำ (Exam 3 · งานทดลอง 1 งาน ≤ 150 คน) | แนะนำ (งานจริง 1–2 งานพร้อมกัน) |
|---|---|---|
| vCPU | 4 | **8** (แบบ compute ถ้าเลือกได้) |
| RAM | 8 GB | **16 GB** |
| Disk | 80 GB SSD | **200 GB SSD** |
| Network | NIC 1 Gbps · ส่งออกต่อเนื่อง ≥ 300 Mbps | NIC 1 Gbps · ส่งออกต่อเนื่อง ≥ 600 Mbps |
| OS | Ubuntu LTS · Docker + Compose | เหมือนกัน |
| IP | **public IPv4 คงที่** | เหมือนกัน |

**ที่มาของตัวเลข** (แนะนำ · 2 งานพร้อมกัน)
- vCPU: LiveKit ~2–3 core M4 ต่องาน × 2 งาน × 2 (เผื่อ VM) ≈ 6 + Colyseus · API · DB · nginx ~2 → 8
- RAM: LiveKit ~1.5 GB/งาน · Postgres 2 GB · API + Next 2 GB · Colyseus 0.5 GB · MinIO 0.5 GB · Redis 0.5 GB · OS + Docker 2 GB → ~10 GB → 16 GB
- Disk: ไฟล์ผลงาน (โปสเตอร์ · สไลด์ · 3D ≤ 20 MB) ~50 MB × 150 บูธ ≈ 7.5 GB ต่องาน · Docker image ~10 GB · DB + log + backup ในเครื่อง
- Network: 2 งาน × ~300 Mbps (720p)

ถ้าได้น้อยกว่านี้: ตั้ง default จอแชร์เป็น medium (ลด bandwidth ~3 เท่า) แล้วรับได้ 1 งาน 150 คนบน 4 vCPU / 8 GB

### สิ่งที่ต้องขอ / ถามฝ่าย IT มหาวิทยาลัย (รายการเต็ม · ข้อเฉพาะของ VM ที่ได้อยู่ในหัวข้อ VM ที่ได้)

**เครือข่าย** (สำคัญที่สุด · ไม่ได้ข้อนี้ media ใช้ไม่ได้)
1. public IPv4 คงที่ · ถ้าอยู่หลัง NAT ต้องเป็น **1:1 NAT** และบอก IP สาธารณะ (ตั้ง `node_ip` / `use_external_ip` ของ LiveKit)
2. เปิด inbound ตาม [LiveKit ports](https://docs.livekit.io/transport/self-hosting/ports-firewall/):

| พอร์ต | ใช้ทำอะไร | จำเป็น |
|---|---|---|
| TCP 80 | ออก cert Let's Encrypt (HTTP challenge) · redirect | ✅ |
| TCP 443 | HTTPS (web · API · WebSocket) + **TURN/TLS** (nginx `stream` + `ssl_preread`) | ✅ |
| UDP 50000–60000 (หรือ UDP 7882 พอร์ตเดียว) | media WebRTC | ✅ |
| TCP 7881 | media ผ่าน TCP เมื่อ UDP ถูกบล็อก | ✅ |
| UDP 3478 | TURN/UDP · STUN | แนะนำ |
| UDP 443 | TURN/UDP บน 443 (บางเครือข่ายเปิดเพราะ QUIC) | ถ้าได้ |
| TCP 22 | SSH จากนอกมหาวิทยาลัย (หรือผ่าน VPN มหาวิทยาลัย) | ✅ |

3. **ไม่มี firewall/IPS ที่บล็อกหรือจำกัด UDP / WebRTC** หรือจำกัดจำนวน connection ต่อ IP
4. bandwidth: NIC กี่ Gbps · มีการจำกัด/shape ขาออกต่อ VM ไหม · ช่วงเวลางานใช้ได้เต็มไหม
5. outbound internet: HTTPS ไป OAuth (Google · Microsoft) · LLM API · ส่งอีเมล (SMTP 587 มักถูกปิด → ถามหรือใช้ email API ผ่าน HTTPS)

**โดเมนและ cert**
6. subdomain 3 ชื่อ เช่น `connecta.<...>.kmutt.ac.th` · `livekit.<...>` · `turn.<...>` (A record ชี้ IP ของ VM)
7. ใช้ Let's Encrypt ได้ไหม (ต้องเปิด TCP 80) หรือต้องใช้ cert ของมหาวิทยาลัย · cert ต้องออกโดย CA จริง (self-signed ใช้กับ WebRTC ไม่ได้)

**สิทธิ์และการดูแล**
8. root/sudo · ติดตั้ง Docker ได้ · Docker ใช้ **host networking** ให้ LiveKit ได้ (LiveKit แนะนำ)
9. ใช้ได้ถึงเมื่อไร (ต้องครอบ Exam 3 · 30 พ.ย.–1 ธ.ค. และงานทดสอบจริง) · ช่วง maintenance / ดับไฟ
10. snapshot / backup ของ VM ได้ไหม
11. ถ้าได้: **VM ที่ 2 ขนาดเล็ก** (2 vCPU / 4 GB) สำหรับ staging และรันตัวทดสอบ load (ตัวทดสอบต้องอยู่คนละเครื่องกับ server)

**บัญชีและอีเมล**
12. บัญชี @kmutt.ac.th เป็น Microsoft: ผู้ใช้กดยินยอมแอปภายนอกเองได้ไหม หรือต้องขอ IT ทำ admin consent ให้แอปของเรา
13. โดเมนสำหรับส่ง magic link (SPF/DKIM) หรือใช้บริการส่งอีเมลภายนอก

**ขอให้เร็ว**: S7 (NAT + TURN) และ Exam 3 ต้องใช้ VM · ทดสอบเร็วสุดคือรัน LiveKit บน VM แล้วเข้าจากมือถือ 4G (ห้ามใช้ wifi มหาวิทยาลัย) ถ้าได้ยินเสียง = เครือข่ายผ่าน

### สิ่งที่ต้องวัดเพิ่ม

| # | วัดอะไร | ทำไม | ทำเมื่อ |
|---|---|---|---|
| 1 | **load test ซ้ำบน VM** (Colyseus + LiveKit) โดยรันตัวทดสอบจากเครื่องอื่น | ตัวเลขตอนนี้วัดบน M4 และตัวทดสอบแย่ง CPU · ได้ vCPU ต่องานจริง · หาจุดพังของ media 2+ งาน | ได้ VM |
| 2 | เข้าจากเครือข่ายจริง: บ้าน · wifi มหาวิทยาลัย · 4G · เน็ตองค์กร · VPN · กี่ % ต้องใช้ TURN | กันเดโมพังเพราะ firewall | S7 |
| 3 | proximity: เข้า/ออกระยะแล้วเสียง/จอมา-หายเร็วแค่ไหน · hysteresis · browser รับได้กี่ track | core feature | S4 |
| 4 | เสียงจาก browser จริงที่ใช้ Opus DTX · คน 8–10 คนจริง | ตัวทดสอบส่งเสียงตลอด → CPU/bandwidth สูงเกินจริง | S4 |
| 5 | fps · CPU · RAM ของ browser บนโน้ตบุ๊กสเปกต่ำและมือถือ ที่ 150–300 avatar + วิดีโอ 1–2 จอ | ผู้ใช้จริงไม่ได้ใช้ M4 | S4 |
| 6 | **join พร้อมกัน**: 150 คนเข้าใน 1 นาทีแรก (Colyseus + LiveKit) | ช่วงเปิดงานคือ peak · มีรายงานว่า LiveKit พลาด connection ตอน join พร้อมกันมากๆ ([community](https://community.livekit.io/t/load-test-at-1-000-participants-19-of-subscriber-connections-fail-with-could-not-establish-signal-connection-cpu-ram-not-saturated/1778)) | VM |
| 7 | **soak test 3–4 ชั่วโมง**: RAM ของ server และ browser | งานจริงยาวหลายชั่วโมง · หา leak | ก่อน Exam 3 |
| 8 | เน็ตแย่: loss 5% · latency 200 ms · wifi หลุดแล้วต่อใหม่ | interpolation · reconnect · คุณภาพเสียง | S4–S7 |
| 9 | ความหน่วงเสียงปาก → หู | คุยสดต้องไม่ช้า (เป้า < 300 ms) | S4 |
| 10 | REST API + DB: เปิดหน้าบูธพร้อมกัน · Judge ส่งคะแนนพร้อมกันก่อนปิดรอบ · อัปโหลดไฟล์ใหญ่ | peak ที่ไม่เกี่ยวกับ realtime | ตอน implement |
| 11 | เวลาและค่าใช้จ่าย LLM ต่อคำถาม | ต้นทุนต่องาน | ตอน implement |

### Fallback

⚠️ งบวิชา (≤ 3,000 บาท/ทีม) **เบิกค่าโครงสร้างพื้นฐานไม่ได้** → ทางที่เสียเงิน (VPS · LiveKit Cloud) ใช้เงินทีมเอง · ทางหลักคือขอ VM มหาวิทยาลัยให้ได้ตามสเปก

| ปัญหา | ทางแก้ (เรียงจากทำง่าย) |
|---|---|
| UDP ถูกบล็อก แต่ TCP 443 ได้ | TURN/TLS บน 443 (ตั้งไว้แล้วในแผน) · ICE/TCP 7881 · คุณภาพลดลงแต่ใช้ได้ |
| ไม่ได้ public IP / เปิดพอร์ตไม่ได้ | ย้าย **LiveKit อย่างเดียว** ไป VPS (เช่น สิงคโปร์) หรือ **LiveKit Cloud** (SDK เดิม เปลี่ยนแค่ URL + key) · web/API/Colyseus ยังอยู่บน VM |
| bandwidth ไม่พอ | จอแชร์ default เป็น medium (~3 เท่า) · subscribe จอเฉพาะคนที่เปิดแผงบูธ · simulcast layer ต่ำสำหรับคนไกล · โหมดเสียงอย่างเดียว · Colyseus `StateView` ส่งตำแหน่งเฉพาะคนในระยะ · จำกัดคนต่อฮอลล์แล้วแบ่งเป็นหลายฮอลล์ |
| CPU ไม่พอ | Colyseus หลาย process (Redis presence/driver · 1 ห้อง = 1 process) · LiveKit node ที่ 2 (Redis · 1 room ต้องอยู่ node เดียว) · แยก LiveKit ไป VM/VPS อีกเครื่อง |
| VM ไม่ทัน Exam 3 | deploy ชุด Docker Compose เดียวกันบน VPS รายชั่วโมง · หรือ LiveKit Cloud + VPS เล็ก |
| VM ล่มวันงาน | สคริปต์ deploy + backup DB → ขึ้นเครื่องสำรองแล้วเปลี่ยน DNS (TTL ต่ำ) |
| login มหาวิทยาลัยไม่ได้ | magic link ทางอีเมล · OAuth Google ส่วนตัว |

**LiveKit Cloud** (ตัวเลขจากแหล่งรอง ต้องเช็คหน้า [pricing](https://livekit.io/pricing) ก่อนใช้): free 5,000 participant-minute/เดือน · งาน 150 คน × 2 ชั่วโมง = 18,000 นาที → ไม่พอ free tier ต้องใช้แผนเสียเงิน (Ship ~$50/เดือน) · [ที่มา](https://trtc.io/blog/details/livekit-pricing-2026)

### ข้อควรรู้สำหรับ implement

- Colyseus: 1 ห้อง = 1 ฮอลล์ ผูกกับ `eventId` · **ห้องเต็มต้องปฏิเสธ** ไม่ใช่เปิดห้องใหม่ (`joinOrCreate` เปิดห้องใหม่ให้เงียบๆ) · `maxClients` = 300
- ตรวจความเร็วด้วยโควตาระยะทาง ไม่ใช่เทียบทีละ message (เทียบทีละ message ปฏิเสธคนเน็ตกระตุก)
- LiveKit: Docker ใช้ host networking · restart ระหว่างทดสอบเพราะ RAM ของ room เก่าค้างอยู่ช่วงหนึ่ง
- ห้ามรันตัวทดสอบ load บนเครื่องเดียวกับ server
