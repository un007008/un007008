import { z } from "zod";

import { aiProvider, structuredCompletion } from "@/lib/ai/provider";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/slug";

/**
 * Property bulk-import core — shared by scripts/import-content.ts (manual)
 * and the nightly sheet-import automation job.
 *
 * Safety: imported properties default to HIDDEN so nothing reaches the
 * public site before review; re-imports skip existing refCodes.
 */

/** Fetch a URL; Google Sheets URLs are rewritten to their CSV export. */
export async function fetchCsvSource(src: string): Promise<string> {
  let url = src;
  const sheet = src.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (sheet && !src.includes("format=csv")) {
    const gid = src.match(/[?#&]gid=(\d+)/)?.[1] ?? "0";
    url = `https://docs.google.com/spreadsheets/d/${sheet[1]}/export?format=csv&gid=${gid}`;
  }
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `ดึงข้อมูลไม่ได้ (HTTP ${res.status}) — เช็คว่าแชร์ชีตเป็น "Anyone with the link" แล้ว: ${url}`
    );
  }
  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error('ได้ HTML แทน CSV — ชีตยังไม่ได้แชร์แบบ "Anyone with the link"');
  }
  return text;
}

/** Tiny CSV parser (handles quoted fields with commas/newlines). */
export function parseCsv(text: string): Record<string, string>[] {
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
  if (!header) return [];
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()]))
  );
}

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

export type PropertyImportResult = {
  created: string[]; // refCodes
  skipped: number;
  failed: { refCode: string; reason: string }[];
};

export async function importProperties(
  rows: Record<string, string>[],
  opts: { publish?: boolean; translate?: boolean } = {}
): Promise<PropertyImportResult> {
  const result: PropertyImportResult = { created: [], skipped: 0, failed: [] };
  for (const r of rows) {
    const refCode = r.refCode?.trim();
    if (!refCode) {
      result.failed.push({ refCode: "(ว่าง)", reason: "ไม่มี refCode" });
      continue;
    }
    if (await prisma.property.findUnique({ where: { refCode } })) {
      result.skipped++;
      continue;
    }
    if (!LISTING.includes(r.listingType) || !PTYPE.includes(r.propertyType)) {
      result.failed.push({ refCode, reason: "listingType/propertyType ไม่ถูกต้อง" });
      continue;
    }
    if (!r.titleTh) {
      result.failed.push({ refCode, reason: "ไม่มี titleTh" });
      continue;
    }

    const num = (v: string) => (v && !isNaN(Number(v)) ? Number(v) : null);
    const title = {
      th: r.titleTh,
      ...(opts.translate ? await translatePair(r.titleTh) : { en: "", zh: "" }),
    };
    const description = {
      th: r.descriptionTh ?? "",
      ...(opts.translate && r.descriptionTh
        ? await translatePair(r.descriptionTh)
        : { en: "", zh: "" }),
    };
    const baseSlug = slugify(title.en || r.titleTh) || refCode.toLowerCase();
    const slug = (await prisma.property.findUnique({ where: { slug: baseSlug } }))
      ? `${baseSlug}-${refCode.toLowerCase()}`
      : baseSlug;

    await prisma.property.create({
      data: {
        refCode,
        status: opts.publish ? "AVAILABLE" : "HIDDEN",
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
    result.created.push(refCode);
  }
  return result;
}
