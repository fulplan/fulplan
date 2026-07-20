import { PrismaClient } from "@prisma/client";
import { env, isProduction } from "./env";

export const prisma = new PrismaClient({
  log: isProduction ? ["warn", "error"] : ["warn", "error"],
});

// Reuse the client across tsx watch reloads in development so we don't
// exhaust the connection pool on every file save.
declare global {
  // eslint-disable-next-line no-var
  var __ghposPrisma: PrismaClient | undefined;
}

if (env.NODE_ENV !== "production") {
  globalThis.__ghposPrisma ??= prisma;
}
