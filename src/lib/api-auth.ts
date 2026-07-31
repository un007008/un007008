import { auth } from "@/lib/auth";

/** Session guard for API route handlers. Returns null when unauthenticated. */
export async function apiSession() {
  const session = await auth();
  return session?.user ? session : null;
}

/** Roles allowed to use the accounting module. */
export function isAccountingRole(role: string | undefined): boolean {
  return role === "ADMIN" || role === "ACCOUNTANT";
}
