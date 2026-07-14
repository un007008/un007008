import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

import { PropertyCard } from "@/components/public/property-card";
import { prisma } from "@/lib/db";
import { LOCALES, UI, isLocale, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = isLocale(params.locale) ? params.locale : "th";
  const ui = UI[locale];
  return {
    title: `${ui.properties} — ${ui.siteName}`,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/properties`])),
    },
  };
}

type Search = {
  q?: string;
  type?: string;
  listing?: string;
  min?: string;
  max?: string;
};

export default async function PropertiesPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams: Search;
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const ui = UI[locale];

  const q = searchParams.q?.trim();
  const type = searchParams.type;
  const listing = searchParams.listing;
  const min = searchParams.min ? Number(searchParams.min) : null;
  const max = searchParams.max ? Number(searchParams.max) : null;

  const priceField = listing === "RENT" ? "priceRent" : "priceSale";

  const where: Prisma.PropertyWhereInput = {
    status: "AVAILABLE",
    ...(type ? { propertyType: type as Prisma.PropertyWhereInput["propertyType"] } : {}),
    ...(listing === "SALE"
      ? { listingType: { in: ["SALE", "SALE_AND_RENT"] } }
      : listing === "RENT"
        ? { listingType: { in: ["RENT", "SALE_AND_RENT"] } }
        : {}),
    ...(min != null || max != null
      ? {
          [priceField]: {
            ...(min != null ? { gte: min } : {}),
            ...(max != null ? { lte: max } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { refCode: { contains: q, mode: "insensitive" } },
            { projectName: { contains: q, mode: "insensitive" } },
            { district: { contains: q, mode: "insensitive" } },
            { btsMrt: { contains: q, mode: "insensitive" } },
            { title: { path: ["th"], string_contains: q } },
            { title: { path: ["en"], string_contains: q } },
          ],
        }
      : {}),
  };

  const properties = await prisma.property.findMany({
    where,
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    take: 60,
  });

  const TYPE_OPTIONS = [
    ["", ui.all],
    ["CONDO", ui.condo],
    ["HOUSE", ui.house],
    ["TOWNHOUSE", ui.townhouse],
    ["COMMERCIAL", ui.commercial],
    ["LAND", ui.land],
  ] as const;

  const LISTING_OPTIONS = [
    ["", ui.all],
    ["SALE", ui.forSale],
    ["RENT", ui.forRent],
  ] as const;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <h1 className="text-lg font-semibold">{ui.properties}</h1>

      {/* filters — plain GET form, works without JS */}
      <form className="grid grid-cols-2 gap-2 rounded-xl border p-3 md:grid-cols-6">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={ui.searchPlaceholder}
          className="col-span-2 h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <select
          name="type"
          defaultValue={type ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {TYPE_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>
              {v === "" ? ui.propertyType : label}
            </option>
          ))}
        </select>
        <select
          name="listing"
          defaultValue={listing ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {LISTING_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>
              {v === "" ? ui.listingType : label}
            </option>
          ))}
        </select>
        <input
          name="min"
          defaultValue={searchParams.min ?? ""}
          inputMode="numeric"
          placeholder={ui.priceMin}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="max"
          defaultValue={searchParams.max ?? ""}
          inputMode="numeric"
          placeholder={ui.priceMax}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <button className="col-span-2 h-9 rounded-md bg-primary text-sm font-medium text-primary-foreground md:col-span-6">
          {ui.search}
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        {ui.results}: {properties.length}
      </p>

      {properties.length === 0 ? (
        <p className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
          {ui.noResults}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((p) => (
            <PropertyCard key={p.id} property={p} locale={locale} ui={ui} />
          ))}
        </div>
      )}
    </div>
  );
}
