import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";

export default async function AdminDashboardPage() {
  const session = await auth();
  const [propertyCount, contactCount, leadCount, knowledgeCount] =
    await Promise.all([
      prisma.property.count(),
      prisma.contact.count(),
      prisma.lead.count(),
      prisma.knowledgeEntry.count({ where: { active: true } }),
    ]);

  const stats = [
    { label: "ทรัพย์ทั้งหมด", value: propertyCount },
    { label: "ผู้ติดต่อ", value: contactCount },
    { label: "ลูกค้ามุ่งหวัง", value: leadCount },
    { label: "คลังความรู้ AI", value: knowledgeCount },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">
          สวัสดี {session?.user.name} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          ภาพรวมระบบ ณ ตอนนี้ (แดชบอร์ดเต็มรูปแบบจะมาใน Phase 4)
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="p-4 pb-1">
              <CardDescription>{s.label}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <CardTitle className="text-2xl">{s.value}</CardTitle>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
