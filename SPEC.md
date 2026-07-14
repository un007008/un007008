# SPEC.md — แพลตฟอร์มบริหารธุรกิจอสังหาฯ (ชื่อชั่วคราว: "PropOS")

> เอกสารสเปกสำหรับพัฒนาโดย Claude Code
> Pilot customer: Bangkok Prime Property (BPP)
> ผู้พัฒนา: ทีม 1 คน + Claude Code | Deploy: Railway (per-instance ต่อลูกค้า)
> ภาษาเอกสาร: ไทย | ภาษาโค้ด/comment: อังกฤษ

---

## 1. ภาพรวมและเป้าหมาย

แพลตฟอร์ม All-in-One สำหรับนายหน้า/บริษัทอสังหาฯ ประกอบด้วย 4 โมดูล:

1. **Omnichannel Inbox** — รวมแชท (เริ่มจาก LINE) + AI ตอบอัตโนมัติจาก knowledge base + แปลงแชทเป็น Lead
2. **Website CMS** — เว็บประกาศทรัพย์ 3 ภาษา (TH/EN/ZH), หน้าแรกแบบ section builder, ค้นหาทรัพย์, SEO
3. **Sales CRM** — Lead pipeline แบบ kanban, นัดชม, Deal, สัญญา/เอกสาร
4. **Reports & Automation** — Dashboard, แจ้งเตือนอัตโนมัติ

**จุดต่าง (differentiator):** AI ตอบลูกค้าอัตโนมัติใน inbox — ไม่ใช่แค่รวมแชทให้คนตอบ
**ฐานที่มีอยู่แล้ว:** โปรเจกต์ `line-ai-bot` (Node.js + LINE Messaging API + Claude API + SQLite) ที่ใช้งานได้แล้ว — Phase 1 คือการต่อยอดจากตัวนี้ ไม่ใช่เขียนใหม่

**หลักการพัฒนา:**
- ส่งมอบทีละ phase ให้ BPP ใช้จริงก่อนเริ่ม phase ถัดไป
- Mobile-first ทุกหน้า (ทีมขายใช้มือถือเป็นหลัก)
- ทุก text บน UI เป็นภาษาไทยก่อน (i18n admin UI ไว้ทีหลัง)

---

## 2. Tech Stack

| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| Framework | **Next.js 14+ (App Router), TypeScript** | เว็บ public (SEO/SSR) + admin ในโปรเจกต์เดียว |
| Database | **PostgreSQL + Prisma ORM** | JSONB สำหรับ section config, migrate จาก SQLite เดิม |
| Styling | **Tailwind CSS + shadcn/ui** | เร็ว สม่ำเสมอ |
| Drag & Drop | **dnd-kit** | kanban pipeline + จัดลำดับ section |
| Auth | **NextAuth (credentials + role)** | admin / sales / cr roles |
| File Storage | **Cloudflare R2** (S3-compatible) | ถูก, ไม่มีค่า egress |
| Image processing | **sharp** | แปลง WebP + thumbnail อัตโนมัติ |
| Realtime (inbox) | **Server-Sent Events (SSE)** ก่อน, Socket.io ถ้าจำเป็น | เรียบง่าย พอสำหรับ scale เริ่มต้น |
| AI | **Claude API** (ตอบแชท + แปลภาษา + สรุปบทสนทนา) | ใช้ pattern เดิมจาก line-ai-bot |
| LINE | **LINE Messaging API (webhook)** | มีโค้ดเดิมอยู่แล้ว |
| Maps | **Longdo Map หรือ Google Maps JS API** | ค้นหาทรัพย์บนแผนที่ (Phase 2) |
| Deploy | **Railway** (app + Postgres + volume) | คุ้นเคยอยู่แล้ว |
| Job scheduling | **node-cron** ใน process เดียว | nightly summary, แจ้งเตือนสัญญา |

**โครงสร้าง repo:** monorepo เดียว (Next.js app เดียว มีทั้ง public site + `/admin`) — webhook LINE เป็น API route ใน Next.js เลย ยุบ line-ai-bot เข้ามาเป็นโมดูล

```
propos/
├── prisma/schema.prisma
├── src/
│   ├── app/
│   │   ├── (public)/          # เว็บ public: หน้าแรก, ค้นหา, รายละเอียดทรัพย์, บทความ
│   │   ├── admin/             # admin: inbox, crm, cms, settings, dashboard
│   │   └── api/
│   │       ├── webhook/line/  # LINE webhook (ย้ายจาก line-ai-bot)
│   │       ├── inbox/         # SSE + ส่งข้อความ
│   │       └── ...
│   ├── components/
│   │   ├── sections/          # section registry ของหน้าแรก
│   │   └── ui/                # shadcn
│   ├── lib/
│   │   ├── ai/                # Claude API: ตอบแชท, แปล, สรุป
│   │   ├── line/              # LINE client
│   │   └── media/             # upload + sharp
│   └── ...
└── SPEC.md
```

---

## 3. Database Schema (Prisma — ตารางหลัก)

```prisma
// ===== Core =====
model User {            // ผู้ใช้ระบบ admin
  id        String @id @default(cuid())
  email     String @unique
  password  String        // hashed
  name      String
  role      Role          // ADMIN | SALES | CR
  createdAt DateTime @default(now())
}

// ===== Module 2: Website CMS =====
model Property {
  id           String   @id @default(cuid())
  refCode      String   @unique          // เช่น PS-00012
  status       PropertyStatus            // AVAILABLE | RESERVED | SOLD | RENTED | HIDDEN
  listingType  ListingType               // SALE | RENT | SALE_AND_RENT
  propertyType PropertyType              // CONDO | HOUSE | TOWNHOUSE | COMMERCIAL | LAND
  title        Json      // {th, en, zh}
  description  Json      // {th, en, zh} + ธง edited ต่อภาษา
  priceSale    Decimal?
  priceRent    Decimal?                  // ต่อเดือน
  bedrooms     Int?
  bathrooms    Int?
  areaSqm      Float?
  floor        Int?
  projectName  String?
  district     String?                   // เขต/ทำเล
  btsMrt       String?                   // สถานีใกล้เคียง
  lat          Float?
  lng          Float?
  images       PropertyImage[]
  featured     Boolean @default(false)
  slug         String  @unique           // สำหรับ SEO URL
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model PropertyImage {
  id         String @id @default(cuid())
  propertyId String
  url        String      // R2 URL (webp)
  thumbUrl   String
  order      Int
  property   Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
}

model MediaAsset {        // คลังสื่อกลาง
  id        String @id @default(cuid())
  url       String
  thumbUrl  String?
  mimeType  String
  sizeBytes Int
  createdAt DateTime @default(now())
}

model SiteConfig {        // config หน้าแรก + ตั้งค่าเว็บ (JSONB)
  id    String @id       // เช่น "homepage", "seo", "footer"
  data  Json             // sections array ตามสเปกข้อ 4.2
  updatedAt DateTime @updatedAt
}

model BlogPost {
  id        String @id @default(cuid())
  slug      String @unique
  title     Json           // {th, en, zh}
  content   Json           // {th, en, zh} markdown
  coverUrl  String?
  category  String?
  tags      String[]
  published Boolean @default(false)
  createdAt DateTime @default(now())
}

// ===== Module 1: Inbox =====
model Contact {           // ลูกค้า (คนคุย/lead/ผู้ซื้อ)
  id          String @id @default(cuid())
  name        String?
  phone       String?
  email       String?
  lineUserId  String? @unique
  note        String?
  tags        String[]
  conversations Conversation[]
  leads       Lead[]
  createdAt   DateTime @default(now())
}

model Conversation {
  id         String @id @default(cuid())
  channel    Channel        // LINE (phase 1) | MESSENGER | WHATSAPP | WEBCHAT
  contactId  String
  status     ConvStatus     // AI_HANDLING | HUMAN_HANDLING | CLOSED
  assignedTo String?        // userId ทีมขาย/CR
  messages   Message[]
  contact    Contact @relation(fields: [contactId], references: [id])
  updatedAt  DateTime @updatedAt
}

model Message {
  id             String @id @default(cuid())
  conversationId String
  direction      Direction   // INBOUND | OUTBOUND
  sender         SenderType  // CUSTOMER | AI | STAFF
  content        String
  contentType    String @default("text")  // text | image | property_card
  metadata       Json?
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}

model KnowledgeEntry {     // knowledge base ของ AI (ย้ายจาก line-ai-bot)
  id       String @id @default(cuid())
  question String
  answer   String
  category String?
  active   Boolean @default(true)
}

// ===== Module 3: CRM =====
model Lead {
  id         String @id @default(cuid())
  contactId  String
  source     LeadSource     // CHAT | WEBSITE_FORM | MANUAL
  stage      LeadStage      // NEW | CONTACTED | QUALIFIED | VIEWING_SCHEDULED | VIEWED | OFFER | CLOSED_WON | CLOSED_LOST
  interest   ListingType?   // BUY | RENT
  budgetMin  Decimal?
  budgetMax  Decimal?
  propertyId String?        // ทรัพย์ที่สนใจ
  assignedTo String?
  note       String?
  appointments Appointment[]
  deal       Deal?
  contact    Contact @relation(fields: [contactId], references: [id])
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Appointment {         // นัดชม
  id         String @id @default(cuid())
  leadId     String
  propertyId String
  datetime   DateTime
  status     ApptStatus    // SCHEDULED | DONE | CANCELLED | NO_SHOW
  note       String?
  lead       Lead @relation(fields: [leadId], references: [id])
}

model Deal {
  id         String @id @default(cuid())
  leadId     String @unique
  propertyId String
  dealType   ListingType   // SALE | RENT
  amount     Decimal
  status     DealStatus    // DRAFT | CONTRACT_SENT | SIGNED | COMPLETED | CANCELLED
  contractStart DateTime?  // สำหรับเช่า
  contractEnd   DateTime?  // ใช้แจ้งเตือน "สัญญาใกล้หมด"
  documents  Document[]
  lead       Lead @relation(fields: [leadId], references: [id])
  createdAt  DateTime @default(now())
}

model Document {
  id      String @id @default(cuid())
  dealId  String
  name    String
  url     String       // R2
  deal    Deal @relation(fields: [dealId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}
```

---

## 4. สเปกรายโมดูล

### 4.1 Phase 1 — Omnichannel Inbox + Lead (ต่อยอด line-ai-bot)

**เป้าหมาย:** ทีม BPP เห็นแชท LINE ทั้งหมดใน web inbox, AI ตอบเองเมื่อมั่นใจ, staff เข้าแทรกได้, กดแปลงเป็น Lead ได้

**Features:**
1. **LINE webhook** (ย้าย logic จาก line-ai-bot): รับข้อความ → บันทึกลง DB → AI ตอบจาก KnowledgeEntry ถ้ามั่นใจ → ถ้าไม่มั่นใจตั้ง `status = HUMAN_HANDLING` + แจ้งเตือนใน inbox
2. **Inbox UI** (`/admin/inbox`):
   - รายการ conversation ซ้าย (filter: ทั้งหมด / ของฉัน / ยังไม่มอบหมาย / AI กำลังตอบ), หน้าต่างแชทกลาง, แผงข้อมูล contact ขวา
   - realtime ผ่าน SSE
   - staff พิมพ์ตอบ → ส่งออกทาง LINE Push API + บันทึก DB
   - ปุ่ม "AI takeover / ปิดเคส" (เทียบเท่า staff command เดิม)
   - ปุ่ม "ส่งทรัพย์" — เลือก Property แล้วส่งเป็น Flex Message การ์ดทรัพย์
3. **แปลงเป็น Lead:** ปุ่มบน conversation → สร้าง Lead ผูก Contact + กรอก interest/budget/ทรัพย์ที่สนใจ
4. **จัดการ Knowledge Base** (`/admin/knowledge`): CRUD คำถาม-คำตอบ
5. **Auth + Roles:** ADMIN เห็นทุกอย่าง, SALES/CR เห็น inbox + lead ที่มอบหมาย
6. **Migration:** สคริปต์ย้ายข้อมูล SQLite (conversations เดิม) → Postgres

**Acceptance criteria:**
- [ ] ลูกค้าทัก LINE OA → ข้อความขึ้น inbox ภายใน 2 วินาที
- [ ] AI ตอบคำถามที่อยู่ใน KB ได้เอง / escalate เมื่อไม่มั่นใจ
- [ ] Staff ตอบจาก web แล้วลูกค้าได้รับใน LINE
- [ ] แปลงแชทเป็น Lead แล้วเห็นใน list (`/admin/leads` แบบตารางง่าย ๆ ก่อน)

### 4.2 Phase 2 — Website CMS + Property Listings

**เป้าหมาย:** เว็บ public 3 ภาษา ค้นหาทรัพย์ได้ + admin จัดการทรัพย์และหน้าแรกเอง

**Features:**
1. **จัดการทรัพย์** (`/admin/properties`): CRUD + อัปโหลดหลายรูป (drag จัดลำดับ, sharp → WebP + thumb), ฟิลด์ครบตาม schema
2. **หน้าแรกแบบ section builder** (`/admin/settings/homepage`) — ตามที่วิเคราะห์จาก demo.agentoros.com:
   - sections: `hero, propertyTypes, popularLocations, featuredProperties, forSale, forRent, promotionBanner, featuredProjects, featuredArticles, cta, footer`
   - JSON config ต่อ section: `{ type, order, visible, template, content: {th, en: {…, edited}, zh: {…, edited}}, media? }`
   - แต่ละ section เลือก template ได้ (เริ่ม 1-2 template/section)
   - toggle แสดง/ซ่อน + ลากจัดลำดับ + ปุ่มบันทึก/รีเซ็ต + dirty-state ("ยังไม่ได้บันทึก")
   - **auto-translate:** blur ช่องไทย → เรียก Claude API แปล en/zh เฉพาะช่องที่ไม่มีธง `edited`
   - live preview: iframe หน้าจริง + postMessage
3. **เว็บ public:**
   - หน้าแรก render จาก SiteConfig ผ่าน section registry
   - `/properties` ค้นหา: ประเภท, ขาย/เช่า, ช่วงราคา, ทำเล, BTS/MRT + แผนที่ (Longdo/Google) แสดงหมุดราคา
   - `/properties/[slug]` รายละเอียด: แกลเลอรี, สเปก, แผนที่, ปุ่ม **นัดชม** (ฟอร์ม → สร้าง Lead source=WEBSITE_FORM) + ปุ่มแชท LINE (ลิงก์ OA) + โทร
   - i18n routing: `/th`, `/en`, `/zh` + hreflang + sitemap + meta จาก SiteConfig("seo")
4. **คลังสื่อ** (`/admin/media`) + **บทความ** (`/admin/blog`) แบบเรียบง่าย

**Acceptance criteria:**
- [ ] เพิ่มทรัพย์ใน admin → ขึ้นเว็บ public ทันที ครบ 3 ภาษา
- [ ] ค้นหา + filter + แผนที่ใช้งานได้บนมือถือ
- [ ] ฟอร์มนัดชมจากเว็บ → Lead ใหม่โผล่ใน admin + แจ้งเตือน
- [ ] แก้หน้าแรกจาก admin เห็นผลจริง, Lighthouse SEO ≥ 90

### 4.3 Phase 3 — CRM Pipeline

**Features:**
1. **Kanban** (`/admin/crm`): คอลัมน์ตาม LeadStage, ลากการ์ดเปลี่ยน stage (dnd-kit), การ์ดแสดง ชื่อ/เบอร์/ช่องทาง/ทรัพย์/tag ซื้อ-เช่า, filter + search, มือถือใช้ dropdown เปลี่ยน stage แทนลาก
2. **หน้า Lead detail:** timeline กิจกรรม (ข้อความ, เปลี่ยน stage, นัด), ลิงก์กลับ conversation, มอบหมายทีม
3. **นัดชม:** สร้างนัดผูก Lead+Property, ปฏิทินรวม (`/admin/calendar`), เปลี่ยนสถานะ
4. **Deal + เอกสาร:** สร้าง Deal จาก Lead, อัปโหลดสัญญา/เอกสารเข้า R2, วันเริ่ม-สิ้นสุดสัญญาเช่า

**Acceptance criteria:**
- [ ] flow ครบ: แชทเข้า → Lead → นัดชม → Deal → ปิด (won/lost)
- [ ] ทีมขายใช้บนมือถือได้ลื่น

### 4.4 Phase 4 — Reports & Automation

**Features:**
1. **Dashboard** (`/admin`): ยอดขาย/ค่าเช่ารวมเดือนนี้, Leads ใหม่, conversion ต่อ stage, กราฟ (recharts), ทรัพย์ยอดชมสูงสุด
2. **Automation (node-cron):**
   - สัญญาเช่าหมดอายุใน 7/30 วัน → แจ้งเตือน inbox + LINE Notify กลุ่ม staff
   - nightly summary บทสนทนา (PDPA-compliant: intent/sentiment แบบ structured — ใช้ดีไซน์เดิมจาก line-ai-bot)
   - Lead ไม่มีการอัปเดต > X วัน → เตือนผู้รับผิดชอบ
3. **Export:** รายงาน CSV (leads, deals)

---

## 5. สิ่งที่ต้องเตรียมนอกโค้ด (เจ้าของโปรเจกต์ทำเอง)

- [ ] LINE OA + Messaging API channel ของ BPP (มีแล้วจาก line-ai-bot — ใช้ตัวเดิม เปลี่ยน webhook URL)
- [ ] Cloudflare R2 bucket + API key
- [ ] Anthropic API key
- [ ] Railway: Postgres + volume + custom domain ของ BPP
- [ ] Longdo Map API key (ฟรี tier) หรือ Google Maps billing
- [ ] เนื้อหาจริงจาก BPP: รายการทรัพย์, รูป, KB คำถาม-คำตอบ, โลโก้/สี

---

## 6. คำสั่งเริ่มต้นสำหรับ Claude Code (ทีละขั้น)

> เปิด Claude Code ในโฟลเดอร์ว่าง วาง SPEC.md ไว้ที่ root แล้วสั่งตามลำดับ — จบแต่ละข้อให้ทดสอบก่อนไปข้อถัดไป

**ขั้น 0 — โครงโปรเจกต์:**
```
อ่าน SPEC.md ทั้งไฟล์ แล้วสร้างโปรเจกต์ Next.js 14 (App Router, TypeScript, Tailwind, shadcn/ui)
ตามโครงสร้าง repo ในข้อ 2 พร้อม Prisma schema ตามข้อ 3 ทั้งหมด
ตั้งค่า docker-compose สำหรับ Postgres local, สร้าง .env.example,
รัน prisma migrate และ seed ข้อมูลตัวอย่าง (user admin 1 คน, property 5 รายการ, knowledge 10 ข้อ)
ยังไม่ต้องทำ UI — ให้ npm run dev ขึ้น และ prisma studio เปิดดูข้อมูลได้
```

**ขั้น 1 — Phase 1 (แบ่งย่อย):**
```
1.1 ทำ NextAuth (credentials) + role guard สำหรับ /admin ตาม SPEC ข้อ 4.1
1.2 ย้าย LINE webhook logic เข้า /api/webhook/line: รับข้อความ → บันทึก Contact/Conversation/Message
    → AI ตอบจาก KnowledgeEntry ด้วย Claude API → escalate เมื่อไม่มั่นใจ (ผมจะให้โค้ด line-ai-bot เดิมเป็น reference)
1.3 สร้าง Inbox UI ตาม SPEC 4.1 ข้อ 2 พร้อม SSE realtime
1.4 ปุ่มแปลงเป็น Lead + หน้า /admin/leads แบบตาราง
1.5 หน้า /admin/knowledge CRUD
1.6 เขียนสคริปต์ migrate ข้อมูลจาก SQLite เดิม
```

**ขั้น 2-4:** สั่งตาม SPEC ข้อ 4.2 → 4.3 → 4.4 ทีละ feature ในลักษณะเดียวกัน

**กติกาที่ให้ Claude Code ยึดเสมอ (ใส่ใน CLAUDE.md ของโปรเจกต์):**
```
- อ่าน SPEC.md ก่อนเริ่มงานทุกครั้ง งานใดขัดกับ SPEC ให้ถามก่อน
- ทุก UI เป็นภาษาไทย, mobile-first
- ทุก feature ต้องมีวิธีทดสอบด้วยมือระบุไว้ (บอกว่าเปิด URL ไหน กดอะไร)
- ห้าม hardcode secret — ใช้ .env เท่านั้น
- commit เป็นระยะ ข้อความ commit ภาษาอังกฤษ
```

---

## 7. Timeline โดยประมาณ

| Phase | ระยะเวลา | ส่งมอบให้ BPP |
|---|---|---|
| 0 โครงโปรเจกต์ | 2-3 วัน | — |
| 1 Inbox + Lead | 2-4 สัปดาห์ | ใช้แทน line-ai-bot เดิมได้เลย |
| 2 CMS + Listings | 3-5 สัปดาห์ | เว็บ BPP ขึ้น production |
| 3 CRM Pipeline | 2-3 สัปดาห์ | ทีมขายใช้เต็มระบบ |
| 4 Reports/Automation | 1-2 สัปดาห์ | ครบตามภาพ marketing |

> **กฎเหล็ก:** จบ Phase 1 ต้องให้ทีม BPP ใช้จริงและเก็บ feedback ก่อนเริ่ม Phase 2 เสมอ
