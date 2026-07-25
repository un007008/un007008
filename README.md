# PropOS — แพลตฟอร์มบริหารธุรกิจอสังหาฯ (Bangkok Prime Property)

All-in-One สำหรับนายหน้าอสังหาฯ: **Inbox LINE + AI ตอบอัตโนมัติ · เว็บประกาศทรัพย์ 3 ภาษา · CRM · รายงาน+แจ้งเตือน**
สเปกเต็มอยู่ใน [SPEC.md](./SPEC.md) — สถานะ: ครบทั้ง 4 Phase

## เริ่มพัฒนาในเครื่อง

ต้องมี Node.js 20+, Docker Desktop

```bash
npm install
cp .env.example .env        # แก้ NEXTAUTH_SECRET (openssl rand -base64 32)
docker compose up -d        # Postgres local
npx prisma migrate dev      # สร้างตาราง
npx prisma db seed          # ข้อมูลตัวอย่าง
npm run dev                 # http://localhost:3000
```

- เว็บ public: http://localhost:3000 (เด้งไป `/th`)
- Admin: http://localhost:3000/admin — login `admin@bpp.local` / `admin1234` *(dev เท่านั้น)*
- ดูข้อมูล: `npx prisma studio` → http://localhost:5555

## Environment variables

| ตัวแปร | จำเป็น | ใช้ทำอะไร |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `NEXTAUTH_URL` | ✅ | URL ของเว็บ (prod = โดเมนจริง) |
| `NEXTAUTH_SECRET` | ✅ | สุ่มด้วย `openssl rand -base64 32` |
| `GEMINI_API_KEY` *หรือ* `ANTHROPIC_API_KEY` | AI | AI ตอบแชท / แปลภาษา / สรุปรายคืน — ตั้ง Gemini (ฟรี, aistudio.google.com) หรือ Claude อย่างใดอย่างหนึ่ง ถ้าตั้งทั้งคู่ใช้ Gemini (ไม่มี = escalate ให้คนตอบ) ⚠ Gemini free tier อาจนำข้อมูลไปเทรน — ระวัง PDPA กับแชทลูกค้าจริง |
| `LINE_CHANNEL_ACCESS_TOKEN` `LINE_CHANNEL_SECRET` | LINE | LINE OA webhook + ส่งข้อความ |
| `LINE_STAFF_GROUP_ID` | — | กลุ่ม LINE ทีมงาน รับแจ้งเตือนอัตโนมัติ |
| `R2_ACCOUNT_ID` `R2_ACCESS_KEY_ID` `R2_SECRET_ACCESS_KEY` `R2_BUCKET_NAME` `R2_PUBLIC_URL` | — | เก็บรูป/เอกสารบน Cloudflare R2 (ไม่ตั้ง = เก็บในเครื่องที่ `public/uploads`) |
| `NEXT_PUBLIC_LINE_OA_URL` `NEXT_PUBLIC_CONTACT_PHONE` | — | ปุ่มแชท LINE / โทร บนเว็บ public |

## Deploy ขึ้น Railway

1. สร้างโปรเจกต์ Railway → เพิ่ม **PostgreSQL** plugin
2. เพิ่ม service จาก GitHub repo นี้ (มี `railway.json` แล้ว: build `npm run build`, start `npm run railway:start` ซึ่ง migrate ให้อัตโนมัติ)
3. ตั้ง env ทั้งหมดตามตารางด้านบน (`DATABASE_URL` ใช้ `${{Postgres.DATABASE_URL}}`)
4. ตั้ง custom domain แล้วอัปเดต `NEXTAUTH_URL`
5. seed ครั้งแรก: `railway run npx prisma db seed`
6. LINE Developers Console → ตั้ง webhook เป็น `https://<โดเมน>/api/webhook/line`

### ก่อนเปิดใช้จริง (สำคัญ)

- [ ] รัน `railway run npm run preflight` — เช็ค env ครบ/ถูกต้องอัตโนมัติ
- [ ] เปลี่ยนรหัสผ่าน admin จาก seed ทันที (เปลี่ยนแล้ว session เก่าหลุดอัตโนมัติ)
- [ ] ตั้ง R2 — ถ้าเก็บไฟล์ในเครื่อง ไฟล์จะหายเมื่อ redeploy (หรือ mount Railway volume ที่ `public/uploads`)
- [ ] ทดสอบ LINE webhook ด้วยการทักจริง 1 ข้อความ

## โครงสร้างโค้ด

ดู [CLAUDE.md](./CLAUDE.md) — สรุป: `src/app/(public)` เว็บลูกค้า · `src/app/admin` หลังบ้าน · `src/app/api` REST + webhook · `src/lib` core (db, ai, line, media, automation)

## ฟีเจอร์หลักและวิธีทดสอบ

| ฟีเจอร์ | ทดสอบที่ |
|---|---|
| Inbox LINE + AI ตอบ | ทัก LINE OA → `/admin/inbox` (realtime SSE) |
| แปลงแชทเป็น Lead | ปุ่ม ⭐ ในแผงขวาของ inbox |
| Knowledge base ของ AI | `/admin/knowledge` |
| จัดการทรัพย์ + รูป | `/admin/properties` (ADMIN) |
| หน้าแรกเว็บ (section builder) | `/admin/settings/homepage` (ADMIN) |
| คลังสื่อ / บทความ | `/admin/media` · `/admin/blog` (ADMIN) |
| เว็บ public 3 ภาษา | `/th` `/en` `/zh` + `/th/properties` ค้นหา |
| ฟอร์มนัดชม → Lead | หน้าเว็บทรัพย์ → ปุ่มนัดชม → เช็ค `/admin/leads` |
| CRM kanban | `/admin/crm` ลากการ์ด |
| นัดชม + ปฏิทิน | หน้า Lead → + นัดชม → `/admin/calendar` |
| Deal + สัญญา | หน้า Lead → + สร้าง Deal → อัปโหลดเอกสาร |
| แดชบอร์ด + CSV | `/admin` |
| แจ้งเตือนอัตโนมัติ | รันเองทุก 03:00 หรือ `POST /api/admin/automation/run` |

## โมดูลบัญชีภายใน (สไตล์ PEAK) — ADMIN เท่านั้น

ระบบรายรับ-รายจ่ายครบวงจรที่ `/admin/accounting` (เมนู "บัญชี"):

| ฟีเจอร์ | ทดสอบที่ |
|---|---|
| ตั้งค่าข้อมูลกิจการ (ขึ้นหัวเอกสาร) | `/admin/accounting/settings` |
| ผู้ติดต่อ (ลูกค้า/ผู้ขาย) + รายการเดินบัญชี | `/admin/accounting/contacts` → ปุ่ม "รายการเดินบัญชี" |
| เอกสาร 6 ประเภท: ใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ ค่าใช้จ่าย ใบลดหนี้ ใบเพิ่มหนี้ | `/admin/accounting/documents` → + สร้างเอกสาร |
| เลขรันอัตโนมัติต่อประเภทต่อเดือน (`INV-202607-0001`) | สร้างเอกสาร 2 ใบติดกัน ดูเลขรัน |
| VAT 7% + หัก ณ ที่จ่าย 1/2/3/5% คำนวณอัตโนมัติ | ฟอร์มสร้างเอกสาร (ยอดเปลี่ยนสด) |
| วงจรสถานะ ร่าง → ออกเอกสาร → ชำระ/ตอบรับ → ยกเลิก | ปุ่มบนหน้าเอกสาร |
| จ่ายใบแจ้งหนี้แล้วออกใบเสร็จผูกกันอัตโนมัติ | ปุ่ม "บันทึกการชำระ" + ติ๊กออกใบเสร็จ |
| ใบเสนอราคา → ตอบรับ → แปลงเป็นใบแจ้งหนี้ | ปุ่มบนใบเสนอราคา |
| ใบลดหนี้/เพิ่มหนี้จากใบแจ้งหนี้ (หักรายรับ/ภาษีถูกเครื่องหมาย) | ปุ่มบนใบแจ้งหนี้ที่ออกแล้ว |
| สร้างใบแจ้งหนี้จาก Deal ใน CRM | หน้า Lead ที่มี Deal → ลิงก์ 🧾 |
| หนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ อย่างย่อ) | เอกสารค่าใช้จ่ายที่จ่ายแล้ว + มีหัก ณ ที่จ่าย |
| ไฟล์แนบ (สลิป/ใบกำกับภาษี) | ท้ายหน้าเอกสาร → + แนบไฟล์ |
| พิมพ์/PDF ทุกเอกสาร | ปุ่ม "พิมพ์ / PDF" |
| ลูกหนี้-เจ้าหนี้ aging (1-30/31-60/60+ วัน) | `/admin/accounting/receivables` · `/admin/accounting/payables` |
| รายงานภาษีรายเดือน (ภ.พ.30) + CSV | `/admin/accounting/tax` |
| งบกำไรขาดทุนรายปี (เกณฑ์เงินสด) | `/admin/accounting/pnl` |
| Export เอกสารทั้งหมดเป็น CSV | ปุ่มบน `/admin/accounting/documents` |
| แจ้งเตือนใบแจ้งหนี้เกินกำหนดเข้ากลุ่ม LINE | job อัตโนมัติทุก 03:00 (ต้องตั้ง `LINE_STAFF_GROUP_ID`) |

ทดสอบอัตโนมัติทั้งโมดูล: `npm run smoke` (มี section "accounting" ครอบคลุม flow ครบวงจร)
