# คู่มือ Deploy ขึ้น Railway (ทีละขั้น ไม่ต้องใช้ Terminal)

> ใช้เวลา ~10 นาที ได้เว็บจริงที่เข้าจากทุกเครื่อง/มือถือ
> ค่าใช้จ่าย: Railway Hobby plan ~$5/เดือน (มี trial ให้ลองก่อน)

## ขั้นที่ 1 — สมัคร/ล็อกอิน Railway

1. เข้า <https://railway.app> → **Login** → เลือก **Login with GitHub**
   (ใช้บัญชี GitHub เดียวกับที่เก็บโปรเจกต์นี้ คือ `un007008`)
2. อนุญาตสิทธิ์ที่ Railway ขอ

## ขั้นที่ 2 — สร้างโปรเจกต์จาก GitHub repo

1. กด **New Project** → **Deploy from GitHub repo**
2. เลือก repo **un007008/un007008** (ถ้าไม่เห็น กด Configure GitHub App แล้วให้สิทธิ์ repo นี้)
3. สำคัญ: ไปที่ service ที่สร้างขึ้น → แท็บ **Settings** → หัวข้อ **Source**
   → ตั้ง **Branch** เป็น `claude/session-start-dcx0do` (branch หลักของโปรเจกต์นี้)
4. Railway จะเริ่ม build อัตโนมัติ (ยัง fail ได้ ปกติ — เพราะยังไม่มี database ไปต่อขั้นถัดไปก่อน)

## ขั้นที่ 3 — เพิ่ม PostgreSQL

1. ในหน้าโปรเจกต์ กด **+ New** (หรือคลิกขวาพื้นที่ว่าง) → **Database** → **Add PostgreSQL**
2. รอสถานะขึ้นเขียว

## ขั้นที่ 4 — ตั้งค่า Environment Variables

คลิกที่ service ของแอป (ไม่ใช่ตัว Postgres) → แท็บ **Variables** → กด **+ New Variable** เพิ่มทีละตัว:

| ตัวแปร | ค่า |
|---|---|
| `DATABASE_URL` | กด **Add Reference** → เลือก `Postgres.DATABASE_URL` |
| `NEXTAUTH_SECRET` | ตัวอักษรสุ่มยาว ๆ (กดปุ่ม 🎲 generate ของ Railway ได้ หรือพิมพ์อะไรยาว ๆ เดายากเอง) |
| `NEXTAUTH_URL` | เว้นไว้ก่อน — จะกลับมาใส่หลังได้โดเมนในขั้นที่ 5 |

ตัวแปรอื่น (LINE, AI, R2, Maps) **ยังไม่ต้องใส่ก็ใช้ได้** — ระบบบัญชีและ admin ทำงานครบ
ใส่ทีหลังเมื่อจะเปิดใช้แชท LINE / AI / อัปโหลดรูปถาวร (ดูรายชื่อใน `.env.example`)

## ขั้นที่ 5 — เปิดโดเมน

1. Service ของแอป → **Settings** → หัวข้อ **Networking** → กด **Generate Domain**
2. ได้ URL เช่น `https://xxxx.up.railway.app` — คัดลอกไว้
3. กลับไปแท็บ **Variables** → เพิ่ม `NEXTAUTH_URL` = URL ที่เพิ่งได้ (มี https:// เต็ม)
4. Railway จะ redeploy เอง รอจน deployment ล่าสุดขึ้น **Success**
   (ตอน start ระบบจะรัน migration สร้างตารางทั้งหมดให้อัตโนมัติ)

## ขั้นที่ 6 — สร้างผู้ใช้ admin คนแรก

ฐานข้อมูลบน production ยังว่าง (ไม่มี seed) ต้องสร้าง admin 1 ครั้ง:

1. Service ของ **Postgres** → แท็บ **Data** → เปิด **Query**
2. วางคำสั่งนี้ (เปลี่ยนอีเมลได้ รหัสผ่านคือ `admin1234` — ล็อกอินแล้วให้เปลี่ยนทันที):

```sql
INSERT INTO "User" (id, email, password, name, role, "createdAt")
VALUES (
  'admin-001',
  'admin@bpp.local',
  '$2b$10$C7JFY4nWYgo2Ze21DXjLaegDoWN.66ZIelSgaL/T8SOCpsP1DgGsG',
  'ผู้ดูแลระบบ',
  'ADMIN',
  now()
);
```

## ขั้นที่ 7 — เข้าใช้งาน

1. เปิด `https://<โดเมนของคุณ>/admin`
2. ล็อกอิน `admin@bpp.local` / `admin1234`
3. **เปลี่ยนรหัสผ่านทันที** ที่มุมขวาบน → บัญชีของฉัน
4. เมนู **บัญชี** → **ตั้งค่า** กรอกข้อมูลบริษัท → **ผู้ติดต่อ** เพิ่มลูกค้า → ออกเอกสารได้เลย

## ปัญหาที่พบบ่อย

| อาการ | วิธีแก้ |
|---|---|
| Build fail | ดู log ใน Deployments — ส่วนใหญ่คือยังไม่ได้ตั้ง branch เป็น `claude/session-start-dcx0do` |
| หน้าเว็บ error 500 | เช็คว่า `DATABASE_URL` เป็น Reference ไปที่ Postgres แล้ว และ deployment ล่าสุด Success |
| ล็อกอินไม่ได้ | เช็ค `NEXTAUTH_URL` ตรงกับโดเมนจริง (มี https://) และรัน SQL ขั้นที่ 6 แล้ว |
| ล็อกอินผิดหลายครั้งแล้วโดนล็อก | ระบบกันเดารหัส 10 ครั้ง/15 นาที — รอ 15 นาทีแล้วลองใหม่ |
