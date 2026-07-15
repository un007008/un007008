import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BookingForm } from "@/components/public/booking-form";
import { Gallery } from "@/components/public/gallery";
import { thb } from "@/components/public/property-card";
import { prisma } from "@/lib/db";
import { LOCALES, UI, isLocale, t, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const locale = isLocale(params.locale) ? params.locale : "th";
  const property = await prisma.property.findUnique({ where: { slug: params.slug } });
  if (!property) return {};
  return {
    title: `${t(property.title, locale)} — ${UI[locale].siteName}`,
    description: t(property.description, locale).slice(0, 160),
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [l, `/${l}/properties/${params.slug}`])
      ),
    },
  };
}

export default async function PropertyDetailPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const ui = UI[locale];

  const property = await prisma.property.findUnique({
    where: { slug: params.slug },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!property || property.status === "HIDDEN") notFound();

  const lineUrl = process.env.NEXT_PUBLIC_LINE_OA_URL;
  const phone = process.env.NEXT_PUBLIC_CONTACT_PHONE;

  const specs: [string, string][] = [];
  if (property.bedrooms != null) specs.push([ui.bedrooms, String(property.bedrooms)]);
  if (property.bathrooms != null) specs.push([ui.bathrooms, String(property.bathrooms)]);
  if (property.areaSqm != null)
    specs.push([ui.area, `${property.areaSqm} ${locale === "th" ? "ตร.ม." : "sqm"}`]);
  if (property.floor != null) specs.push([ui.floorNo, String(property.floor)]);
  if (property.projectName) specs.push([ui.project, property.projectName]);
  if (property.district) specs.push([ui.district, property.district]);
  if (property.btsMrt) specs.push([ui.nearStation, property.btsMrt]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Gallery
            images={property.images.map((i) => ({ url: i.url, thumbUrl: i.thumbUrl }))}
            alt={t(property.title, locale)}
          />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{property.refCode}</p>
            <h1 className="text-xl font-bold">{t(property.title, locale)}</h1>
            <div className="text-lg font-semibold text-amber-700">
              {property.priceSale != null && (
                <div>
                  {ui.forSale} {thb(property.priceSale)} {ui.baht}
                </div>
              )}
              {property.priceRent != null && (
                <div>
                  {ui.forRent} {thb(property.priceRent)} {ui.bahtPerMonth}
                </div>
              )}
            </div>
          </div>
          {specs.length > 0 && (
            <div className="grid grid-cols-2 gap-2 rounded-xl border p-3 text-sm sm:grid-cols-3">
              {specs.map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="font-medium">{value}</div>
                </div>
              ))}
            </div>
          )}
          {t(property.description, locale) && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {t(property.description, locale)}
            </p>
          )}
          {property.lat != null && property.lng != null && (
            <div className="space-y-1.5">
              {/* free Google Maps embed — no API key required */}
              <iframe
                src={`https://maps.google.com/maps?q=${property.lat},${property.lng}&z=15&output=embed`}
                className="h-64 w-full rounded-xl border"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="map"
              />
              <a
                href={`https://www.google.com/maps?q=${property.lat},${property.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm text-amber-700 hover:underline"
              >
                📍 เปิดใน Google Maps →
              </a>
            </div>
          )}
        </div>

        {/* booking sidebar */}
        <div className="space-y-3">
          <div className="rounded-xl border p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold">{ui.bookViewing}</h2>
            <BookingForm propertyId={property.id} ui={ui} />
          </div>
          <div className="flex gap-2">
            {lineUrl && (
              <a
                href={lineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 flex-1 rounded-md bg-[#06C755] text-center text-sm font-medium leading-10 text-white"
              >
                {ui.chatLine}
              </a>
            )}
            {phone && (
              <a
                href={`tel:${phone}`}
                className="h-10 flex-1 rounded-md border text-center text-sm font-medium leading-10"
              >
                📞 {ui.call}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
