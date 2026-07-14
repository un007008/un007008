import { redirect } from "next/navigation";

import { StageSelect } from "@/components/leads/stage-select";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "ลูกค้ามุ่งหวัง — PropOS" };
export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  CHAT: "แชท",
  WEBSITE_FORM: "ฟอร์มเว็บ",
  MANUAL: "เพิ่มเอง",
};

const INTEREST_LABEL: Record<string, string> = {
  SALE: "ซื้อ",
  RENT: "เช่า",
  SALE_AND_RENT: "ซื้อ/เช่า",
};

function thb(n: unknown) {
  return Number(n).toLocaleString("th-TH");
}

export default async function LeadsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/leads");

  // ADMIN sees everything; SALES/CR only their assigned leads
  const leads = await prisma.lead.findMany({
    where: session.user.role === "ADMIN" ? {} : { assignedTo: session.user.id },
    include: { contact: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const propertyIds = leads.map((l) => l.propertyId).filter(Boolean) as string[];
  const properties = propertyIds.length
    ? await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        select: { id: true, refCode: true },
      })
    : [];
  const propertyRef = new Map(properties.map((p) => [p.id, p.refCode]));

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">ลูกค้ามุ่งหวัง (Leads)</h1>
        <p className="text-sm text-muted-foreground">
          ทั้งหมด {leads.length} รายการ — kanban เต็มรูปแบบจะมาใน Phase 3
        </p>
      </div>

      {/* mobile: cards */}
      <div className="space-y-2 md:hidden">
        {leads.map((l) => (
          <div key={l.id} className="space-y-1.5 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {l.contact.name ?? "ไม่ระบุชื่อ"}
              </span>
              <StageSelect leadId={l.id} stage={l.stage} />
            </div>
            <div className="text-xs text-muted-foreground">
              {l.contact.phone ?? "—"} · {SOURCE_LABEL[l.source]}
              {l.interest ? ` · ${INTEREST_LABEL[l.interest]}` : ""}
              {l.budgetMax != null ? ` · งบ ≤ ${thb(l.budgetMax)} บ.` : ""}
            </div>
            {l.note && <p className="text-xs">{l.note}</p>}
            <div className="text-[10px] text-muted-foreground">
              ผู้ดูแล: {l.assignedTo ? (userName.get(l.assignedTo) ?? "—") : "ยังไม่มอบหมาย"} ·{" "}
              {new Date(l.createdAt).toLocaleDateString("th-TH")}
            </div>
          </div>
        ))}
        {leads.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            ยังไม่มี Lead — สร้างได้จากปุ่ม &quot;แปลงเป็น Lead&quot; ในกล่องข้อความ
          </p>
        )}
      </div>

      {/* desktop: table */}
      <div className="hidden overflow-x-auto rounded-lg border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">ลูกค้า</th>
              <th className="px-3 py-2 font-medium">เบอร์โทร</th>
              <th className="px-3 py-2 font-medium">ที่มา</th>
              <th className="px-3 py-2 font-medium">สนใจ</th>
              <th className="px-3 py-2 font-medium">งบประมาณ</th>
              <th className="px-3 py-2 font-medium">ทรัพย์</th>
              <th className="px-3 py-2 font-medium">สถานะ</th>
              <th className="px-3 py-2 font-medium">ผู้ดูแล</th>
              <th className="px-3 py-2 font-medium">วันที่</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-t">
                <td className="px-3 py-2 font-medium">{l.contact.name ?? "ไม่ระบุชื่อ"}</td>
                <td className="px-3 py-2">{l.contact.phone ?? "—"}</td>
                <td className="px-3 py-2">{SOURCE_LABEL[l.source]}</td>
                <td className="px-3 py-2">{l.interest ? INTEREST_LABEL[l.interest] : "—"}</td>
                <td className="px-3 py-2">
                  {l.budgetMin != null || l.budgetMax != null
                    ? `${l.budgetMin != null ? thb(l.budgetMin) : ""}${l.budgetMin != null && l.budgetMax != null ? "–" : ""}${l.budgetMax != null ? thb(l.budgetMax) : ""} บ.`
                    : "—"}
                </td>
                <td className="px-3 py-2">
                  {l.propertyId ? (propertyRef.get(l.propertyId) ?? "—") : "—"}
                </td>
                <td className="px-3 py-2">
                  <StageSelect leadId={l.id} stage={l.stage} />
                </td>
                <td className="px-3 py-2">
                  {l.assignedTo ? (userName.get(l.assignedTo) ?? "—") : "ยังไม่มอบหมาย"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(l.createdAt).toLocaleDateString("th-TH")}
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                  ยังไม่มี Lead — สร้างได้จากปุ่ม &quot;แปลงเป็น Lead&quot; ในกล่องข้อความ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
