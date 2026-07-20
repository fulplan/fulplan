import { TRPCError, initTRPC } from "@trpc/server";
import { ZodError } from "zod";
import type { Context } from "./context";
import { tenantDb } from "./lib/tenant-db";
import type { Role } from "./lib/tokens";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;

/** Open to anyone. Health checks, signup, and login only. */
export const publicProcedure = t.procedure;

/** Requires a valid session. Does NOT scope database access. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in required" });
  }
  return next({ ctx: { ...ctx, auth: ctx.auth } });
});

/**
 * The procedure almost every feature should use.
 *
 * Guarantees:
 *  1. The caller is authenticated.
 *  2. `ctx.db` can only ever read or write this caller's organization.
 *  3. A locked/past-due tenant is read-only — mutations are refused.
 */
export const tenantProcedure = protectedProcedure.use(
  async ({ ctx, next, type }) => {
    const { organizationId } = ctx.auth;

    const organization = await ctx.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, subscriptionStatus: true, deletedAt: true },
    });

    if (!organization || organization.deletedAt) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "This account is no longer active",
      });
    }

    const isLocked =
      organization.subscriptionStatus === "LOCKED" ||
      organization.subscriptionStatus === "CANCELLED";

    if (isLocked && type === "mutation") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "Your subscription is inactive. You can still view your data, " +
          "but changes are paused until payment is completed.",
      });
    }

    return next({
      ctx: { ...ctx, organization, db: tenantDb(organizationId) },
    });
  },
);

/** Restricts a procedure to specific roles. */
function withRoles(...allowed: Role[]) {
  return tenantProcedure.use(({ ctx, next }) => {
    if (!allowed.includes(ctx.auth.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to do this",
      });
    }
    return next({ ctx });
  });
}

/** Owner-only: profit figures, billing, staff management, data export. */
export const ownerProcedure = withRoles("OWNER");

/** Owner or manager: price edits, discount approval, voids, stock adjustments. */
export const managerProcedure = withRoles("OWNER", "MANAGER");
