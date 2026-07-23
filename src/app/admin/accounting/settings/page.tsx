import { CompanyForm } from "@/components/accounting/company-form";

export const metadata = { title: "ตั้งค่าบัญชี — PropOS" };

export default function AccountingSettingsPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">ตั้งค่าบัญชี — ข้อมูลกิจการ</h1>
        <p className="text-sm text-muted-foreground">
          ข้อมูลผู้ออกเอกสาร จะแสดงบนหัวใบเสนอราคา ใบแจ้งหนี้ และใบเสร็จรับเงินทุกฉบับ
        </p>
      </div>
      <CompanyForm />
    </div>
  );
}
