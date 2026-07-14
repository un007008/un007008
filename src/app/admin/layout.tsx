import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/admin/sign-out-button";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  SALES: "ฝ่ายขาย",
  CR: "ลูกค้าสัมพันธ์",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link href="/admin" className="font-semibold">
            PropOS
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm leading-tight">
              <div className="font-medium">{session.user.name}</div>
              <div className="text-xs text-muted-foreground">
                {ROLE_LABEL[session.user.role] ?? session.user.role}
              </div>
            </div>
            <SignOutButton />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 text-sm">
          <Link
            href="/admin"
            className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            แดชบอร์ด
          </Link>
          <Link
            href="/admin/inbox"
            className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            กล่องข้อความ
          </Link>
          <Link
            href="/admin/leads"
            className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            ลูกค้ามุ่งหวัง
          </Link>
          <Link
            href="/admin/knowledge"
            className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            คลังความรู้ AI
          </Link>
          {session.user.role === "ADMIN" && (
            <Link
              href="/admin/properties"
              className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              ทรัพย์
            </Link>
          )}
        </nav>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
