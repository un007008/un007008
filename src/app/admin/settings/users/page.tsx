import { redirect } from "next/navigation";

import { UsersClient } from "@/components/users/users-client";
import { auth } from "@/lib/auth";

export const metadata = { title: "จัดการผู้ใช้ — PropOS" };

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/settings/users");
  if (session.user.role !== "ADMIN") redirect("/admin");

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div>
        <h1 className="text-lg font-semibold">จัดการผู้ใช้ทีมงาน</h1>
        <p className="text-sm text-muted-foreground">
          ADMIN เห็นทุกอย่าง · ฝ่ายขาย/ลูกค้าสัมพันธ์ เห็นกล่องข้อความและ Lead ที่ได้รับมอบหมาย
        </p>
      </div>
      <UsersClient selfId={session.user.id} />
    </div>
  );
}
