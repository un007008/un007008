import type { Metadata } from "next";
import "./globals.css";

function safeBaseUrl(): URL {
  // a malformed NEXTAUTH_URL must not crash the whole build
  try {
    return new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000");
  } catch {
    console.warn(`[layout] invalid NEXTAUTH_URL: ${process.env.NEXTAUTH_URL}`);
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  // absolute base so hreflang/canonical alternates render as full URLs
  metadataBase: safeBaseUrl(),
  title: "PropOS — ระบบบริหารงานอสังหาริมทรัพย์",
  description: "แพลตฟอร์มบริหารธุรกิจอสังหาริมทรัพย์ครบวงจร",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
