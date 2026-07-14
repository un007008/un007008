import Link from "next/link";
import type { Property, PropertyImage } from "@prisma/client";

import { t, type Locale, type UIStrings } from "@/lib/i18n";

export function thb(n: unknown) {
  return Number(n).toLocaleString("th-TH");
}

export function PropertyCard({
  property,
  locale,
  ui,
}: {
  property: Property & { images: PropertyImage[] };
  locale: Locale;
  ui: UIStrings;
}) {
  const listingLabel =
    property.listingType === "SALE"
      ? ui.forSale
      : property.listingType === "RENT"
        ? ui.forRent
        : ui.saleAndRent;

  return (
    <Link
      href={`/${locale}/properties/${property.slug}`}
      className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {property.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={property.images[0].thumbUrl}
            alt={t(property.title, locale)}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">🏠</div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs text-white">
          {listingLabel}
        </span>
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-medium">{t(property.title, locale)}</p>
        <p className="text-xs text-muted-foreground">
          {[property.district, property.btsMrt && `${ui.nearStation} ${property.btsMrt}`]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="pt-1 text-sm font-semibold text-amber-700">
          {property.priceSale != null && (
            <div>
              {thb(property.priceSale)} {ui.baht}
            </div>
          )}
          {property.priceRent != null && (
            <div>
              {thb(property.priceRent)} {ui.bahtPerMonth}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {[
            property.bedrooms != null && `${property.bedrooms} ${ui.bedrooms}`,
            property.bathrooms != null && `${property.bathrooms} ${ui.bathrooms}`,
            property.areaSqm != null && `${property.areaSqm} ${locale === "th" ? "ตร.ม." : "sqm"}`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
