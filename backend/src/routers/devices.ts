import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../trpc";

export const devicesRouter = router({
  /** Every till registered to this shop, so a lost one can be spotted. */
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db.device.findMany({
      select: {
        id: true,
        label: true,
        lastSeenAt: true,
        revokedAt: true,
        createdAt: true,
        branchId: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: [{ revokedAt: "asc" }, { lastSeenAt: "desc" }],
    });
  }),

  /**
   * Cut off a lost or stolen device immediately. Sessions carrying this
   * device id stop working on their very next request — see resolveAuth
   * in context.ts.
   */
  revoke: managerProcedure
    .input(z.object({ deviceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const revoked = await ctx.db.device.updateMany({
        where: { id: input.deviceId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (revoked.count === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Device not found or already revoked",
        });
      }
      return { ok: true };
    }),
});
