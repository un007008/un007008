import { KnowledgeClient } from "@/components/knowledge/knowledge-client";

export const metadata = { title: "คลังความรู้ AI — PropOS" };

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div>
        <h1 className="text-lg font-semibold">คลังความรู้ AI (Knowledge Base)</h1>
        <p className="text-sm text-muted-foreground">
          คำถาม-คำตอบที่ AI ใช้ตอบลูกค้าใน LINE อัตโนมัติ — รายการที่ปิดใช้งานจะไม่ถูกนำไปตอบ
        </p>
      </div>
      <KnowledgeClient />
    </div>
  );
}
