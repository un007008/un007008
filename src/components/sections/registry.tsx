import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { PropertyCard } from "@/components/public/property-card";
import { prisma } from "@/lib/db";
import { UI, t, type Locale } from "@/lib/i18n";
import type { SectionConfig } from "@/lib/sections/schema";

type Ctx = { locale: Locale; section: SectionConfig };

function SectionShell({
  section,
  locale,
  children,
}: Ctx & { children: React.ReactNode }) {
  const title = t(section.title, locale);
  const subtitle = t(section.subtitle, locale);
  return (
    <section className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      {title && (
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

async function PropertyGrid({
  locale,
  where,
}: {
  locale: Locale;
  where: Prisma.PropertyWhereInput;
}) {
  const properties = await prisma.property.findMany({
    where,
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: 6,
  });
  if (properties.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((p) => (
        <PropertyCard key={p.id} property={p} locale={locale} ui={UI[locale]} />
      ))}
    </div>
  );
}

async function Hero({ locale, section }: Ctx) {
  const ui = UI[locale];
  return (
    <section className="bg-gradient-to-b from-amber-50 to-background px-4 py-14 text-center">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold sm:text-4xl">{t(section.title, locale)}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {t(section.subtitle, locale)}
        </p>
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
  );
}

async function PropertyTypes({ locale, section }: Ctx) {
  const ui = UI[locale];
  const counts = await prisma.property.groupBy({
    by: ["propertyType"],
    where: { status: "AVAILABLE" },
    _count: true,
  });
  const countMap = new Map(counts.map((c) => [c.propertyType, c._count]));
  const items = [
    ["CONDO", ui.condo, "🏢"],
    ["HOUSE", ui.house, "🏡"],
    ["TOWNHOUSE", ui.townhouse, "🏘️"],
    ["COMMERCIAL", ui.commercial, "🏬"],
    ["LAND", ui.land, "🗺️"],
  ] as const;
  return (
    <SectionShell locale={locale} section={section}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {items.map(([type, label, icon]) => (
          <Link
            key={type}
            href={`/${locale}/properties?type=${type}`}
            className="rounded-xl border p-3 text-center hover:bg-accent"
          >
            <div className="text-2xl">{icon}</div>
            <div className="mt-1 text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground">{countMap.get(type) ?? 0}</div>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

async function PopularLocations({ locale, section }: Ctx) {
  const rows = await prisma.property.groupBy({
    by: ["district"],
    where: { status: "AVAILABLE", district: { not: null } },
    _count: true,
    orderBy: { _count: { district: "desc" } },
    take: 8,
  });
  if (rows.length === 0) return null;
  return (
    <SectionShell locale={locale} section={section}>
      <div className="flex flex-wrap gap-2">
        {rows.map((r) => (
          <Link
            key={r.district}
            href={`/${locale}/properties?q=${encodeURIComponent(r.district!)}`}
            className="rounded-full border px-4 py-1.5 text-sm hover:bg-accent"
          >
            📍 {r.district} <span className="text-muted-foreground">({r._count})</span>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

async function FeaturedProperties({ locale, section }: Ctx) {
  return (
    <SectionShell locale={locale} section={section}>
      <PropertyGrid locale={locale} where={{ status: "AVAILABLE", featured: true }} />
    </SectionShell>
  );
}

async function ForSale({ locale, section }: Ctx) {
  return (
    <SectionShell locale={locale} section={section}>
      <PropertyGrid
        locale={locale}
        where={{ status: "AVAILABLE", listingType: { in: ["SALE", "SALE_AND_RENT"] } }}
      />
    </SectionShell>
  );
}

async function ForRent({ locale, section }: Ctx) {
  return (
    <SectionShell locale={locale} section={section}>
      <PropertyGrid
        locale={locale}
        where={{ status: "AVAILABLE", listingType: { in: ["RENT", "SALE_AND_RENT"] } }}
      />
    </SectionShell>
  );
}

async function PromotionBanner({ locale, section }: Ctx) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-4">
      <div className="rounded-2xl bg-amber-100 p-6 text-center sm:p-8">
        <h2 className="text-lg font-bold text-amber-900">{t(section.title, locale)}</h2>
        <p className="mt-1 text-sm text-amber-800">{t(section.subtitle, locale)}</p>
        {section.buttonUrl && section.buttonLabel && (
          <a
            href={section.buttonUrl}
            className="mt-3 inline-block rounded-lg bg-amber-700 px-5 py-2 text-sm font-medium text-white"
          >
            {t(section.buttonLabel, locale)}
          </a>
        )}
      </div>
    </section>
  );
}

async function Cta({ locale, section }: Ctx) {
  const url = section.buttonUrl || process.env.NEXT_PUBLIC_LINE_OA_URL || "#";
  return (
    <section className="mx-auto max-w-5xl px-4 py-8">
      <div className="rounded-2xl bg-primary p-8 text-center text-primary-foreground">
        <h2 className="text-xl font-bold">{t(section.title, locale)}</h2>
        <p className="mt-1 text-sm opacity-80">{t(section.subtitle, locale)}</p>
        {section.buttonLabel && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-lg bg-[#06C755] px-6 py-2.5 text-sm font-medium text-white"
          >
            {t(section.buttonLabel, locale)}
          </a>
        )}
      </div>
    </section>
  );
}

export const SECTION_REGISTRY = {
  hero: Hero,
  propertyTypes: PropertyTypes,
  popularLocations: PopularLocations,
  featuredProperties: FeaturedProperties,
  forSale: ForSale,
  forRent: ForRent,
  promotionBanner: PromotionBanner,
  cta: Cta,
} as const;
