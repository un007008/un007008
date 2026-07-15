import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { LOCALES, UI, isLocale, t, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const BLOG_TITLE: Record<Locale, string> = {
  th: "บทความ",
  en: "Articles",
  zh: "文章",
};

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  const locale = isLocale(params.locale) ? params.locale : "th";
  return {
    title: `${BLOG_TITLE[locale]} — ${UI[locale].siteName}`,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/blog`])),
    },
  };
}

export default async function BlogListPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="text-lg font-semibold">{BLOG_TITLE[locale]}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {posts.map((p) => (
          <Link
            key={p.id}
            href={`/${locale}/blog/${p.slug}`}
            className="overflow-hidden rounded-xl border hover:shadow-md"
          >
            {p.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.coverUrl} alt="" className="aspect-[16/9] w-full object-cover" />
            )}
            <div className="space-y-1 p-3">
              <p className="text-sm font-medium">{t(p.title, locale)}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(p.createdAt).toLocaleDateString(
                  locale === "th" ? "th-TH" : locale === "zh" ? "zh-CN" : "en-GB"
                )}
                {p.category && ` · ${p.category}`}
              </p>
            </div>
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="col-span-full rounded-xl border p-10 text-center text-sm text-muted-foreground">
            —
          </p>
        )}
      </div>
    </div>
  );
}
