import { TRPCError } from "@trpc/server";
import { router, ownerProcedure } from "../trpc";

const GRACE_DAYS = 30;

export const accountRouter = router({
  /**
   * Current deletion status for the organization.
   * Returns null if not scheduled, or the scheduled deletion date.
   */
  deletionStatus: ownerProcedure.query(async ({ ctx }) => {
    const org = await ctx.prisma.organization.findUniqueOrThrow({
      where: { id: ctx.auth.organizationId },
      select: { deletedAt: true, name: true },
    });
    if (!org.deletedAt) return { scheduled: false as const };
    const deleteAt = new Date(org.deletedAt);
    deleteAt.setDate(deleteAt.getDate() + GRACE_DAYS);
    return {
      scheduled: true as const,
      requestedAt: org.deletedAt.toISOString(),
      deleteAt: deleteAt.toISOString(),
    };
  }),

  /**
   * Schedule account deletion. Sets deletedAt = now.
   * Data is retained for GRACE_DAYS days before permanent deletion.
   */
  requestDeletion: ownerProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.auth.organizationId;

    const org = await ctx.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { deletedAt: true },
    });

    if (org.deletedAt) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Deletion already scheduled.",
      });
    }

    await ctx.prisma.organization.update({
      where: { id: orgId },
      data: { deletedAt: new Date() },
    });

    const deleteAt = new Date();
    deleteAt.setDate(deleteAt.getDate() + GRACE_DAYS);
    return { deleteAt: deleteAt.toISOString() };
  }),

  /**
   * Cancel a pending deletion. Only works within the grace period.
   */
  cancelDeletion: ownerProcedure.mutation(async ({ ctx }) => {
    const orgId = ctx.auth.organizationId;

    const org = await ctx.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { deletedAt: true },
    });

    if (!org.deletedAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No deletion scheduled." });
    }

    const deleteAt = new Date(org.deletedAt);
    deleteAt.setDate(deleteAt.getDate() + GRACE_DAYS);
    if (new Date() > deleteAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Grace period has expired." });
    }

    await ctx.prisma.organization.update({
      where: { id: orgId },
      data: { deletedAt: null },
    });

    return { cancelled: true };
  }),
});
