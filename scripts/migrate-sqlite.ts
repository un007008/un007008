/**
 * Migrate data from the old line-ai-bot SQLite database into Postgres.
 * (SPEC step 1.6)
 *
 * Usage:
 *   npx tsx scripts/migrate-sqlite.ts <path/to/old.db> --dry-run   # inspect + preview
 *   npx tsx scripts/migrate-sqlite.ts <path/to/old.db>             # import
 *
 * The old schema is auto-detected with heuristics (table/column names vary
 * between line-ai-bot versions). Run with --dry-run first: it prints every
 * table, the detected mapping, and what would be imported. If detection
 * guesses wrong, adjust the HINTS block below and run again.
 */
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---- tweak here if auto-detection guesses wrong -------------------------
const HINTS = {
  // exact table names (leave null for auto-detect)
  contactsTable: null as string | null,
  messagesTable: null as string | null,
  knowledgeTable: null as string | null,
  // exact column names (leave null for auto-detect)
  lineUserIdColumn: null as string | null,
  messageTextColumn: null as string | null,
  messageRoleColumn: null as string | null,
};
// -------------------------------------------------------------------------

type Row = Record<string, unknown>;

function pickColumn(columns: string[], candidates: string[]): string | null {
  const lower = columns.map((c) => c.toLowerCase());
  for (const cand of candidates) {
    const i = lower.findIndex((c) => c === cand || c.includes(cand));
    if (i !== -1) return columns[i];
  }
  return null;
}

async function main() {
  const [dbPath, ...flags] = process.argv.slice(2);
  const dryRun = flags.includes("--dry-run");
  if (!dbPath) {
    console.error("usage: npx tsx scripts/migrate-sqlite.ts <old.db> [--dry-run]");
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });
  const tables = (
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as {
      name: string;
    }[]
  ).map((t) => t.name);

  console.log("== tables in old DB ==");
  for (const t of tables) {
    const cols = (db.prepare(`PRAGMA table_info("${t}")`).all() as { name: string }[]).map((c) => c.name);
    const count = (db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get() as { n: number }).n;
    console.log(`  ${t} (${count} rows): ${cols.join(", ")}`);
  }

  const findTable = (hint: string | null, candidates: string[]) =>
    hint ??
    tables.find((t) => candidates.some((c) => t.toLowerCase().includes(c))) ??
    null;

  const contactsTable = findTable(HINTS.contactsTable, ["user", "contact", "customer"]);
  const messagesTable = findTable(HINTS.messagesTable, ["message", "chat", "conversation_log", "history"]);
  const knowledgeTable = findTable(HINTS.knowledgeTable, ["knowledge", "faq", "qa", "kb"]);

  console.log("\n== detected mapping ==");
  console.log(`  contacts  <- ${contactsTable ?? "(not found)"}`);
  console.log(`  messages  <- ${messagesTable ?? "(not found)"}`);
  console.log(`  knowledge <- ${knowledgeTable ?? "(not found)"}`);

  let imported = { contacts: 0, conversations: 0, messages: 0, knowledge: 0, skipped: 0 };

  // ---- knowledge ----
  if (knowledgeTable) {
    const rows = db.prepare(`SELECT * FROM "${knowledgeTable}"`).all() as Row[];
    const cols = rows[0] ? Object.keys(rows[0]) : [];
    const qCol = pickColumn(cols, ["question", "q", "keyword", "title"]);
    const aCol = pickColumn(cols, ["answer", "a", "response", "reply", "content"]);
    const cCol = pickColumn(cols, ["category", "type", "group"]);
    console.log(`\n  knowledge columns: question=${qCol}, answer=${aCol}, category=${cCol}`);
    for (const r of rows) {
      const question = String(r[qCol ?? ""] ?? "").trim();
      const answer = String(r[aCol ?? ""] ?? "").trim();
      if (!question || !answer) { imported.skipped++; continue; }
      if (!dryRun) {
        const dup = await prisma.knowledgeEntry.findFirst({ where: { question } });
        if (dup) { imported.skipped++; continue; }
        await prisma.knowledgeEntry.create({
          data: { question, answer, category: cCol ? String(r[cCol] ?? "") || null : null },
        });
      }
      imported.knowledge++;
    }
  }

  // ---- contacts + conversations + messages ----
  const contactIdByOldKey = new Map<string, string>();
  const conversationByContact = new Map<string, string>();

  if (contactsTable) {
    const rows = db.prepare(`SELECT * FROM "${contactsTable}"`).all() as Row[];
    const cols = rows[0] ? Object.keys(rows[0]) : [];
    const lineCol =
      HINTS.lineUserIdColumn ?? pickColumn(cols, ["line_user_id", "lineuserid", "line_id", "user_id", "userid", "uid"]);
    const nameCol = pickColumn(cols, ["display_name", "displayname", "name", "nickname"]);
    console.log(`\n  contact columns: lineUserId=${lineCol}, name=${nameCol}`);
    for (const r of rows) {
      const lineUserId = String(r[lineCol ?? ""] ?? "").trim();
      if (!lineUserId) { imported.skipped++; continue; }
      if (dryRun) { imported.contacts++; continue; }
      let contact = await prisma.contact.findUnique({ where: { lineUserId } });
      if (!contact) {
        contact = await prisma.contact.create({
          data: { lineUserId, name: nameCol ? String(r[nameCol] ?? "") || null : null },
        });
        imported.contacts++;
      }
      contactIdByOldKey.set(lineUserId, contact.id);
    }
  }

  if (messagesTable) {
    const rows = db
      .prepare(`SELECT * FROM "${messagesTable}"`)
      .all() as Row[];
    const cols = rows[0] ? Object.keys(rows[0]) : [];
    const userCol =
      HINTS.lineUserIdColumn ?? pickColumn(cols, ["line_user_id", "lineuserid", "user_id", "userid", "uid"]);
    const textCol = HINTS.messageTextColumn ?? pickColumn(cols, ["content", "text", "message", "body"]);
    const roleCol = HINTS.messageRoleColumn ?? pickColumn(cols, ["role", "sender", "direction", "from", "type"]);
    const timeCol = pickColumn(cols, ["created_at", "createdat", "timestamp", "time", "date"]);
    const idCol = pickColumn(cols, ["id", "message_id", "messageid"]);
    console.log(`\n  message columns: user=${userCol}, text=${textCol}, role=${roleCol}, time=${timeCol}`);

    for (const r of rows) {
      const lineUserId = String(r[userCol ?? ""] ?? "").trim();
      const content = String(r[textCol ?? ""] ?? "").trim();
      if (!lineUserId || !content) { imported.skipped++; continue; }
      if (dryRun) { imported.messages++; continue; }

      // contact
      let contactId = contactIdByOldKey.get(lineUserId);
      if (!contactId) {
        const contact =
          (await prisma.contact.findUnique({ where: { lineUserId } })) ??
          (await prisma.contact.create({ data: { lineUserId } }));
        contactId = contact.id;
        contactIdByOldKey.set(lineUserId, contactId);
      }
      // one imported (CLOSED) conversation per contact — reuse a previous
      // run's conversation so a crashed import can resume without data loss
      let conversationId = conversationByContact.get(contactId);
      if (!conversationId) {
        const existing = await prisma.message.findFirst({
          where: {
            conversation: { contactId },
            metadata: { path: ["importedFrom"], equals: "line-ai-bot" },
          },
          select: { conversationId: true },
        });
        if (existing) {
          conversationId = existing.conversationId;
        } else {
          const conv = await prisma.conversation.create({
            data: { contactId, channel: "LINE", status: "CLOSED" },
          });
          conversationId = conv.id;
          imported.conversations++;
        }
        conversationByContact.set(contactId, conversationId);
      }

      const role = String(r[roleCol ?? ""] ?? "").toLowerCase();
      // exact/prefix matches only — a bare .includes("in") would misread
      // "admin" and "outgoing" as inbound customer messages
      const isCustomer =
        role.includes("user") ||
        role.includes("customer") ||
        role === "human" ||
        role === "in" ||
        role.startsWith("incom") ||
        role.startsWith("inbound") ||
        role === "received";
      const isAi = role.includes("assistant") || role.includes("ai") || role.includes("bot");

      const rawTime = timeCol ? r[timeCol] : null;
      let createdAt = new Date();
      if (typeof rawTime === "number") createdAt = new Date(rawTime > 1e12 ? rawTime : rawTime * 1000);
      else if (typeof rawTime === "string" && !isNaN(Date.parse(rawTime))) createdAt = new Date(rawTime);

      // per-message idempotency (by original row id, else content+time)
      const originalId = idCol != null && r[idCol] != null ? String(r[idCol]) : null;
      const dupe = await prisma.message.findFirst({
        where: originalId
          ? { conversationId, metadata: { path: ["originalId"], equals: originalId } }
          : { conversationId, content, createdAt },
        select: { id: true },
      });
      if (dupe) { imported.skipped++; continue; }

      await prisma.message.create({
        data: {
          conversationId,
          direction: isCustomer ? "INBOUND" : "OUTBOUND",
          sender: isCustomer ? "CUSTOMER" : isAi ? "AI" : "STAFF",
          content,
          createdAt,
          metadata: originalId
            ? { importedFrom: "line-ai-bot", originalId }
            : { importedFrom: "line-ai-bot" },
        },
      });
      imported.messages++;
    }
  }

  console.log(`\n== ${dryRun ? "DRY RUN (nothing written)" : "IMPORTED"} ==`);
  console.log(imported);
  db.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
