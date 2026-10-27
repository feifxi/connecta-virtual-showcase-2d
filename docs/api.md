# Connecta — API Design

> REST API ของ NestJS ทั้งหมด + message ของ Colyseus + สิทธิ์ใน LiveKit · อิง `features.md` (กติกา) และ `data-model.md` (ตาราง)

---

## หลักการ

- **Base URL**: `https://bscit.sit.kmutt.ac.th/capstone26/CP26SSI3/api/v1` (nginx → NestJS `:4000`) · `/api/auth/*` เป็นของ Better Auth ใน Next.js ไม่อยู่ในเอกสารนี้
- **Auth**: `Authorization: Bearer <JWT>` (JWT plugin ของ Better Auth · มีแค่ `userId` + `appRole`) · **event role เช็คจาก DB ทุก request** ไม่เชื่อ JWT/client
- **Resource เป็นคำนามพหูพจน์** · ของที่เป็นของงานอยู่ใต้ `/events/{eventId}/...` · ของที่ id ไม่ซ้ำทั้งระบบเข้าตรงได้ (`/projects/{projectId}`) — ซ้อนไม่เกิน 1 ชั้น · sub-resource ที่มีชิ้นเดียว (`/hall` · `/rubric` · `/microphone` · `/me`) ไม่นับเป็นชั้น
- **ไม่มีคำกริยาใน URL** — เปลี่ยนสถานะด้วย `PATCH` (เช่น `PATCH /events/{id} {status}`) · การกระทำที่สร้างของใหม่เป็น `POST` ไปที่ collection (เช่น ประกาศผล = `POST /events/{id}/awards`) · ของที่มีได้ 1 ชิ้นต่อคนใช้ `PUT .../me` (idempotent)
- **JSON** · ช่องเป็น `camelCase` · id เป็น uuid · เวลาเป็น ISO 8601 UTC · อัปโหลดไฟล์เป็น `multipart/form-data` ผ่าน API (server ตรวจ MIME จาก magic bytes ก่อนเก็บ MinIO)
- **List**: `?limit=20&cursor=...` → `{ "data": [...], "nextCursor": "..." | null }`
- **แก้พร้อมกัน**: resource ที่แก้ได้หลายแท็บ (บูธ · ใบคะแนน) ส่ง `ETag` · client ส่ง `If-Match` · ไม่ตรง → `412`
- **Rate limit**: ตอบ `429` + `Retry-After` (คำเชิญต่อวันต่องาน · AI · report)

**ผู้เรียก** (คอลัมน์ "ใคร" ในตาราง): `Public` ไม่ต้อง login · `User` login แล้ว · `Attendee` กรอกฟอร์มเข้างานแล้ว · `Presenter*` Presenter ของผลงานนั้น · `Judge*` Judge ที่ได้รับมอบหมายผลงานนั้น · `Admin` Admin ของงาน · `Platform` Platform Admin · สิทธิ์ = union ของทุก role

## Error

ทุก error ใช้ [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) · `Content-Type: application/problem+json` · client แสดงผลจาก `code` ไม่ใช่จากข้อความ

```json
{
  "type": "/errors/hall-full",
  "title": "Hall is full",
  "status": 409,
  "code": "HALL_FULL",
  "detail": "50 of 50 people are in the hall. Try again in a minute.",
  "errors": [{ "field": "endsAt", "message": "must be after startsAt" }]
}
```

| Status | ใช้เมื่อ | ตัวอย่าง `code` |
|---|---|---|
| 200 / 201 / 204 | สำเร็จ · สร้างแล้ว (มี `Location`) · ไม่มี body | — |
| 202 | รับงานไปทำต่อ (ส่งอีเมล · แปลงไฟล์) | — |
| 400 | body/query ผิดรูปแบบ (validation) | `VALIDATION_FAILED` |
| 401 | ไม่มี/หมดอายุ JWT | `UNAUTHENTICATED` |
| 402 | เกิน limit ของ plan | `PLAN_LIMIT` (capacity · กรรมการคนที่ 6 · AI ในงาน Free) · ตั้งใจใช้ 402 แยกจาก 403: แก้ได้ด้วยการอัปเกรด ไม่ใช่ไม่มีสิทธิ์ |
| 403 | login แล้วแต่ไม่มีสิทธิ์ | `FORBIDDEN_ROLE` · `BANNED` · `DOMAIN_NOT_ALLOWED` · `NOT_ASSIGNED` · `MODULE_DISABLED` |
| 404 | ไม่พบ หรือมีอยู่แต่ผู้เรียกไม่ควรรู้ว่ามี (งาน Draft) | `NOT_FOUND` |
| 409 | ขัดกับสถานะปัจจุบัน | `HALL_FULL` · `INVALID_STATUS_TRANSITION` · `LAST_ADMIN` · `RUBRIC_LOCKED` · `JUDGING_CLOSED` · `ALREADY_EXISTS` · `HALL_NO_SLOT` · `SUBMISSIONS_CLOSED` · `JOIN_FORM_REQUIRED` |
| 410 | token ใช้ไม่ได้แล้ว | `INVITE_EXPIRED` · `INVITE_REVOKED` · `INVITE_USED` |
| 412 | `If-Match` ไม่ตรง (มีคนแก้ก่อน) | `STALE_VERSION` |
| 413 / 415 | ไฟล์ใหญ่เกิน · ชนิดไฟล์จริงไม่ตรง | `FILE_TOO_LARGE` · `UNSUPPORTED_FILE` |
| 422 | รูปแบบถูกแต่ผิดกติกา | `CONFIRMATION_MISMATCH` · `SHEET_INCOMPLETE` · `CANNOT_UNMUTE_OTHERS` |
| 429 | ถี่เกิน | `RATE_LIMITED` |
| 500 / 503 | server พัง · บริการภายนอกล่ม (LiveKit · LLM · SMTP) | `INTERNAL` · `UPSTREAM_UNAVAILABLE` |

---

## Endpoint

### 1. ฉัน (บัญชี)

| Method | Path | ใคร | ทำอะไร · ผลลัพธ์ |
|---|---|---|---|
| GET | `/me` | User | profile + `onboarded` · `needsOnboarding=true` → client พาไปหน้า onboarding |
| PATCH | `/me` | User | แก้ profile / ทำ onboarding (ช่องบังคับครบ → ตั้ง `onboardedAt`) · `400` |
| DELETE | `/me` | User | ลบบัญชี · `409 LAST_ADMIN` + รายชื่องานที่ยังเป็น Admin คนเดียว · `204` |
| GET | `/me/events` | User | หน้า Home: งานของฉันพร้อม role (`?role=ADMIN\|PRESENTER\|JUDGE\|VISITOR`) |
| GET | `/me/invites` | User | คำเชิญที่ยังไม่รับของอีเมลฉัน |
| GET | `/me/notifications` | User | `?unread=true` |
| PATCH | `/me/notifications/{id}` | User | `{read:true}` |
| GET | `/me/subscription` | User | plan ปัจจุบัน (Billing C) |

### 2. งาน

| Method | Path | ใคร | ทำอะไร · ผลลัพธ์ |
|---|---|---|---|
| GET | `/events` | Public | Explore: งานที่ Published ขึ้นไป · `?q=&status=&slug=` · ป้าย `access` (`OPEN` / `DOMAIN`) |
| POST | `/events` | User | สร้างงาน (Draft) + ฮอลล์จาก preset · คนสร้างเป็น Admin · `201` · `402 PLAN_LIMIT` (capacity) · `400` (`endsAt ≤ startsAt`) |
| GET | `/events/{eventId}` | Public / Admin | Draft เห็นแค่ Admin (คนอื่น `404`) · มี `myRoles` · `interested` · `canJoin` + เหตุผล |
| PATCH | `/events/{eventId}` | Admin | แก้ข้อมูล · modules · `endsAt` (ขยายเวลา) · **`status`** (`PUBLISHED` เผยแพร่ + ส่งคำเชิญ · `LIVE` เปิดฮอลล์ · `EXHIBITION` จบงาน = ปิด judging + vote · `ARCHIVED`) · `409 INVALID_STATUS_TRANSITION` |
| DELETE | `/events/{eventId}?confirm={title}` | Admin | ลบงานทั้งหมด · ชื่อไม่ตรง `422 CONFIRMATION_MISMATCH` · `204` |
| PUT | `/events/{eventId}/cover` | Admin | multipart รูป · `413` · `415` |
| GET · POST | `/events/{eventId}/categories` | Public · Admin | หมวด = โซน · ซ้ำ `409 ALREADY_EXISTS` |
| PATCH · DELETE | `/events/{eventId}/categories/{categoryId}` | Admin | ลบหมวดที่มีผลงาน `409` |
| POST | `/events/{eventId}/copies` | Admin | Duplicate งาน (C) · `201` |
| GET | `/events/{eventId}/calendar.ics` | Public | ไฟล์ปฏิทิน |

### 3. คน · role · คำเชิญ

| Method | Path | ใคร | ทำอะไร · ผลลัพธ์ |
|---|---|---|---|
| GET | `/events/{eventId}/members` | Admin | ทุกคนที่มี role + ที่จอง `reserved / capacity` |
| PUT | `/events/{eventId}/members/{userId}` | Admin | ตั้ง `roles[]` ให้คนที่อยู่ในงานแล้ว · push `roleChanged` ทาง realtime · ถอด ADMIN คนสุดท้าย `409 LAST_ADMIN` · Judge เกิน 5 (Free) `402` |
| DELETE | `/events/{eventId}/members/{userId}` | Admin / ตัวเอง | ถอดทุก role / ออกจากงาน · `409 LAST_ADMIN` |
| GET | `/events/{eventId}/invites` | Admin | `?status=` · ก่อนรับเห็นแค่ `PENDING` (ไม่บอกว่าอีเมลมีบัญชีไหม) |
| POST | `/events/{eventId}/invites` | Admin | `{emails[], roles[], projectId?}` · อีเมลเดิมที่ PENDING → ใบเก่า `REVOKED` (= resend) · `202` · `402`/`409` เกินที่ · `429` |
| PATCH | `/events/{eventId}/invites/{inviteId}` | Admin | `{status:"REVOKED"}` |
| POST | `/projects/{projectId}/invites` | Presenter* | เชิญเพื่อนร่วมทีมเข้าบูธตัวเอง (role `PRESENTER` ของผลงานนี้เท่านั้น) · บูธอื่น `403` |
| GET | `/invites/{token}` | User | งาน · role · อีเมลที่ถูกเชิญแบบปิดบางส่วน · `matchesAccount` · `410` |
| POST | `/invites/{token}/acceptances` | User | รับคำเชิญ (บัญชีอื่นได้ → บันทึก `user_emails`) · `201` · `410 INVITE_USED/EXPIRED/REVOKED` |
| GET | `/events/{eventId}/bans` | Admin | |
| PUT | `/events/{eventId}/bans/{userId}` | Admin | `{reason}` · ตัด session + เตะออกจากฮอลล์ทันที · ลง audit |
| DELETE | `/events/{eventId}/bans/{userId}` | Admin | ยกเลิก ban |
| GET | `/events/{eventId}/audit-logs` | Admin | |

### 4. ฮอลล์ · ผลงาน · ไฟล์

| Method | Path | ใคร | ทำอะไร · ผลลัพธ์ |
|---|---|---|---|
| GET | `/events/{eventId}/hall` | Attendee / Admin | `mapJson` + `boothSlots` + ผลงานที่วางแต่ละช่อง |
| PATCH | `/events/{eventId}/hall` | Admin | `{preset}` เปลี่ยน preset (ก่อน LIVE) · ไม่พอวาง `409 HALL_NO_SLOT` |
| PUT | `/events/{eventId}/hall/placements` | Admin | สลับตำแหน่งบูธ `[{projectId, boothSlotId}]` ทั้งชุดใน transaction · หลังเปิดฮอลล์ `409` |
| GET | `/events/{eventId}/projects` | Public | `?q=&categoryId=&cursor=` · ค้นชื่อ / สมาชิก / tag (full-text) · ไม่มีสถานะ Live (มาจาก realtime) |
| POST | `/events/{eventId}/projects` | Admin · User (เมื่อ `submissionsOpen`) | `{title, categoryId?, memberEmails[], summary?}` · User ส่งตอนปิดรับ `409 SUBMISSIONS_CLOSED` · วางช่องอัตโนมัติ + เชิญสมาชิก · ระหว่างงานวางในโซนตัวเองและ push `boothAdded` · `409 HALL_NO_SLOT` |
| POST | `/events/{eventId}/project-imports` | Admin | multipart CSV/XLSX หรือ `{text}` (AI · Pro) · `?dryRun=true` คืนตารางตรวจ `200` · ยืนยัน `201` · `402` |
| GET | `/projects/{projectId}` | Public | ข้อมูลบูธ + ไฟล์ (signed URL หมดอายุ) |
| PATCH | `/projects/{projectId}` | Presenter* · Admin | แก้บูธ (ระหว่างงานได้ · broadcast + audit) · `If-Match` → `412` |
| DELETE | `/projects/{projectId}` | Admin | |
| GET | `/projects/{projectId}/members` | Public | ชื่อ · avatar · องค์กร |
| DELETE | `/projects/{projectId}/members/{userId}` | Presenter* · Admin | |
| POST | `/projects/{projectId}/files` | Presenter* | multipart `{kind, file, useForAi}` · PDF โปสเตอร์ → แปลงเป็นรูป `202` · `413` · `415` |
| PATCH · DELETE | `/projects/{projectId}/files/{fileId}` | Presenter* | `{useForAi}` · ลบไฟล์ → ลบ chunk ของ AI |

### 5. เข้างาน

| Method | Path | ใคร | ทำอะไร · ผลลัพธ์ |
|---|---|---|---|
| PUT · DELETE | `/events/{eventId}/interest` | User | กด / ยกเลิก Interested · `204` · ใช้ได้ตอน Published |
| GET | `/events/{eventId}/forms/{kind}` | User | `kind` = `join` · `survey` |
| PUT | `/events/{eventId}/forms/{kind}` | Admin | แก้คำถาม · ทุกคำถามต้องมี `purpose` (PDPA) |
| POST | `/events/{eventId}/attendances` | User | ฟอร์มเข้างาน `{displayName, visitorType, consentMarketing, answers}` · snapshot ประเภท + จังหวัด · `201` · `403 DOMAIN_NOT_ALLOWED` (Visitor) · `403 BANNED` · ซ้ำ `409` |
| POST | `/events/{eventId}/hall-tickets` | Attendee | ขอเข้าฮอลล์ → `{realtimeUrl, ticket, mediaUrl, mediaToken}` · ผ่านด่านเข้าฮอลล์ที่นี่ที่เดียว · `409 JOIN_FORM_REQUIRED` · `409 HALL_FULL` + `Retry-After` (Visitor เท่านั้น) · `403 BANNED` · งานยังไม่ LIVE/EXHIBITION `409` |
| POST | `/events/{eventId}/forms/survey/responses` | Attendee | ตอบ survey ครั้งเดียว · ซ้ำ `409` |

### 6. ในฮอลล์

| Method | Path | ใคร | ทำอะไร · ผลลัพธ์ |
|---|---|---|---|
| PUT | `/events/{eventId}/hall/participants/{userId}/microphone` | Presenter* (ในบูธตัวเอง) · Admin | `{muted:true}` → LiveKit `mutePublishedTrack` · `{muted:false}` `422 CANNOT_UNMUTE_OTHERS` · คนนอกบูธตัวเอง `403` |
| DELETE | `/events/{eventId}/hall/participants/{userId}` | Admin | kick (กลับเข้าได้) |
| PATCH | `/events/{eventId}/hall/settings` | Admin | สวิตช์ฉุกเฉิน `{entryPaused, muteAll}` |
| POST | `/events/{eventId}/announcements` | Admin | ประกาศทั้งฮอลล์ผ่าน realtime: แถบบนจอทุกคน + อยู่ในประวัติแชท Everyone ช่วงงาน (memory · ไม่เก็บ DB) · `202` |
| POST | `/events/{eventId}/reports` | Attendee | `{targetUserId, targetKind, targetRef?, snapshot?, reason}` · `429` |
| GET · PATCH | `/events/{eventId}/reports` · `/reports/{reportId}` | Admin | queue · `{status}` |
| POST | `/projects/{projectId}/feedbacks` | Attendee | `{text, isAnonymous}` · Live/Exhibition เท่านั้น `409` · module ปิด `403 MODULE_DISABLED` |
| GET | `/projects/{projectId}/feedbacks` | Presenter* · Admin | anonymous → Presenter ไม่เห็นชื่อ · Admin เห็น |
| PATCH | `/feedbacks/{feedbackId}` | Presenter* · Admin | `{status:"HIDDEN"}` (Presenter) · `{status:"REMOVED"}` (Admin) |
| PUT · DELETE | `/projects/{projectId}/votes/me` | Attendee | โหวต / ถอน · `204` · งานจบ `409` |
| PUT · DELETE | `/projects/{projectId}/contact-requests/me` | Attendee | `{email, phone?, link?, message?}` · ถอน = ลบจริง |
| GET | `/projects/{projectId}/contact-requests` | Presenter* | `Accept: text/csv` = export · บูธอื่น `403` |
| POST | `/projects/{projectId}/ai-answers` | Attendee | `{question}` → `{answer, sources[]}` · AI ปิด `403 MODULE_DISABLED` · Free `402` · `429` · LLM ล่ม `503` |

### 7. Judging

| Method | Path | ใคร | ทำอะไร · ผลลัพธ์ |
|---|---|---|---|
| GET | `/events/{eventId}/rubric` | Admin · Judge | |
| PUT | `/events/{eventId}/rubric` | Admin | `{criteria:[{name, description, maxScore, weight}]}` · หลังมีคะแนนแก้ได้แค่ `description` → `409 RUBRIC_LOCKED` |
| GET · PUT | `/events/{eventId}/judge-assignments` | Admin | แทนทั้งชุด · ว่าง = กรรมการทุกคนตัดสินทุกผลงาน |
| GET | `/events/{eventId}/score-sheets?judge=me` | Judge | รายการผลงานที่ได้รับมอบหมาย + สถานะ (ยังไม่ให้ · draft · ส่งแล้ว) |
| GET · PUT | `/projects/{projectId}/score-sheets/me` | Judge* | autosave draft `{scores:[{criterionId, score}], comment}` · `ETag`/`If-Match` (2 แท็บ) · `403 NOT_ASSIGNED` · งานจบ `409 JUDGING_CLOSED` · เกิน `maxScore` `400` |
| PATCH | `/projects/{projectId}/score-sheets/me` | Judge* | `{status:"SUBMITTED"}` · ไม่ครบ `422 SHEET_INCOMPLETE` |
| PATCH | `/score-sheets/{sheetId}` | Admin | `{commentVisible:false}` ซ่อน comment ก่อนส่งถึงผู้นำเสนอ |
| GET | `/events/{eventId}/judging-progress` | Admin | กรรมการคนไหนยังไม่ครบ · ผลงานที่คะแนนไม่ครบ |
| POST | `/events/{eventId}/judging-reminders` | Admin | เตือนกรรมการที่ยังไม่ครบ · `202` |
| GET | `/events/{eventId}/results` | Admin | รวมถ่วงน้ำหนัก · รายเกณฑ์ · รายกรรมการ · Audience award · `Accept: text/csv` |
| POST | `/events/{eventId}/awards` | Admin | ประกาศผล `{judgesTop:3, audienceTop:3}` → สร้าง `awards` + แจ้งผู้นำเสนอ · งานยังไม่จบ `409` |
| GET | `/events/{eventId}/awards` | Public | ผู้ชนะ (หลังประกาศ) |

### 8. หลังงาน · Analytics

| Method | Path | ใคร | ทำอะไร · ผลลัพธ์ |
|---|---|---|---|
| GET | `/events/{eventId}/analytics/summary` | Admin | Interested → มาจริง (%) · มาโดยไม่กด Interested · peak · เวลาเฉลี่ย · `Accept: application/pdf` = รายงานสรุปทั้งงาน |
| GET | `/events/{eventId}/analytics/attendance` | Admin | `?interval=5m` กราฟคน online |
| GET | `/events/{eventId}/analytics/booths` | Admin | ต่อบูธ: แวะ · เวลาเฉลี่ย · เดินผ่านไม่แวะ · ดูจอแชร์ · feedback · โหวต · คะแนน |
| GET | `/events/{eventId}/analytics/heatmap` | Admin | `[{cellX, cellY, samples}]` |
| GET | `/events/{eventId}/analytics/audience` | Admin | ประเภทผู้ชม · จังหวัด · ผล survey |
| GET | `/projects/{projectId}/summary` | Presenter* | สรุปของผู้นำเสนอ: สถิติ · feedback · ติดต่อกลับ · คะแนน + comment (หลังประกาศ ไม่งั้นไม่มีช่องคะแนน) |
| GET | `/projects/{projectId}/feedback-summary` | Presenter* | AI สรุป feedback (Pro) |

- export: ทุก endpoint ใน `/analytics/*` รองรับ `Accept: text/csv` · `summary` รองรับ `application/pdf` ด้วย

### 9. Billing · Platform (Could)

| Method | Path | ใคร | ทำอะไร |
|---|---|---|---|
| POST | `/billing/checkout-sessions` | User | `{plan:"PRO"}` หรือ `{eventId, addon}` → URL ของ Stripe (test mode) |
| POST | `/billing/webhooks` | Stripe | ตรวจ signature · อัปเดต `subscriptions` / `event_addons` |
| GET | `/platform/events` | Platform | ทุกงาน |
| PATCH | `/platform/events/{eventId}` | Platform | `{suspended:true}` · ลง audit ที่ Admin ของงานเห็น |
| GET | `/platform/health` | Platform | concurrent · LiveKit/TURN · storage |

---

## Realtime (Colyseus) — 1 room ต่อ 1 ฮอลล์

- **ticket** = JWT อายุ 60 วินาที ที่ API ออกหลังผ่านด่านเข้าฮอลล์ (สถานะงาน · ฟอร์มเข้างาน · ban · ฮอลล์เต็ม) · claim: `sub` (userId) · `eventId` · `jti` · `exp` · เซ็นด้วยกุญแจของ API (ไม่ใช่ JWT ของ Better Auth)
- `onAuth` ของ Colyseus: ตรวจลายเซ็น + `exp` · `eventId` ตรงกับ room · `jti` ใช้ได้ครั้งเดียว (จำไว้จนหมดอายุ) · โหลด role จาก DB · ไม่ตรวจด่านเข้าฮอลล์ซ้ำ
- ทุก message ตรวจ role อีกรอบ (ทางที่ 2 จาก 3) · หลุดแล้วต่อใหม่ = ขอ ticket ใหม่
- state ที่ sync: `players` (ชื่อ · ตำแหน่ง · badge จาก server) · `booths` (ผลงาน · ช่อง · `live` · จำนวนคน)

| ทิศทาง | message | ใคร | หมายเหตุ |
|---|---|---|---|
| C → S | `move {x, y, dir}` | ทุกคน | server ตรวจความเร็ว/การชน (กัน teleport) |
| C → S | `goToBooth {projectId}` | ทุกคน | server เป็นคนย้ายตำแหน่ง |
| C → S | `chat:nearby {text}` · `chat:all {text}` | ทุกคน | ไม่เก็บ DB · rate limit |
| C → S | `poster:view {fileId, page, zoom, x, y}` | Presenter* ในบูธตัวเอง | ส่งต่อเฉพาะคนในบูธ · คนอื่นส่ง → ทิ้ง + log |
| C → S | `model:camera {orbit, target, fov}` | Presenter* | 3D viewer (C) |
| C → S | `react {emoji}` | ทุกคน | C · ~3/วินาที |
| S → C | `boothAdded` · `boothUpdated` | — | หลัง REST เขียน DB แล้ว |
| S → C | `roleChanged {roles}` | — | UI อัปเดตทันที · ถอด Presenter → ตัดจอแชร์ |
| S → C | `announcement {text}` · `kicked {reason}` · `banned` | — | |

## Media (LiveKit) — 1 room ต่อ 1 ฮอลล์

- `mediaToken` ออกโดย API (ทางที่ 3): ทุกคน publish ไมค์ได้ · `screen_share` + `camera` เฉพาะ PRESENTER · สิทธิ์ "เฉพาะในบูธตัวเอง" บังคับด้วย `UpdateParticipant` ตอนเดินเข้า/ออกบูธ
- ได้ยินใคร: นอกบูธ subscribe ตามระยะ (5 ช่อง · ตัด 7) · ในบูธ subscribe ทุกคนในบูธเดียวกันเท่านั้น · mute คนอื่นทำผ่าน REST `.../microphone` → `mutePublishedTrack` · ถอด role → ออก token ใหม่ / ตัด track ทันที
- รายละเอียดอยู่ใน `technical.md` → Media ในฮอลล์
