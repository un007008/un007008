import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export default async function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/admin");

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <nav className="flex gap-1 overflow-x-auto text-sm print:hidden">
        <Link
          href="/admin/accounting"
          className="shrink-0 whitespace-nowrap rounded-md border px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
        >
          ภาพรวมบัญชี
        </Link>
        <Link
          href="/admin/accounting/documents"
          className="shrink-0 whitespace-nowrap rounded-md border px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
        >
          เอกสาร
        </Link>
        <Link
          href="/admin/accounting/contacts"
          className="shrink-0 whitespace-nowrap rounded-md border px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
        >
          ผู้ติดต่อ
        </Link>
      </nav>
      {children}
    </div>
  );
}
