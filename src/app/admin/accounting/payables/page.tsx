import Link from "next/link";

import { fmtMoney } from "@/lib/accounting";
import { bangkokDayKey, fmtBangkokDate, parseAsBangkok } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "เจ้าหนี้ค้างจ่าย — PropOS" };

type Bucket = "current" | "d1_30" | "d31_60" | "d60plus";

const BUCKET_LABEL: Record<Bucket, string> = {
  current: "ยังไม่ครบกำหนด",
  d1_30: "เกิน 1-30 วัน",
  d31_60: "เกิน 31-60 วัน",
  d60plus: "เกิน 60 วัน",
};

function bucketOf(overdueDays: number): Bucket {
  if (overdueDays <= 0) return "current";
  if (overdueDays <= 30) return "d1_30";
  if (overdueDays <= 60) return "d31_60";
  return "d60plus";
}

export default async function PayablesPage() {
  const todayStart = parseAsBangkok(bangkokDayKey(new Date()));

  const expenses = await prisma.accDocument.findMany({
    where: { docType: "EXPENSE", status: "AWAITING_PAYMENT" },
    orderBy: { dueDate: "asc" },
    include: { contact: { select: { name: true, phone: true } } },
  });

  const rows = expenses.map((d) => {
    const due = d.dueDate ?? d.issueDate;
    const dueDayStart = parseAsBangkok(bangkokDayKey(due));
    const overdueDays = Math.round((todayStart.getTime() - dueDayStart.getTime()) / 86400000);
    return { ...d, overdueDays, bucket: bucketOf(overdueDays) };
  });

  const bucketTotals: Record<Bucket, number> = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0 };
  for (const r of rows) bucketTotals[r.bucket] += Number(r.total);
  const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);

  const byContact = new Map<string, { name: string; phone: string | null; docs: typeof rows }>();
  for (const r of rows) {
    const g = byContact.get(r.contactId) ?? {
      name: r.contact.name,
      phone: r.contact.phone,
      docs: [] as typeof rows,
    };
    g.docs.push(r);
    byContact.set(r.contactId, g);
  }
  const groups = Array.from(byContact.values()).sort(
    (a, b) =>
      b.docs.reduce((s, d) => s + Number(d.total), 0) -
      a.docs.reduce((s, d) => s + Number(d.total), 0)
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">เจ้าหนี้ค้างจ่าย</h1>
        <p className="text-sm text-muted-foreground">
          บันทึกค่าใช้จ่ายสถานะรอชำระทั้งหมด {rows.length} ฉบับ รวม ฿{fmtMoney(grandTotal)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center text-sm lg:grid-cols-4">
        {(Object.keys(BUCKET_LABEL) as Bucket[]).map((b) => (
          <div
            key={b}
            className={cn(
              "rounded-lg border p-3",
              b === "d60plus" && bucketTotals[b] > 0 && "border-red-300 bg-red-50"
            )}
          >
            <p className="text-xs text-muted-foreground">{BUCKET_LABEL[b]}</p>
            <p className="font-semibold">฿{fmtMoney(bucketTotals[b])}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {groups.map((g) => {
          const total = g.docs.reduce((s, d) => s + Number(d.total), 0);
          return (
            <div key={g.name + total} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {g.name}
                  {g.phone && (
                    <span className="ml-2 font-normal text-muted-foreground">{g.phone}</span>
                  )}
                </p>
                <p className="text-sm font-semibold">฿{fmtMoney(total)}</p>
              </div>
              <div className="mt-1.5 space-y-1">
                {g.docs.map((d) => (
                  <Link
                    key={d.id}
                    href={`/admin/accounting/documents/${d.id}`}
                    className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-accent"
                  >
                    <span>
                      {d.docNumber}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ครบกำหนด {fmtBangkokDate(d.dueDate ?? d.issueDate)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span>฿{fmtMoney(Number(d.total))}</span>
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-xs",
                          d.overdueDays <= 0
                            ? "bg-secondary"
                            : d.overdueDays <= 30
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                        )}
                      >
                        {d.overdueDays <= 0 ? "ยังไม่ครบกำหนด" : `เกิน ${d.overdueDays} วัน`}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
        {groups.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            ไม่มีเจ้าหนี้ค้างจ่าย 🎉
          </p>
        )}
      </div>
    </div>
  );
}
