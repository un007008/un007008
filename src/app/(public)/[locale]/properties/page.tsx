import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

import { PropertyCard, thb } from "@/components/public/property-card";
import { SearchMap, type MapPin } from "@/components/public/search-map";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n";
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
  q?: string | string[];
  type?: string | string[];
  listing?: string | string[];
  min?: string | string[];
  max?: string | string[];
  page?: string | string[];
};

const PAGE_SIZE = 24;

const PROPERTY_TYPES = ["CONDO", "HOUSE", "TOWNHOUSE", "COMMERCIAL", "LAND"] as const;

// Next.js repeats a query param as string[] — take the first value
function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

// tolerate "5,000,000" / spaces; reject anything non-numeric (NaN crashes Prisma)
function parsePrice(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

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

  const q = first(searchParams.q)?.trim();
  const rawType = first(searchParams.type);
  const type = PROPERTY_TYPES.find((v) => v === rawType); // whitelist — anything else = ignore
  const listing = first(searchParams.listing);
  const min = parsePrice(first(searchParams.min));
  const max = parsePrice(first(searchParams.max));

  const priceRange = {
    ...(min != null ? { gte: min } : {}),
    ...(max != null ? { lte: max } : {}),
  };
  const priceFilter: Prisma.PropertyWhereInput[] =
    min == null && max == null
      ? []
      : listing === "RENT"
        ? [{ priceRent: priceRange }]
        : listing === "SALE"
          ? [{ priceSale: priceRange }]
          : // no listing selected — match on either price so rent-only listings aren't dropped
            [{ OR: [{ priceSale: priceRange }, { priceRent: priceRange }] }];

  const where: Prisma.PropertyWhereInput = {
    status: "AVAILABLE",
    ...(type ? { propertyType: type } : {}),
    ...(listing === "SALE"
      ? { listingType: { in: ["SALE", "SALE_AND_RENT"] } }
      : listing === "RENT"
        ? { listingType: { in: ["RENT", "SALE_AND_RENT"] } }
        : {}),
    AND: [
      ...priceFilter,
      ...(q
        ? [
            {
              OR: [
                { refCode: { contains: q, mode: "insensitive" as const } },
                { projectName: { contains: q, mode: "insensitive" as const } },
                { district: { contains: q, mode: "insensitive" as const } },
                { btsMrt: { contains: q, mode: "insensitive" as const } },
                { title: { path: ["th"], string_contains: q } },
                { title: { path: ["en"], string_contains: q } },
              ],
            },
          ]
        : []),
    ],
  };

  const pageRaw = Number(first(searchParams.page));
  const total = await prisma.property.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 ? Math.min(pageRaw, totalPages) : 1;

  const properties = await prisma.property.findMany({
    where,
    include: { images: { orderBy: { order: "asc" }, take: 1 } },
    orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (type) sp.set("type", type);
    if (listing) sp.set("listing", listing);
    if (first(searchParams.min)) sp.set("min", first(searchParams.min)!);
    if (first(searchParams.max)) sp.set("max", first(searchParams.max)!);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return `/${locale}/properties${qs ? `?${qs}` : ""}`;
  };

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
          defaultValue={first(searchParams.min) ?? ""}
          inputMode="numeric"
          placeholder={ui.priceMin}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <input
          name="max"
          defaultValue={first(searchParams.max) ?? ""}
          inputMode="numeric"
          placeholder={ui.priceMax}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        />
        <button className="col-span-2 h-9 rounded-md bg-primary text-sm font-medium text-primary-foreground md:col-span-6">
          {ui.search}
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        {ui.results}: {total}
        {totalPages > 1 && ` · ${page}/${totalPages}`}
      </p>

      <SearchMap
        locale={locale}
        toggleLabel={{ show: ui.showMap, hide: ui.hideMap }}
        pins={properties
          .filter((p): p is typeof p & { lat: number; lng: number } => p.lat != null && p.lng != null)
          .map(
            (p): MapPin => ({
              slug: p.slug,
              lat: p.lat,
              lng: p.lng,
              title: t(p.title, locale),
              priceLabel:
                p.priceSale != null
                  ? `${thb(p.priceSale)} ${ui.baht}`
                  : p.priceRent != null
                    ? `${thb(p.priceRent)} ${ui.bahtPerMonth}`
                    : "-",
            })
          )}
      />

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

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2 pt-2 text-sm">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="rounded-md border px-3 py-1.5 hover:bg-accent">
              ←
            </Link>
          ) : (
            <span className="rounded-md border px-3 py-1.5 text-muted-foreground/40">←</span>
          )}
          <span className="px-2 text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="rounded-md border px-3 py-1.5 hover:bg-accent">
              →
            </Link>
          ) : (
            <span className="rounded-md border px-3 py-1.5 text-muted-foreground/40">→</span>
          )}
        </nav>
      )}
    </div>
  );
}
