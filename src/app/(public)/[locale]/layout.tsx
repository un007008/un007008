import Link from "next/link";
import { notFound } from "next/navigation";

import { LOCALES, UI, isLocale, type Locale } from "@/lib/i18n";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const ui = UI[locale];

  return (
    <div className="flex min-h-dvh flex-col">
      {/* root layout hardcodes lang="th"; the html tag lives above this
          segment, so correct it per-locale before paint */}
      {locale !== "th" && (
        <script
          dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(locale)}` }}
        />
      )}
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href={`/${locale}`} className="text-sm font-bold sm:text-base">
            {ui.siteName}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href={`/${locale}/properties`} className="rounded-md px-2.5 py-1.5 hover:bg-accent">
              {ui.properties}
            </Link>
            <div className="ml-1 flex items-center gap-0.5 rounded-md border p-0.5 text-xs">
              {LOCALES.map((l) => (
                <Link
                  key={l}
                  href={`/${l}`}
                  className={`rounded px-1.5 py-0.5 uppercase ${l === locale ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                >
                  {l}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {ui.siteName}
      </footer>
    </div>
  );
}
