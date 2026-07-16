import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

// naive in-memory login throttle (per email, resets on redeploy) — blocks
// unbounded online password guessing on the single-instance deployment
const loginAttempts = new Map<string, { count: number; windowStart: number }>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function loginThrottled(email: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(email);
  if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.set(email, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  if (loginAttempts.size > 5000) loginAttempts.clear(); // memory backstop
  return entry.count > LOGIN_MAX_ATTEMPTS;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "อีเมล", type: "email" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();
        if (loginThrottled(email)) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;
        loginAttempts.delete(email);
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        return token;
      }
      // Re-validate against the DB on every request so that user deletion,
      // role changes, and password changes revoke existing JWT sessions.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { role: true, passwordChangedAt: true },
        });
        const issuedAtMs = typeof token.iat === "number" ? token.iat * 1000 : 0;
        if (
          !dbUser ||
          (dbUser.passwordChangedAt && dbUser.passwordChangedAt.getTime() > issuedAtMs)
        ) {
          return { ...token, id: "", role: undefined as unknown as Role };
        }
        token.role = dbUser.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (!token.id || !token.role) {
        // revoked session — strip the user so auth guards treat it as signed out
        return { ...session, user: undefined } as unknown as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};

export function auth() {
  return getServerSession(authOptions);
}

/** Server-side guard: returns session or throws if role not allowed. */
export async function requireRole(...roles: Role[]) {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  if (roles.length > 0 && !roles.includes(session.user.role)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}
