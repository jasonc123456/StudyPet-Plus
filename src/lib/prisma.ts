// A single shared PrismaClient for the whole app.
//
// Why? Next.js hot-reloads modules on every edit in dev, and each
// `new PrismaClient()` opens its own pool of DB connections. Re-creating it on
// every reload quickly exhausts Postgres' connection limit ("too many clients").
// We stash one instance on `globalThis` so reloads reuse it. In production the
// module is only evaluated once, so the guard is effectively a no-op there.
//
// Import this everywhere instead of constructing PrismaClient yourself:
//   import { prisma } from "@/lib/prisma";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Quieter logs in prod; surface queries/errors while developing.
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;