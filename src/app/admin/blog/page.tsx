import { redirect } from "next/navigation";

import { BlogAdminClient } from "@/components/blog/blog-admin-client";
import { auth } from "@/lib/auth";

export const metadata = { title: "บทความ — PropOS" };

export default async function BlogAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/blog");
  if (session.user.role !== "ADMIN") redirect("/admin");

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <div>
        <h1 className="text-lg font-semibold">บทความ</h1>
        <p className="text-sm text-muted-foreground">
          เขียนด้วย markdown — บทความที่เผยแพร่จะขึ้นหน้าเว็บ /blog ทั้ง 3 ภาษา
        </p>
      </div>
      <BlogAdminClient />
    </div>
  );
}
