import { DocumentForm } from "@/components/accounting/document-form";
import { bangkokDayKey } from "@/lib/datetime";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "สร้างเอกสารบัญชี — PropOS" };

export default async function NewAccountingDocumentPage() {
  const contacts = await prisma.accContact.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">สร้างเอกสารบัญชี</h1>
      <DocumentForm contacts={contacts} todayBkk={bangkokDayKey(new Date())} />
    </div>
  );
}
