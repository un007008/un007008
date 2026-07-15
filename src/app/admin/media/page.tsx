import { redirect } from "next/navigation";

import { MediaClient } from "@/components/media/media-client";
import { auth } from "@/lib/auth";

export const metadata = { title: "คลังสื่อ — PropOS" };

export default async function MediaPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/media");
  if (session.user.role !== "ADMIN") redirect("/admin");

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">คลังสื่อ</h1>
        <p className="text-sm text-muted-foreground">
          อัปโหลดรูป/ไฟล์เพื่อใช้ในบทความและหน้าเว็บ — รูปถูกแปลงเป็น WebP อัตโนมัติ
        </p>
      </div>
      <MediaClient />
    </div>
  );
}
