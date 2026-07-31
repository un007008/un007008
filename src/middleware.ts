import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse, type NextFetchEvent } from "next/server";

// Protect all /admin routes: any signed-in role may enter the admin shell.
// Per-section role checks (e.g. ADMIN-only settings) are enforced server-side
// with requireRole() in each page/route.
const adminAuth = withAuth(
  function restrictByRole(req: NextRequestWithAuth) {
    // ACCOUNTANT is scoped to the accounting module (+ own account page)
    const role = req.nextauth.token?.role as string | undefined;
    const p = req.nextUrl.pathname;
    if (
      role === "ACCOUNTANT" &&
      !p.startsWith("/admin/accounting") &&
      !p.startsWith("/admin/account")
    ) {
      return NextResponse.redirect(new URL("/admin/accounting", req.url));
    }
    return NextResponse.next();
  },
  { pages: { signIn: "/login" } }
);

export default function middleware(req: NextRequestWithAuth, event: NextFetchEvent) {
  // Dedicated accounting entry domain: when ACCOUNTING_DOMAIN is set and the
  // request arrives on that host, its root goes straight to the accounting
  // module instead of the public property site.
  const accountingDomain = process.env.ACCOUNTING_DOMAIN?.trim().toLowerCase();
  if (accountingDomain) {
    const host = req.headers.get("host")?.split(":")[0].toLowerCase();
    if (host === accountingDomain && req.nextUrl.pathname === "/") {
      return NextResponse.redirect(new URL("/admin/accounting", req.url));
    }
  }

  if (req.nextUrl.pathname.startsWith("/admin")) {
    return adminAuth(req, event);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*"],
};
