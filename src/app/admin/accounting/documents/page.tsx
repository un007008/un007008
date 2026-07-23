import Link from "next/link";
import type { AccDocStatus, AccDocType, Prisma } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { DOC_STATUS_LABEL, DOC_TYPE_LABEL, fmtMoney } from "@/lib/accounting";
import { fmtBangkokDate } from "@/lib/datetime";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "เอกสารบัญชี — PropOS" };

const DOC_TYPES = ["QUOTATION", "INVOICE", "RECEIPT", "EXPENSE"] as const;
const STATUSES = ["DRAFT", "AWAITING_PAYMENT", "PAID", "VOID"] as const;

const STATUS_VARIANT = {
  DRAFT: "secondary",
  AWAITING_PAYMENT: "warning",
  PAID: "success",
  VOID: "destructive",
} as const;

function filterHref(params: { docType?: string; status?: string; q?: string }) {
  const sp = new URLSearchParams();
  if (params.docType) sp.set("docType", params.docType);
  if (params.status) sp.set("status", params.status);
  if (params.q) sp.set("q", params.q);
  const qs = sp.toString();
  return `/admin/accounting/documents${qs ? `?${qs}` : ""}`;
}

export default async function AccountingDocumentsPage({
  searchParams,
}: {
  searchParams: { docType?: string; status?: string; q?: string };
}) {
  const docType = DOC_TYPES.includes(searchParams.docType as AccDocType)
    ? (searchParams.docType as AccDocType)
    : undefined;
  const status = STATUSES.includes(searchParams.status as AccDocStatus)
    ? (searchParams.status as AccDocStatus)
    : undefined;
  const q = searchParams.q?.trim();

  const where: Prisma.AccDocumentWhereInput = {};
  if (docType) where.docType = docType;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { docNumber: { contains: q, mode: "insensitive" } },
      { contact: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const docs = await prisma.accDocument.findMany({
    where,
    orderBy: { issueDate: "desc" },
    take: 200,
    include: { contact: { select: { name: true } } },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">เอกสารบัญชี</h1>
        <Link
          href="/admin/accounting/documents/new"
          className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          + สร้างเอกสาร
        </Link>
      </div>

      {/* type tabs */}
      <div className="flex gap-1 overflow-x-auto text-sm">
        <Link
          href={filterHref({ status, q })}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5",
            !docType ? "bg-primary text-primary-foreground" : "border hover:bg-accent"
          )}
        >
          ทั้งหมด
        </Link>
        {DOC_TYPES.map((t) => (
          <Link
            key={t}
            href={filterHref({ docType: t, status, q })}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5",
              docType === t ? "bg-primary text-primary-foreground" : "border hover:bg-accent"
            )}
          >
            {DOC_TYPE_LABEL[t]}
          </Link>
        ))}
      </div>

      {/* status filter + search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 overflow-x-auto text-xs">
          <Link
            href={filterHref({ docType, q })}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1",
              !status ? "bg-secondary font-medium" : "border hover:bg-accent"
            )}
          >
            ทุกสถานะ
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={filterHref({ docType, status: s, q })}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-md px-2.5 py-1",
                status === s ? "bg-secondary font-medium" : "border hover:bg-accent"
              )}
            >
              {DOC_STATUS_LABEL[s]}
            </Link>
          ))}
        </div>
        <form action="/admin/accounting/documents" className="flex flex-1 gap-1.5">
          {docType && <input type="hidden" name="docType" value={docType} />}
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="ค้นหาเลขเอกสาร / ชื่อผู้ติดต่อ"
            className="h-8 w-full min-w-40 rounded-md border bg-background px-2.5 text-sm"
          />
          <button className="h-8 shrink-0 rounded-md border px-3 text-sm hover:bg-accent">
            ค้นหา
          </button>
        </form>
      </div>

      <div className="space-y-1.5">
        {docs.map((d) => (
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
              <div className="truncate text-xs text-muted-foreground">
                {d.contact.name} · {fmtBangkokDate(d.issueDate)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-medium">฿{fmtMoney(Number(d.total))}</span>
              <Badge variant={STATUS_VARIANT[d.status]}>{DOC_STATUS_LABEL[d.status]}</Badge>
            </div>
          </Link>
        ))}
        {docs.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            ไม่พบเอกสารตามเงื่อนไข
          </p>
        )}
      </div>
    </div>
  );
}
