import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/admin/sign-out-button";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  SALES: "ฝ่ายขาย",
  CR: "ลูกค้าสัมพันธ์",
  ACCOUNTANT: "บัญชี/การเงิน",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  // ACCOUNTANT sees only the accounting module (middleware enforces access;
  // this just keeps the nav clean)
  const accountingOnly = session.user.role === "ACCOUNTANT";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background print:hidden">
        <div className="flex h-14 items-center justify-between gap-2 px-4">
          <Link href="/admin" className="font-semibold">
            PropOS
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/admin/account" className="text-right text-sm leading-tight hover:underline">
              <div className="font-medium">{session.user.name}</div>
              <div className="text-xs text-muted-foreground">
                {ROLE_LABEL[session.user.role] ?? session.user.role}
              </div>
            </Link>
            <SignOutButton />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 text-sm">
          {accountingOnly && (
            <Link
              href="/admin/accounting"
              className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              บัญชี
            </Link>
          )}
          {!accountingOnly && (
          <>
          <Link
            href="/admin"
            className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            แดชบอร์ด
          </Link>
          <Link
            href="/admin/inbox"
            className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            กล่องข้อความ
          </Link>
          <Link
            href="/admin/leads"
            className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            ลูกค้ามุ่งหวัง
          </Link>
          <Link
            href="/admin/crm"
            className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            CRM
          </Link>
          <Link
            href="/admin/calendar"
            className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            ปฏิทิน
          </Link>
          <Link
            href="/admin/knowledge"
            className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
          >
            คลังความรู้ AI
          </Link>
          {session.user.role === "ADMIN" && (
            <Link
              href="/admin/properties"
              className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              ทรัพย์
            </Link>
          )}
          {session.user.role === "ADMIN" && (
            <>
              <Link
                href="/admin/accounting"
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              >
                บัญชี
              </Link>
              <Link
                href="/admin/settings/homepage"
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              >
                หน้าแรกเว็บ
              </Link>
              <Link
                href="/admin/media"
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              >
                คลังสื่อ
              </Link>
              <Link
                href="/admin/blog"
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              >
                บทความ
              </Link>
              <Link
                href="/admin/settings/users"
                className="shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
              >
                ผู้ใช้
              </Link>
            </>
          )}
          </>
          )}
        </nav>
      </header>
      <main className="flex-1 p-4">{children}</main>
    </div>
  );
}
