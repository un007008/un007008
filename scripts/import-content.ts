/**
 * Bulk-import real content (KB entries / properties) into the database.
 *
 * Usage (local or Railway console):
 *   npx tsx scripts/import-content.ts --kb content/knowledge-starter.json
 *   npx tsx scripts/import-content.ts --kb my-kb.json --activate
 *   npx tsx scripts/import-content.ts --properties my-listings.csv
 *   npx tsx scripts/import-content.ts --properties my-listings.csv --publish --translate
 *
 * Google Sheets: share the sheet (Anyone with the link → Viewer), then pass
 * either the normal sheet URL or its CSV export URL — both work:
 *   npx tsx scripts/import-content.ts --properties "https://docs.google.com/spreadsheets/d/<ID>/edit?gid=0" --translate
 * Column names in row 1 must match content/properties.example.csv.
 *
 * Safety defaults: KB entries import as INACTIVE (AI won't use them) and
 * properties as HIDDEN (not on the public site) until you review them in
 * the admin UI or pass --activate / --publish. Re-running skips rows that
 * already exist (same question / refCode).
 *
 * Tip: set SHEET_IMPORT_URL in the environment and the nightly automation
 * imports new sheet rows automatically — this script is for one-off runs.
 */
import { readFileSync } from "fs";

import { prisma } from "../src/lib/db";
import {
  fetchCsvSource,
  importProperties,
  parseCsv,
} from "../src/lib/content-import";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null;
};

async function readSource(src: string): Promise<string> {
  return /^https?:\/\//.test(src) ? fetchCsvSource(src) : readFileSync(src, "utf8");
}

async function importKb(file: string, activate: boolean) {
  const items = JSON.parse(await readSource(file)) as {
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

async function main() {
  const kbFile = opt("kb");
  const propFile = opt("properties");
  if (!kbFile && !propFile) {
    console.log("ระบุ --kb <file.json|url> และ/หรือ --properties <file.csv|url> (ดูหัวไฟล์นี้)");
    process.exit(1);
  }
  if (kbFile) await importKb(kbFile, flag("activate"));
  if (propFile) {
    const rows = parseCsv(await readSource(propFile));
    const r = await importProperties(rows, {
      publish: flag("publish"),
      translate: flag("translate"),
    });
    for (const ref of r.created) console.log(`  + ${ref}`);
    for (const f of r.failed) console.log(`  ! ${f.refCode}: ${f.reason}`);
    console.log(
      `Properties: created ${r.created.length} (${flag("publish") ? "AVAILABLE" : "HIDDEN — เปิดใน /admin/properties หลังรีวิว/ใส่รูป"}), skipped ${r.skipped}, failed ${r.failed.length}`
    );
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
