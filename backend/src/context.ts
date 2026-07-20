import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import type { FastifyRequest } from "fastify";
import { prisma } from "./db";
import { verifyAccessToken, type AccessTokenPayload } from "./lib/tokens";

async function resolveAuth(
  req: FastifyRequest,
): Promise<AccessTokenPayload | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;

  const payload = await verifyAccessToken(header.slice("Bearer ".length));
  if (!payload) return null;

  // A revoked device must lose access immediately, not when its JWT expires —
  // that is the entire point of remote revocation for a stolen tablet.
  if (payload.deviceId) {
    const device = await prisma.device.findFirst({
      where: { id: payload.deviceId, organizationId: payload.organizationId },
      select: { revokedAt: true },
    });
    if (!device || device.revokedAt) return null;
  }

  return payload;
}

/**
 * Per-request context handed to every tRPC procedure.
 *
 * `prisma` here is UNSCOPED. Procedures that touch tenant data must use
 * `tenantProcedure`, which replaces it with a client locked to one
 * organization — see lib/tenant-db.ts.
 */
export async function createContext({ req, res }: CreateFastifyContextOptions) {
  return {
    req,
    res,
    prisma,
    auth: await resolveAuth(req),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
