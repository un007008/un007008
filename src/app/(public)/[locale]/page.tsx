import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { SECTION_REGISTRY } from "@/components/sections/registry";
import { prisma } from "@/lib/db";
import { LOCALES, UI, isLocale, type Locale } from "@/lib/i18n";
import { normalizeHomepage } from "@/lib/sections/schema";

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

  const config = await prisma.siteConfig.findUnique({ where: { id: "homepage" } });
  const homepage = normalizeHomepage(config?.data);

  return (
    <div>
      {homepage.sections
        .filter((s) => s.visible)
        .map((section) => {
          const Component = SECTION_REGISTRY[section.type];
          if (!Component) return null;
          return <Component key={section.id} locale={locale} section={section} />;
        })}
    </div>
  );
}
