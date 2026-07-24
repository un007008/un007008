import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentAttachments } from "@/components/accounting/attachments";
import { DocumentActions } from "@/components/accounting/document-actions";
import { Badge } from "@/components/ui/badge";
import {
  CONTACT_TYPE_LABEL,
  docStatusLabel,
  DOC_TYPE_LABEL,
  fmtMoney,
} from "@/lib/accounting";
import { getCompanyProfile } from "@/lib/company";
import { fmtBangkokDate } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "เอกสารบัญชี — PropOS" };

const STATUS_VARIANT = {
  DRAFT: "secondary",
  AWAITING_PAYMENT: "warning",
  PAID: "success",
  VOID: "destructive",
} as const;

export default async function AccountingDocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const [doc, company] = await Promise.all([
    prisma.accDocument.findUnique({
      where: { id: params.id },
      include: {
        items: { orderBy: { order: "asc" } },
        attachments: { orderBy: { createdAt: "desc" } },
        contact: true,
      },
    }),
    getCompanyProfile(),
  ]);
  if (!doc) notFound();

  const refDoc = doc.refDocId
    ? await prisma.accDocument.findUnique({
        where: { id: doc.refDocId },
        select: { id: true, docNumber: true },
      })
    : null;
  const receipt =
    doc.docType === "INVOICE"
      ? await prisma.accDocument.findFirst({
          where: { refDocId: doc.id },
          select: { id: true, docNumber: true },
        })
      : null;

  const whtRate = Number(doc.whtRate);
  const netPayable = Number(doc.total) - Number(doc.whtAmount);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">{doc.docNumber}</h1>
          <Badge variant={STATUS_VARIANT[doc.status]}>{docStatusLabel(doc.docType, doc.status)}</Badge>
        </div>
        <DocumentActions
          doc={{
            id: doc.id,
            docType: doc.docType,
            docNumber: doc.docNumber,
            status: doc.status,
          }}
        />
      </div>

      {doc.docType === "EXPENSE" && doc.status === "PAID" && Number(doc.whtAmount) > 0 && (
        <p className="text-sm print:hidden">
          <Link
            href={`/admin/accounting/documents/${doc.id}/wht-cert`}
            className="underline"
          >
            🧾 ออกหนังสือรับรองหัก ณ ที่จ่าย (50 ทวิ)
          </Link>
        </p>
      )}

      {(refDoc || receipt) && (
        <p className="text-sm text-muted-foreground print:hidden">
          {refDoc && (
            <>
              ออกจากใบแจ้งหนี้{" "}
              <Link className="underline" href={`/admin/accounting/documents/${refDoc.id}`}>
                {refDoc.docNumber}
              </Link>
            </>
          )}
          {receipt && (
            <>
              ใบเสร็จที่เกี่ยวข้อง{" "}
              <Link className="underline" href={`/admin/accounting/documents/${receipt.id}`}>
                {receipt.docNumber}
              </Link>
            </>
          )}
        </p>
      )}

      {/* printable document */}
      <div className="rounded-lg border p-4 sm:p-6 print:border-0 print:p-0">
        {company.name && (
          <div className="border-b pb-3 text-sm">
            <p className="font-semibold">{company.name}</p>
            {company.taxId && (
              <p>
                เลขผู้เสียภาษี {company.taxId}
                {company.branch ? ` (${company.branch})` : ""}
              </p>
            )}
            {company.address && <p>{company.address}</p>}
            {(company.phone || company.email) && (
              <p className="text-muted-foreground">
                {[company.phone, company.email].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3 pt-3">
          <div>
            <p className="text-lg font-bold">{DOC_TYPE_LABEL[doc.docType]}</p>
            <p className="text-sm text-muted-foreground">เลขที่ {doc.docNumber}</p>
            {doc.status === "VOID" && (
              <p className="mt-1 text-sm font-semibold text-destructive">** เอกสารถูกยกเลิก **</p>
            )}
          </div>
          <div className="text-right text-sm">
            <p>วันที่ {fmtBangkokDate(doc.issueDate)}</p>
            {doc.dueDate && <p>ครบกำหนด {fmtBangkokDate(doc.dueDate)}</p>}
            {doc.paidAt && (
              <p>
                {doc.docType === "QUOTATION" ? "ตอบรับเมื่อ" : "ชำระเมื่อ"}{" "}
                {fmtBangkokDate(doc.paidAt)}
                {doc.paymentMethod ? ` (${doc.paymentMethod})` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="border-b py-3 text-sm">
          <p className="text-xs text-muted-foreground">
            {doc.docType === "EXPENSE" ? "ผู้ขาย/คู่ค้า" : "ลูกค้า"} (
            {CONTACT_TYPE_LABEL[doc.contact.type]})
          </p>
          <p className="font-medium">{doc.contact.name}</p>
          {doc.contact.taxId && (
            <p>
              เลขผู้เสียภาษี {doc.contact.taxId}
              {doc.contact.branch ? ` (${doc.contact.branch})` : ""}
            </p>
          )}
          {doc.contact.address && <p>{doc.contact.address}</p>}
          {(doc.contact.phone || doc.contact.email) && (
            <p className="text-muted-foreground">
              {[doc.contact.phone, doc.contact.email].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        <div className="overflow-x-auto py-3">
          <table className="w-full min-w-96 text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-1.5 pr-2 font-medium">#</th>
                <th className="py-1.5 pr-2 font-medium">รายละเอียด</th>
                <th className="py-1.5 pr-2 text-right font-medium">จำนวน</th>
                <th className="py-1.5 pr-2 text-right font-medium">ราคา/หน่วย</th>
                <th className="py-1.5 text-right font-medium">รวม (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((it, i) => (
                <tr key={it.id} className="border-b last:border-b-0">
                  <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                  <td className="py-1.5 pr-2">{it.description}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtMoney(Number(it.quantity))}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtMoney(Number(it.unitPrice))}</td>
                  <td className="py-1.5 text-right">{fmtMoney(Number(it.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ml-auto max-w-72 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>รวมเป็นเงิน</span>
            <span>฿{fmtMoney(Number(doc.subtotal))}</span>
          </div>
          {Number(doc.discount) > 0 && (
            <div className="flex justify-between">
              <span>ส่วนลด</span>
              <span>-฿{fmtMoney(Number(doc.discount))}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>VAT {Number(doc.vatRate)}%</span>
            <span>฿{fmtMoney(Number(doc.vatAmount))}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>ยอดรวมทั้งสิ้น</span>
            <span>฿{fmtMoney(Number(doc.total))}</span>
          </div>
          {whtRate > 0 && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>หัก ณ ที่จ่าย {whtRate}%</span>
                <span>-฿{fmtMoney(Number(doc.whtAmount))}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>ยอดชำระสุทธิ</span>
                <span>฿{fmtMoney(netPayable)}</span>
              </div>
            </>
          )}
        </div>

        {doc.note && (
          <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">
            หมายเหตุ: {doc.note}
          </p>
        )}
      </div>

      <DocumentAttachments
        documentId={doc.id}
        attachments={doc.attachments.map((a) => ({ id: a.id, name: a.name, url: a.url }))}
      />
    </div>
  );
}
