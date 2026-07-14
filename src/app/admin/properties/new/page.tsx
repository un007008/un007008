import { redirect } from "next/navigation";

import { PropertyForm } from "@/components/properties/property-form";
import { auth } from "@/lib/auth";

export const metadata = { title: "เพิ่มทรัพย์ — PropOS" };

export default async function NewPropertyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/properties/new");
  if (session.user.role !== "ADMIN") redirect("/admin");

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="text-lg font-semibold">เพิ่มทรัพย์ใหม่</h1>
      <PropertyForm initial={null} />
    </div>
  );
}
