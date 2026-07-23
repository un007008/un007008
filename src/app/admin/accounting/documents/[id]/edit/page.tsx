import { notFound, redirect } from "next/navigation";

import { DocumentForm } from "@/components/accounting/document-form";
import { bangkokDayKey } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "แก้ไขเอกสารบัญชี — PropOS" };

export default async function EditAccountingDocumentPage({
  params,
}: {
  params: { id: string };
}) {
  const doc = await prisma.accDocument.findUnique({
    where: { id: params.id },
    include: { items: { orderBy: { order: "asc" } } },
  });
  if (!doc) notFound();
  if (doc.status !== "DRAFT") redirect(`/admin/accounting/documents/${doc.id}`);

  const contacts = await prisma.accContact.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">แก้ไขเอกสารร่าง {doc.docNumber}</h1>
      <DocumentForm
        contacts={contacts}
        todayBkk={bangkokDayKey(new Date())}
        initial={{
          id: doc.id,
          docType: doc.docType,
          contactId: doc.contactId,
          issueDate: bangkokDayKey(doc.issueDate),
          dueDate: doc.dueDate ? bangkokDayKey(doc.dueDate) : "",
          items: doc.items.map((it) => ({
            description: it.description,
            quantity: String(Number(it.quantity)),
            unitPrice: String(Number(it.unitPrice)),
          })),
          discount: Number(doc.discount),
          vatRate: Number(doc.vatRate),
          whtRate: Number(doc.whtRate),
          note: doc.note ?? "",
        }}
      />
    </div>
  );
}
