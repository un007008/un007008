import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db";
import { LOCALES } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const properties = await prisma.property.findMany({
    where: { status: { not: "HIDDEN" } },
    select: { slug: true, updatedAt: true },
  });

  const entries: MetadataRoute.Sitemap = [];
  for (const locale of LOCALES) {
    entries.push({ url: `${base}/${locale}`, changeFrequency: "daily", priority: 1 });
    entries.push({ url: `${base}/${locale}/properties`, changeFrequency: "daily", priority: 0.9 });
    for (const p of properties) {
      entries.push({
        url: `${base}/${locale}/properties/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  }
  return entries;
}
