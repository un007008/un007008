import { AccContactsClient } from "@/components/accounting/contacts-client";

export const metadata = { title: "ผู้ติดต่อบัญชี — PropOS" };

export default function AccountingContactsPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">ผู้ติดต่อ (ลูกค้า / ผู้ขาย)</h1>
        <p className="text-sm text-muted-foreground">
          รายชื่อคู่ค้าสำหรับออกเอกสารบัญชี — ใบเสนอราคา ใบแจ้งหนี้ ใบเสร็จ และบันทึกค่าใช้จ่าย
        </p>
      </div>
      <AccContactsClient />
    </div>
  );
}
