import { redirect } from "next/navigation";

import { BuilderClient } from "@/components/homepage-builder/builder-client";
import { auth } from "@/lib/auth";

export const metadata = { title: "ตั้งค่าหน้าแรก — PropOS" };

export default async function HomepageSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/settings/homepage");
  if (session.user.role !== "ADMIN") redirect("/admin");

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">ตั้งค่าหน้าแรกเว็บไซต์</h1>
        <p className="text-sm text-muted-foreground">
          ลากจัดลำดับ ติ๊กแสดง/ซ่อน แก้ข้อความ 3 ภาษา แล้วกดบันทึก
        </p>
      </div>
      <BuilderClient />
    </div>
  );
}
