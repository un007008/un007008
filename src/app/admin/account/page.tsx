import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/users/change-password-form";
import { auth } from "@/lib/auth";

export const metadata = { title: "บัญชีของฉัน — PropOS" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/account");

  return (
    <div className="mx-auto max-w-md space-y-3">
      <div>
        <h1 className="text-lg font-semibold">บัญชีของฉัน</h1>
        <p className="text-sm text-muted-foreground">
          {session.user.name} · {session.user.email}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
