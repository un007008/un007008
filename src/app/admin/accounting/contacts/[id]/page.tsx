import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  CONTACT_TYPE_LABEL,
  docStatusLabel,
  DOC_TYPE_LABEL,
  fmtMoney,
  incomeSign,
} from "@/lib/accounting";
import { fmtBangkokDate } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "รายการเดินบัญชีผู้ติดต่อ — PropOS" };

const STATUS_VARIANT = {
  DRAFT: "secondary",
  AWAITING_PAYMENT: "warning",
  PAID: "success",
  VOID: "destructive",
} as const;

export default async function AccContactStatementPage({
  params,
}: {
  params: { id: string };
}) {
  const contact = await prisma.accContact.findUnique({
    where: { id: params.id },
    include: { documents: { orderBy: { issueDate: "desc" } } },
  });
  if (!contact) notFound();

  // income side (invoices/receipts net of CN/DN), expense side, and outstanding
  let billed = 0;
  let received = 0;
  let paidOut = 0;
  let receivable = 0;
  let payable = 0;
  for (const d of contact.documents) {
    const total = Number(d.total);
    const sign = incomeSign(d);
    if (sign !== 0) {
      if (d.status === "PAID") received += sign * total;
      if (d.status === "PAID" || d.status === "AWAITING_PAYMENT") billed += sign * total;
      if (d.status === "AWAITING_PAYMENT" && d.docType === "INVOICE") receivable += total;
    } else if (d.docType === "EXPENSE") {
      if (d.status === "PAID") paidOut += total;
      if (d.status === "AWAITING_PAYMENT") payable += total;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">{contact.name}</h1>
          <p className="text-sm text-muted-foreground">
            {CONTACT_TYPE_LABEL[contact.type]}
            {contact.taxId &&
              ` · เลขผู้เสียภาษี ${contact.taxId}${contact.branch ? ` (${contact.branch})` : ""}`}
            {contact.phone && ` · ${contact.phone}`}
          </p>
          {contact.address && (
            <p className="text-sm text-muted-foreground">{contact.address}</p>
          )}
        </div>
        <Link
          href="/admin/accounting/contacts"
          className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          ← ผู้ติดต่อทั้งหมด
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center text-sm lg:grid-cols-4">
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">ยอดขายสะสม (สุทธิ)</p>
          <p className="font-semibold text-emerald-700">฿{fmtMoney(billed)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">รับชำระแล้ว</p>
          <p className="font-semibold">฿{fmtMoney(received)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">ลูกหนี้คงค้าง</p>
          <p className="font-semibold text-amber-700">฿{fmtMoney(receivable)}</p>
        </div>
        <div className="rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            ฝั่งรายจ่าย (จ่ายแล้ว / ค้างจ่าย)
          </p>
          <p className="font-semibold text-red-700">
            ฿{fmtMoney(paidOut)} / ฿{fmtMoney(payable)}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {contact.documents.map((d) => (
          <Link
            key={d.id}
            href={`/admin/accounting/documents/${d.id}`}
            className="flex items-center justify-between gap-2 rounded-md border p-2.5 text-sm hover:bg-accent"
          >
            <div className="min-w-0">
              <div className="font-medium">
                {d.docNumber}{" "}
                <span className="font-normal text-muted-foreground">
                  · {DOC_TYPE_LABEL[d.docType]}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {fmtBangkokDate(d.issueDate)}
                {d.paidAt && ` · ชำระ ${fmtBangkokDate(d.paidAt)}`}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-medium">
                {d.docType === "CREDIT_NOTE" ? "-" : ""}฿{fmtMoney(Number(d.total))}
              </span>
              <Badge variant={STATUS_VARIANT[d.status]}>
                {docStatusLabel(d.docType, d.status)}
              </Badge>
            </div>
          </Link>
        ))}
        {contact.documents.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีเอกสารกับผู้ติดต่อนี้
          </p>
        )}
      </div>
    </div>
  );
}
