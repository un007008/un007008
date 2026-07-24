import { DocumentForm, type DocumentFormPrefill } from "@/components/accounting/document-form";
import { bangkokDayKey } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "สร้างเอกสารบัญชี — PropOS" };

/** Build an invoice prefill from a CRM deal (?dealId=...). Reuses an
 *  AccContact with the same name or creates one from the CRM contact. */
async function dealPrefill(dealId: string): Promise<DocumentFormPrefill | undefined> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { lead: { include: { contact: true } } },
  });
  if (!deal) return undefined;

  const property = await prisma.property.findUnique({
    where: { id: deal.propertyId },
    select: { refCode: true, projectName: true },
  });
  const crmContact = deal.lead.contact;
  const name = crmContact.name?.trim() || "ลูกค้าไม่ระบุชื่อ";

  const accContact =
    (await prisma.accContact.findFirst({ where: { name } })) ??
    (await prisma.accContact.create({
      data: {
        type: "CUSTOMER",
        name,
        phone: crmContact.phone,
        email: crmContact.email,
        note: "สร้างอัตโนมัติจาก CRM",
      },
    }));

  const propertyLabel = [property?.refCode, property?.projectName].filter(Boolean).join(" ");
  return {
    docType: "INVOICE",
    contactId: accContact.id,
    items: [
      {
        description:
          deal.dealType === "RENT"
            ? `ค่าเช่า${propertyLabel ? ` ${propertyLabel}` : ""}`
            : `ค่านายหน้าขายทรัพย์${propertyLabel ? ` ${propertyLabel}` : ""}`,
        quantity: "1",
        unitPrice: String(Number(deal.amount)),
      },
    ],
    note: `อ้างอิง Deal${propertyLabel ? ` ทรัพย์ ${propertyLabel}` : ""} (แก้ไขมูลค่าตามจริงก่อนออกเอกสาร)`,
  };
}

/** Build a credit/debit-note prefill from an existing invoice (?refDoc=...). */
async function refDocPrefill(
  refDocId: string,
  docType: string
): Promise<DocumentFormPrefill | undefined> {
  if (docType !== "CREDIT_NOTE" && docType !== "DEBIT_NOTE") return undefined;
  const refDoc = await prisma.accDocument.findUnique({
    where: { id: refDocId },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!refDoc) return undefined;
  return {
    docType,
    contactId: refDoc.contactId,
    refDocId: refDoc.id,
    items: refDoc.items.map((it) => ({
      description: it.description,
      quantity: String(Number(it.quantity)),
      unitPrice: String(Number(it.unitPrice)),
    })),
    note: `${docType === "CREDIT_NOTE" ? "ลดหนี้" : "เพิ่มหนี้"}อ้างอิงใบแจ้งหนี้ ${refDoc.docNumber}`,
  };
}

export default async function NewAccountingDocumentPage({
  searchParams,
}: {
  searchParams: { dealId?: string; refDoc?: string; docType?: string };
}) {
  const prefill = searchParams.dealId
    ? await dealPrefill(searchParams.dealId)
    : searchParams.refDoc
      ? await refDocPrefill(searchParams.refDoc, searchParams.docType ?? "")
      : undefined;
  const contacts = await prisma.accContact.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">สร้างเอกสารบัญชี</h1>
      {prefill && (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-800">
          {prefill.refDocId
            ? "คัดลอกรายการจากใบแจ้งหนี้ต้นทางให้แล้ว — แก้ไขรายการ/มูลค่าให้เหลือเฉพาะส่วนที่ลด/เพิ่มก่อนออกเอกสาร"
            : "เติมข้อมูลจาก Deal ใน CRM ให้แล้ว — ตรวจสอบรายการและมูลค่า (โดยเฉพาะค่านายหน้า) ก่อนออกเอกสาร"}
        </p>
      )}
      <DocumentForm
        contacts={contacts}
        prefill={prefill}
        todayBkk={bangkokDayKey(new Date())}
      />
    </div>
  );
}
