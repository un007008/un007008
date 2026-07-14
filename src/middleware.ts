import { withAuth } from "next-auth/middleware";

// Protect all /admin routes: any signed-in role may enter the admin shell.
// Per-section role checks (e.g. ADMIN-only settings) are enforced server-side
// with requireRole() in each page/route.
export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: ["/admin/:path*"],
};
