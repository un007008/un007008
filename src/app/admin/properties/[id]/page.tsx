import { notFound, redirect } from "next/navigation";

import { PropertyForm, type PropertyFormData } from "@/components/properties/property-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata = { title: "แก้ไขทรัพย์ — PropOS" };
export const dynamic = "force-dynamic";

export default async function EditPropertyPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=/admin/properties/${params.id}`);
  if (session.user.role !== "ADMIN") redirect("/admin");

  const p = await prisma.property.findUnique({
    where: { id: params.id },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!p) notFound();

  const lang = (v: unknown) => {
    const o = (v ?? {}) as Record<string, string>;
    return { th: o.th ?? "", en: o.en ?? "", zh: o.zh ?? "" };
  };

  const initial: PropertyFormData = {
    id: p.id,
    refCode: p.refCode,
    status: p.status,
    listingType: p.listingType,
    propertyType: p.propertyType,
    title: lang(p.title),
    description: lang(p.description),
    priceSale: p.priceSale?.toString() ?? "",
    priceRent: p.priceRent?.toString() ?? "",
    bedrooms: p.bedrooms?.toString() ?? "",
    bathrooms: p.bathrooms?.toString() ?? "",
    areaSqm: p.areaSqm?.toString() ?? "",
    floor: p.floor?.toString() ?? "",
    projectName: p.projectName ?? "",
    district: p.district ?? "",
    btsMrt: p.btsMrt ?? "",
    lat: p.lat?.toString() ?? "",
    lng: p.lng?.toString() ?? "",
    featured: p.featured,
    images: p.images.map((i) => ({ id: i.id, url: i.url, thumbUrl: i.thumbUrl, order: i.order })),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <h1 className="text-lg font-semibold">
        แก้ไขทรัพย์ {p.refCode}
      </h1>
      <PropertyForm initial={initial} />
    </div>
  );
}
