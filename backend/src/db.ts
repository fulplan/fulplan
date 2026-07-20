import { PrismaClient } from "@prisma/client";
import { env } from "./env";

export const prisma = new PrismaClient({
  // Tests deliberately trigger failing queries (proving isolation holds), so
  // Prisma's error logging is pure noise there.
  log: env.NODE_ENV === "test" ? [] : ["warn", "error"],
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
