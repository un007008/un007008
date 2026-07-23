import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PrintButton } from "@/components/accounting/print-button";
import { fmtMoney } from "@/lib/accounting";
import { getCompanyProfile } from "@/lib/company";
import { fmtBangkokDate } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "หนังสือรับรองหัก ณ ที่จ่าย — PropOS" };

export default async function WhtCertificatePage({
  params,
}: {
  params: { id: string };
}) {
  const [doc, company] = await Promise.all([
    prisma.accDocument.findUnique({
      where: { id: params.id },
      include: { items: { orderBy: { order: "asc" } }, contact: true },
    }),
    getCompanyProfile(),
  ]);
  if (!doc) notFound();
  if (doc.docType !== "EXPENSE" || Number(doc.whtAmount) <= 0) {
    redirect(`/admin/accounting/documents/${doc.id}`);
  }

  const paidBase = Number(doc.subtotal) - Number(doc.discount);
  const wht = Number(doc.whtAmount);
  const payDate = doc.paidAt ?? doc.issueDate;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <h1 className="text-lg font-semibold">หนังสือรับรองหัก ณ ที่จ่าย — {doc.docNumber}</h1>
        <div className="flex items-center gap-1.5">
          <PrintButton />
          <Link
            href={`/admin/accounting/documents/${doc.id}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            กลับ
          </Link>
        </div>
      </div>

      <div className="rounded-lg border p-4 text-sm sm:p-6 print:border-0 print:p-0">
        <p className="text-center text-base font-bold">
          หนังสือรับรองการหักภาษี ณ ที่จ่าย
        </p>
        <p className="text-center text-xs text-muted-foreground">
          ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร
        </p>

        <div className="mt-4 space-y-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">
              ผู้มีหน้าที่หักภาษี ณ ที่จ่าย (ผู้จ่ายเงิน)
            </p>
            <p className="font-medium">{company.name || "— ยังไม่ได้ตั้งค่าข้อมูลกิจการ —"}</p>
            {company.taxId && (
              <p>
                เลขประจำตัวผู้เสียภาษี {company.taxId}
                {company.branch ? ` (${company.branch})` : ""}
              </p>
            )}
            {company.address && <p>{company.address}</p>}
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">ผู้ถูกหักภาษี ณ ที่จ่าย (ผู้รับเงิน)</p>
            <p className="font-medium">{doc.contact.name}</p>
            {doc.contact.taxId && (
              <p>
                เลขประจำตัวผู้เสียภาษี {doc.contact.taxId}
                {doc.contact.branch ? ` (${doc.contact.branch})` : ""}
              </p>
            )}
            {doc.contact.address && <p>{doc.contact.address}</p>}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-2 font-medium">ประเภทเงินได้ที่จ่าย</th>
                  <th className="py-1.5 pr-2 text-right font-medium">วันที่จ่าย</th>
                  <th className="py-1.5 pr-2 text-right font-medium">จำนวนเงินที่จ่าย</th>
                  <th className="py-1.5 text-right font-medium">
                    ภาษีที่หัก ({Number(doc.whtRate)}%)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-1.5 pr-2">
                    {doc.items.map((it) => it.description).join(", ")}
                    <span className="text-muted-foreground"> (อ้างอิง {doc.docNumber})</span>
                  </td>
                  <td className="py-1.5 pr-2 text-right">{fmtBangkokDate(payDate)}</td>
                  <td className="py-1.5 pr-2 text-right">{fmtMoney(paidBase)}</td>
                  <td className="py-1.5 text-right">{fmtMoney(wht)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={2} className="py-1.5 pr-2">
                    รวม
                  </td>
                  <td className="py-1.5 pr-2 text-right">{fmtMoney(paidBase)}</td>
                  <td className="py-1.5 text-right">{fmtMoney(wht)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p>
            ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ
          </p>

          <div className="mt-8 grid grid-cols-2 gap-6 text-center text-sm">
            <div>
              <div className="mx-auto w-48 border-b" />
              <p className="mt-1">ผู้จ่ายเงิน</p>
              <p className="text-xs text-muted-foreground">
                วันที่ {fmtBangkokDate(payDate)}
              </p>
            </div>
            <div>
              <div className="mx-auto w-48 border-b" />
              <p className="mt-1">ผู้รับเงิน</p>
              <p className="text-xs text-muted-foreground">วันที่ ..........................</p>
            </div>
          </div>

          <p className="pt-2 text-xs text-muted-foreground">
            * แบบฟอร์มอย่างย่อสำหรับใช้ภายใน — การยื่น ภ.ง.ด.3/53 อย่างเป็นทางการ
            กรุณาตรวจสอบกับนักบัญชี
          </p>
        </div>
      </div>
    </div>
  );
}
