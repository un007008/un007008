#!/usr/bin/env node
/**
 * Production preflight: validate environment before going live.
 * Usage: node scripts/preflight.mjs   (or: npm run preflight)
 * Exits non-zero when a required variable is missing/invalid.
 */

const env = process.env;
let errors = 0;
let warnings = 0;

const err = (msg) => {
  errors++;
  console.log(`  ✗ ${msg}`);
};
const warn = (msg) => {
  warnings++;
  console.log(`  ⚠ ${msg}`);
};
const ok = (msg) => console.log(`  ✓ ${msg}`);

console.log("== PropOS preflight ==\n-- จำเป็น (ระบบไม่ทำงานถ้าขาด)");

if (!env.DATABASE_URL) err("DATABASE_URL ยังไม่ตั้ง");
else ok("DATABASE_URL");

if (!env.NEXTAUTH_SECRET || env.NEXTAUTH_SECRET.includes("change-me")) {
  err("NEXTAUTH_SECRET ยังไม่ตั้ง/ยังเป็นค่า placeholder — สุ่มด้วย: openssl rand -base64 32");
} else if (env.NEXTAUTH_SECRET.length < 32) {
  warn("NEXTAUTH_SECRET สั้นกว่า 32 ตัวอักษร — ควรสุ่มใหม่");
} else ok("NEXTAUTH_SECRET");

if (!env.NEXTAUTH_URL) err("NEXTAUTH_URL ยังไม่ตั้ง");
else if (!env.NEXTAUTH_URL.startsWith("https://")) {
  warn(`NEXTAUTH_URL ไม่ใช่ https (${env.NEXTAUTH_URL}) — ปุ่มการ์ดทรัพย์ใน LINE จะไม่ขึ้น, hreflang/sitemap จะชี้ URL ผิด`);
} else ok("NEXTAUTH_URL");

console.log("\n-- LINE (inbox ไม่รับข้อความถ้าขาด)");
if (!env.LINE_CHANNEL_SECRET) err("LINE_CHANNEL_SECRET ยังไม่ตั้ง — webhook จะปฏิเสธทุก request");
else ok("LINE_CHANNEL_SECRET");
if (!env.LINE_CHANNEL_ACCESS_TOKEN) err("LINE_CHANNEL_ACCESS_TOKEN ยังไม่ตั้ง — ส่งข้อความกลับไม่ได้");
else ok("LINE_CHANNEL_ACCESS_TOKEN");

console.log("\n-- AI");
if (!env.ANTHROPIC_API_KEY) warn("ANTHROPIC_API_KEY ยังไม่ตั้ง — AI ไม่ตอบเอง ทุกแชท escalate ให้คน, แปลภาษา/สรุปรายคืนไม่ทำงาน");
else ok("ANTHROPIC_API_KEY");

console.log("\n-- เก็บไฟล์");
const r2Keys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"];
const r2Set = r2Keys.filter((k) => env[k]);
if (r2Set.length === r2Keys.length) ok("R2 ครบ");
else if (r2Set.length === 0) warn("R2 ไม่ได้ตั้ง — ไฟล์เก็บในเครื่อง หายเมื่อ redeploy (ต้อง mount volume ที่ public/uploads)");
else err(`R2 ตั้งไม่ครบ ขาด: ${r2Keys.filter((k) => !env[k]).join(", ")}`);

console.log("\n-- เสริม");
if (!env.LINE_STAFF_GROUP_ID) warn("LINE_STAFF_GROUP_ID ยังไม่ตั้ง — แจ้งเตือนอัตโนมัติจะลง log อย่างเดียว ไม่เข้ากลุ่ม LINE");
else ok("LINE_STAFF_GROUP_ID");
if (!env.NEXT_PUBLIC_LINE_OA_URL) warn("NEXT_PUBLIC_LINE_OA_URL ยังไม่ตั้ง — ปุ่มแชท LINE บนเว็บไม่ขึ้น");
else ok("NEXT_PUBLIC_LINE_OA_URL");
if (!env.NEXT_PUBLIC_CONTACT_PHONE) warn("NEXT_PUBLIC_CONTACT_PHONE ยังไม่ตั้ง — ปุ่มโทรบนเว็บไม่ขึ้น");
else ok("NEXT_PUBLIC_CONTACT_PHONE");

console.log(`\n== สรุป: ${errors} ปัญหา, ${warnings} คำเตือน ==`);
if (errors > 0) {
  console.log("แก้ปัญหาข้างบนก่อนขึ้น production");
  process.exit(1);
}
console.log(
  "อย่าลืมหลัง deploy: เปลี่ยนรหัส admin จาก seed, ตั้ง webhook LINE เป็น https://<โดเมน>/api/webhook/line แล้วทักทดสอบ 1 ข้อความ"
);
