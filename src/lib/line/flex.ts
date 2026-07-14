import type { messagingApi } from "@line/bot-sdk";
import type { Property, PropertyImage } from "@prisma/client";

type PropertyWithImages = Property & { images: PropertyImage[] };

const LISTING_LABEL: Record<string, string> = {
  SALE: "ขาย",
  RENT: "เช่า",
  SALE_AND_RENT: "ขาย/เช่า",
};

function thb(n: unknown): string {
  return Number(n).toLocaleString("th-TH");
}

/** Build a LINE Flex Message property card. */
export function propertyFlexMessage(
  property: PropertyWithImages,
  siteUrl: string
): messagingApi.FlexMessage {
  const title =
    (property.title as { th?: string } | null)?.th ?? property.refCode;
  const priceLines: string[] = [];
  if (property.priceSale != null) priceLines.push(`ราคาขาย ${thb(property.priceSale)} บาท`);
  if (property.priceRent != null) priceLines.push(`ค่าเช่า ${thb(property.priceRent)} บาท/เดือน`);

  const specs = [
    property.bedrooms != null ? `${property.bedrooms} นอน` : null,
    property.bathrooms != null ? `${property.bathrooms} น้ำ` : null,
    property.areaSqm != null ? `${property.areaSqm} ตร.ม.` : null,
    property.btsMrt,
  ]
    .filter(Boolean)
    .join(" · ");

  const heroUrl = property.images[0]?.url;
  const detailUrl = `${siteUrl}/properties/${property.slug}`;

  return {
    type: "flex",
    altText: `${title} — ${priceLines[0] ?? property.refCode}`,
    contents: {
      type: "bubble",
      ...(heroUrl
        ? {
            hero: {
              type: "image",
              url: heroUrl,
              size: "full",
              aspectRatio: "20:13",
              aspectMode: "cover",
            },
          }
        : {}),
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "text",
            text: `${LISTING_LABEL[property.listingType] ?? ""} · ${property.refCode}`,
            size: "xs",
            color: "#888888",
          },
          { type: "text", text: title, weight: "bold", size: "md", wrap: true },
          ...(specs
            ? [{ type: "text" as const, text: specs, size: "sm" as const, color: "#555555", wrap: true }]
            : []),
          ...priceLines.map((line) => ({
            type: "text" as const,
            text: line,
            size: "sm" as const,
            weight: "bold" as const,
            color: "#B45309",
          })),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            action: { type: "uri", label: "ดูรายละเอียด", uri: detailUrl },
          },
        ],
      },
    },
  };
}
