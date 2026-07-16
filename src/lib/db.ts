import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Register in production too — per-route server bundles would otherwise each
// create their own PrismaClient (one connection pool per route).
globalForPrisma.prisma = prisma;
