import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { prisma } from "./db";

/**
 * Per-request context handed to every tRPC procedure.
 *
 * Auth and the tenant-scoping middleware land here next: once a request is
 * authenticated, `organizationId` is resolved once and every downstream query
 * is scoped by it — route handlers never get to forget it.
 */
export function createContext({ req, res }: CreateFastifyContextOptions) {
  return {
    req,
    res,
    prisma,
    // Populated by the auth middleware (not yet implemented).
    auth: null as null | {
      userId: string;
      organizationId: string;
      branchId: string | null;
      role: "OWNER" | "MANAGER" | "CASHIER";
    },
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
