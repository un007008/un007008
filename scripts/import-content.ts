/**
 * Bulk-import real content (KB entries / properties) into the database.
 *
 * Usage (local or Railway console):
 *   npx tsx scripts/import-content.ts --kb content/knowledge-starter.json
 *   npx tsx scripts/import-content.ts --kb my-kb.json --activate
 *   npx tsx scripts/import-content.ts --properties my-listings.csv
 *   npx tsx scripts/import-content.ts --properties my-listings.csv --publish --translate
 *
 * Safety defaults: KB entries import as INACTIVE (AI won't use them) and
 * properties as HIDDEN (not on the public site) until you review them in
 * the admin UI or pass --activate / --publish. Re-running skips rows that
 * already exist (same question / refCode).
 *
 * CSV columns (see content/properties.example.csv):
 *   refCode,listingType,propertyType,titleTh,descriptionTh,priceSale,
 *   priceRent,bedrooms,bathrooms,areaSqm,floor,projectName,district,
 *   btsMrt,lat,lng,featured
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

import { slugify } from "../src/lib/slug";
import { aiProvider, structuredCompletion } from "../src/lib/ai/provider";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};

// ---------- tiny CSV parser (handles quoted fields with commas/newlines) ----------
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== "")) rows.push(row);

  const [header, ...body] = rows;
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()]))
  );
}

// ---------- KB import ----------
async function importKb(file: string, activate: boolean) {
  const items = JSON.parse(readFileSync(file, "utf8")) as {
    question: string; answer: string; category?: string;
  }[];
  let created = 0, skipped = 0;
  for (const item of items) {
    if (!item.question?.trim() || !item.answer?.trim()) { skipped++; continue; }
    const existing = await prisma.knowledgeEntry.findFirst({
      where: { question: item.question.trim() },
    });
    if (existing) { skipped++; continue; }
    await prisma.knowledgeEntry.create({
      data: {
        question: item.question.trim(),
        answer: item.answer.trim(),
        category: item.category?.trim() || null,
        active: activate,
      },
    });
    created++;
  }
  console.log(
    `KB: created ${created} (${activate ? "ACTIVE" : "inactive — เปิดใช้ใน /admin/knowledge หลังรีวิว"}), skipped ${skipped}`
  );
}

// ---------- property import ----------
const LISTING = ["SALE", "RENT", "SALE_AND_RENT"];
const PTYPE = ["CONDO", "HOUSE", "TOWNHOUSE", "COMMERCIAL", "LAND"];

const TranslationSchema = z.object({
  en: z.string().describe("natural English translation"),
  zh: z.string().describe("natural Simplified Chinese translation"),
});

async function translatePair(th: string): Promise<{ en: string; zh: string }> {
  if (!th.trim() || !aiProvider()) return { en: "", zh: "" };
  const result = await structuredCompletion({
    schema: TranslationSchema,
    maxTokens: 2048,
    system:
      "Translate this Thai real-estate listing text into English and Simplified Chinese. Keep the marketing tone, do not add information.",
    user: th,
  });
  return result ?? { en: "", zh: "" };
}

async function importProperties(file: string, publish: boolean, translate: boolean) {
  const rows = parseCsv(readFileSync(file, "utf8"));
  let created = 0, skipped = 0, failed = 0;
  for (const r of rows) {
    const refCode = r.refCode?.trim();
    if (!refCode) { failed++; console.warn("  ! row without refCode skipped"); continue; }
    if (await prisma.property.findUnique({ where: { refCode } })) {
      skipped++; continue;
    }
    if (!LISTING.includes(r.listingType) || !PTYPE.includes(r.propertyType)) {
      failed++; console.warn(`  ! ${refCode}: listingType/propertyType ไม่ถูกต้อง`); continue;
    }
    if (!r.titleTh) { failed++; console.warn(`  ! ${refCode}: ไม่มี titleTh`); continue; }

    const num = (v: string) => (v && !isNaN(Number(v)) ? Number(v) : null);
    const title = { th: r.titleTh, ...(translate ? await translatePair(r.titleTh) : { en: "", zh: "" }) };
    const description = {
      th: r.descriptionTh ?? "",
      ...(translate && r.descriptionTh ? await translatePair(r.descriptionTh) : { en: "", zh: "" }),
    };
    const baseSlug = slugify(title.en || r.titleTh) || refCode.toLowerCase();
    const slug = (await prisma.property.findUnique({ where: { slug: baseSlug } }))
      ? `${baseSlug}-${refCode.toLowerCase()}`
      : baseSlug;

    await prisma.property.create({
      data: {
        refCode,
        status: publish ? "AVAILABLE" : "HIDDEN",
        listingType: r.listingType as never,
        propertyType: r.propertyType as never,
        title,
        description,
        priceSale: num(r.priceSale),
        priceRent: num(r.priceRent),
        bedrooms: num(r.bedrooms),
        bathrooms: num(r.bathrooms),
        areaSqm: num(r.areaSqm),
        floor: num(r.floor),
        projectName: r.projectName || null,
        district: r.district || null,
        btsMrt: r.btsMrt || null,
        lat: num(r.lat),
        lng: num(r.lng),
        featured: r.featured?.toLowerCase() === "true",
        slug,
      },
    });
    created++;
    console.log(`  + ${refCode} (${slug})`);
  }
  console.log(
    `Properties: created ${created} (${publish ? "AVAILABLE" : "HIDDEN — เปิดใน /admin/properties หลังรีวิว/ใส่รูป"}), skipped ${skipped}, failed ${failed}`
  );
}

async function main() {
  const kbFile = opt("kb");
  const propFile = opt("properties");
  if (!kbFile && !propFile) {
    console.log("ระบุ --kb <file.json> และ/หรือ --properties <file.csv> (ดูหัวไฟล์นี้)");
    process.exit(1);
  }
  if (kbFile) await importKb(kbFile, flag("activate"));
  if (propFile) await importProperties(propFile, flag("publish"), flag("translate"));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
