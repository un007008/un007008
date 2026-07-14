# PropOS — กติกาสำหรับ Claude Code

- อ่าน SPEC.md ก่อนเริ่มงานทุกครั้ง งานใดขัดกับ SPEC ให้ถามก่อน
- ทุก UI เป็นภาษาไทย, mobile-first
- ทุก feature ต้องมีวิธีทดสอบด้วยมือระบุไว้ (บอกว่าเปิด URL ไหน กดอะไร)
- ห้าม hardcode secret — ใช้ .env เท่านั้น
- commit เป็นระยะ ข้อความ commit ภาษาอังกฤษ

## คำสั่งที่ใช้บ่อย

```bash
docker compose up -d          # start local Postgres
npx prisma migrate dev        # run migrations
npx prisma db seed            # seed sample data
npx prisma studio             # browse data at localhost:5555
npm run dev                   # dev server at localhost:3000
npm run build                 # production build check
```

## โครงสร้าง

- `src/app/(public)/` — เว็บ public (หน้าแรก, ค้นหา, รายละเอียดทรัพย์, บทความ)
- `src/app/admin/` — admin (inbox, crm, cms, settings, dashboard)
- `src/app/api/webhook/line/` — LINE webhook
- `src/components/sections/` — section registry ของหน้าแรก
- `src/lib/ai/` — Claude API (ตอบแชท, แปล, สรุป)
- `src/lib/line/` — LINE client
- `src/lib/media/` — upload + sharp
- `src/lib/db.ts` — Prisma client singleton

## หมายเหตุ dev

- shadcn/ui ตั้งค่าแบบ manual (components.json + tailwind theme + `cn()` ใน `src/lib/utils.ts`) — เพิ่ม component โดย vendor โค้ดเข้า `src/components/ui/` ตาม style "new-york"
- Seed login: `admin@bpp.local` / `admin1234` (dev เท่านั้น — เปลี่ยนก่อน production)
