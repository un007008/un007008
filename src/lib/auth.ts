import { type NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createRateLimiter } from "@/lib/rate-limit";

// per-email login throttle — blocks unbounded online password guessing
const loginThrottled = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

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
        loginThrottled.reset(email);
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
