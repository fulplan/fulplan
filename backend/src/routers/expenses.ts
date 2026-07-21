import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router } from "../trpc";

export const expensesRouter = router({
  /**
   * List expenses for the organization, newest first.
   * Optional date range filter.
   */
  list: managerProcedure
    .input(
      z.object({
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        limit: z.number().int().positive().max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      return ctx.prisma.expense.findMany({
        where: {
          organizationId: orgId,
          paidAt: {
            gte: input.from ? new Date(input.from) : undefined,
            lte: input.to ? new Date(input.to) : undefined,
          },
        },
        select: {
          id: true,
          category: true,
          amount: true,
          paidAt: true,
          note: true,
          branchId: true,
          branch: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { paidAt: "desc" },
        take: input.limit,
      });
    }),

  /**
   * Create a new expense entry.
   */
  create: managerProcedure
    .input(
      z.object({
        category: z.string().trim().min(1).max(100),
        amount: z.number().int().positive(),
        paidAt: z.string().datetime().optional(),
        note: z.string().trim().max(300).optional(),
        branchId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      // Validate branch belongs to org if provided.
      if (input.branchId) {
        const branch = await ctx.prisma.branch.findFirst({
          where: { id: input.branchId, organizationId: orgId },
          select: { id: true },
        });
        if (!branch) throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." });
      }

      return ctx.prisma.expense.create({
        data: {
          organizationId: orgId,
          category: input.category,
          amount: input.amount,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
          note: input.note,
          branchId: input.branchId,
          createdById: ctx.auth.userId,
        },
        select: { id: true, category: true, amount: true, paidAt: true },
      });
    }),

  /**
   * Delete an expense entry.
   */
  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const expense = await ctx.prisma.expense.findFirst({
        where: { id: input.id, organizationId: orgId },
        select: { id: true },
      });
      if (!expense) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.prisma.expense.delete({ where: { id: input.id } });
      return { deleted: true };
    }),
});
