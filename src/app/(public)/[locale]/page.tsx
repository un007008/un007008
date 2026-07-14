import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { PropertyCard } from "@/components/public/property-card";
import { prisma } from "@/lib/db";
import { LOCALES, UI, isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = isLocale(params.locale) ? params.locale : "th";
  const ui = UI[locale];
  return {
    title: `${ui.siteName} — ${ui.heroTitle}`,
    description: ui.heroSubtitle,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])),
    },
  };
}

export default async function HomePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const ui = UI[locale];

  const featured = await prisma.property.findMany({
    where: { status: "AVAILABLE", featured: true },
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });

  const latest = featured.length
    ? featured
    : await prisma.property.findMany({
        where: { status: "AVAILABLE" },
        include: { images: { orderBy: { order: "asc" }, take: 1 } },
        orderBy: { updatedAt: "desc" },
        take: 6,
      });

  return (
    <div>
      {/* hero */}
      <section className="bg-gradient-to-b from-amber-50 to-background px-4 py-14 text-center">
        <div className="mx-auto max-w-2xl space-y-4">
          <h1 className="text-2xl font-bold sm:text-4xl">{ui.heroTitle}</h1>
          <p className="text-sm text-muted-foreground sm:text-base">{ui.heroSubtitle}</p>
          <form action={`/${locale}/properties`} className="mx-auto flex max-w-md gap-2">
            <input
              name="q"
              placeholder={ui.searchPlaceholder}
              className="h-11 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
            />
            <button className="h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
              {ui.search}
            </button>
          </form>
        </div>
      </section>

      {/* featured */}
      <section className="mx-auto max-w-5xl space-y-4 px-4 py-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{ui.featured}</h2>
          <Link href={`/${locale}/properties`} className="text-sm text-amber-700 hover:underline">
            {ui.viewAll} →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {latest.map((p) => (
            <PropertyCard key={p.id} property={p} locale={locale} ui={ui} />
          ))}
        </div>
      </section>
    </div>
  );
}
