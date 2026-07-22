import { z } from "zod";
import { managerProcedure, ownerProcedure, router, tenantProcedure } from "../trpc";

export const branchesRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db.branch.findMany({
      select: { id: true, name: true, address: true, receiptHeader: true },
      orderBy: { name: "asc" },
    });
  }),

  create: ownerProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        address: z.string().trim().max(200).optional(),
        receiptHeader: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.branch.create({
        data: {
          organizationId: ctx.auth.organizationId,
          name: input.name,
          address: input.address,
          receiptHeader: input.receiptHeader,
        },
        select: { id: true, name: true },
      });
    }),

  update: managerProcedure
    .input(
      z.object({
        branchId: z.string(),
        name: z.string().trim().min(1).max(100).optional(),
        address: z.string().trim().max(200).optional(),
        receiptHeader: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { branchId, ...data } = input;
      return ctx.db.branch.update({
        where: { id: branchId },
        data,
        select: { id: true, name: true, receiptHeader: true },
      });
    }),
});
