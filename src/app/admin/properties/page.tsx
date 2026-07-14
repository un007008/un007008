import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "จัดการทรัพย์ — PropOS" };
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "outline" }> = {
  AVAILABLE: { label: "พร้อมขาย/เช่า", variant: "success" },
  RESERVED: { label: "ติดจอง", variant: "warning" },
  SOLD: { label: "ขายแล้ว", variant: "secondary" },
  RENTED: { label: "ปล่อยเช่าแล้ว", variant: "secondary" },
  HIDDEN: { label: "ซ่อน", variant: "outline" },
};

const TYPE_LABEL: Record<string, string> = {
  CONDO: "คอนโด",
  HOUSE: "บ้านเดี่ยว",
  TOWNHOUSE: "ทาวน์เฮาส์",
  COMMERCIAL: "อาคารพาณิชย์",
  LAND: "ที่ดิน",
};

function thb(n: unknown) {
  return Number(n).toLocaleString("th-TH");
}

export default async function PropertiesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin/properties");
  if (session.user.role !== "ADMIN") {
    return <p className="text-sm text-muted-foreground">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>;
  }

  const properties = await prisma.property.findMany({
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">ทรัพย์ ({properties.length})</h1>
        </div>
        <Button asChild>
          <Link href="/admin/properties/new">+ เพิ่มทรัพย์</Link>
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {properties.map((p) => {
          const title = (p.title as { th?: string } | null)?.th ?? p.refCode;
          const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.AVAILABLE;
          return (
            <Link
              key={p.id}
              href={`/admin/properties/${p.id}`}
              className="flex gap-3 rounded-lg border p-2.5 hover:bg-accent"
            >
              <div className="h-16 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                {p.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0].thumbUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{p.refCode}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                <p className="truncate text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">
                  {TYPE_LABEL[p.propertyType]}
                  {p.priceSale != null && ` · ขาย ${thb(p.priceSale)} บ.`}
                  {p.priceRent != null && ` · เช่า ${thb(p.priceRent)} บ./ด.`}
                  {p.featured && " · ⭐ แนะนำ"}
                </p>
              </div>
            </Link>
          );
        })}
        {properties.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground md:col-span-3">
            ยังไม่มีทรัพย์
          </p>
        )}
      </div>
    </div>
  );
}
