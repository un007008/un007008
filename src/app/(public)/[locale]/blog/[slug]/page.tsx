import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { marked } from "marked";

import { prisma } from "@/lib/db";
import { LOCALES, UI, isLocale, t, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { locale: string; slug: string };
}): Promise<Metadata> {
  const locale = isLocale(params.locale) ? params.locale : "th";
  const post = await prisma.blogPost.findUnique({ where: { slug: params.slug } });
  if (!post) return {};
  return {
    title: `${t(post.title, locale)} — ${UI[locale].siteName}`,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/blog/${params.slug}`])),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: { locale: string; slug: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;

  const post = await prisma.blogPost.findUnique({ where: { slug: params.slug } });
  if (!post || !post.published) notFound();

  // content is admin-authored markdown (trusted input)
  const markdown = t(post.content, locale) || t(post.content, "th");
  const html = await marked.parse(markdown);

  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      {post.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverUrl} alt="" className="w-full rounded-xl object-cover" />
      )}
      <div>
        <h1 className="text-2xl font-bold">{t(post.title, locale)}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(post.createdAt).toLocaleDateString(
            locale === "th" ? "th-TH" : locale === "zh" ? "zh-CN" : "en-GB"
          )}
          {post.category && ` · ${post.category}`}
        </p>
      </div>
      <div
        className="prose-sm max-w-none space-y-3 leading-relaxed [&_a]:text-amber-700 [&_a]:underline [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
