import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../trpc";

export const shiftsRouter = router({
  /**
   * The current open shift for a branch (null if none).
   * Includes cash entries and aggregates cash sales for the active summary.
   */
  current: tenantProcedure
    .input(z.object({ branchId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const shift = await ctx.prisma.shift.findFirst({
        where: { organizationId: orgId, branchId: input.branchId, status: "OPEN" },
        include: {
          cashier: { select: { id: true, name: true } },
          cashEntries: { orderBy: { createdAt: "asc" } },
        },
        orderBy: { openedAt: "desc" },
      });

      if (!shift) return null;

      const salesAgg = await ctx.prisma.sale.aggregate({
        where: {
          organizationId: orgId,
          branchId: input.branchId,
          status: "COMPLETED",
          createdAt: { gte: shift.openedAt },
        },
        _sum: { cashAmount: true },
      });

      const cashSalesTotal = salesAgg._sum.cashAmount ?? 0;
      const cashEntriesNet = shift.cashEntries.reduce(
        (sum, e) => sum + (e.type === "IN" ? e.amount : -e.amount),
        0,
      );

      // Explicit construction keeps tRPC's type inference intact — spreading a
      // Prisma result inside a middleware chain can widen the type to {}.
      return {
        id: shift.id,
        organizationId: shift.organizationId,
        branchId: shift.branchId,
        cashierId: shift.cashierId,
        status: shift.status,
        openingFloat: shift.openingFloat,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        note: shift.note,
        cashier: shift.cashier,
        cashEntries: shift.cashEntries,
        cashSalesTotal,
        cashEntriesNet,
        expectedNow: shift.openingFloat + cashSalesTotal + cashEntriesNet,
      };
    }),

  /**
   * Open a new shift. Enforces one open shift per branch at a time.
   */
  open: tenantProcedure
    .input(
      z.object({
        branchId: z.string(),
        openingFloat: z.number().int().nonnegative(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const existing = await ctx.prisma.shift.findFirst({
        where: { organizationId: orgId, branchId: input.branchId, status: "OPEN" },
        select: { id: true },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "A shift is already open for this branch. Close it before opening a new one.",
        });
      }

      return ctx.prisma.shift.create({
        data: {
          organizationId: orgId,
          branchId: input.branchId,
          cashierId: ctx.auth.userId,
          openingFloat: input.openingFloat,
        },
        select: { id: true, openingFloat: true, openedAt: true },
      });
    }),

  /**
   * Add a cash-in or cash-out entry to the current open shift.
   */
  addCashEntry: tenantProcedure
    .input(
      z.object({
        shiftId: z.string(),
        type: z.enum(["IN", "OUT"]),
        amount: z.number().int().positive(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const shift = await ctx.prisma.shift.findFirst({
        where: { id: input.shiftId, organizationId: ctx.auth.organizationId, status: "OPEN" },
        select: { id: true },
      });

      if (!shift) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shift not found or already closed",
        });
      }

      return ctx.prisma.cashEntry.create({
        data: {
          shiftId: input.shiftId,
          organizationId: ctx.auth.organizationId,
          type: input.type,
          amount: input.amount,
          note: input.note,
          createdById: ctx.auth.userId,
        },
      });
    }),

  /**
   * Close a shift. Computes expected vs counted cash and stores discrepancy.
   */
  close: tenantProcedure
    .input(
      z.object({
        shiftId: z.string(),
        countedCash: z.number().int().nonnegative(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const shift = await ctx.prisma.shift.findFirst({
        where: { id: input.shiftId, organizationId: orgId, status: "OPEN" },
        include: { cashEntries: true },
      });

      if (!shift) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Shift not found or already closed",
        });
      }

      const salesAgg = await ctx.prisma.sale.aggregate({
        where: {
          organizationId: orgId,
          branchId: shift.branchId,
          status: "COMPLETED",
          createdAt: { gte: shift.openedAt },
        },
        _sum: { cashAmount: true },
      });

      const cashSalesTotal = salesAgg._sum.cashAmount ?? 0;
      const cashEntriesNet = shift.cashEntries.reduce(
        (sum, e) => sum + (e.type === "IN" ? e.amount : -e.amount),
        0,
      );

      const expectedCash = shift.openingFloat + cashSalesTotal + cashEntriesNet;
      const discrepancy = input.countedCash - expectedCash;

      return ctx.prisma.shift.update({
        where: { id: input.shiftId },
        data: {
          status: "CLOSED",
          countedCash: input.countedCash,
          expectedCash,
          discrepancy,
          closedAt: new Date(),
          note: input.note,
        },
        select: {
          id: true,
          countedCash: true,
          expectedCash: true,
          discrepancy: true,
          closedAt: true,
        },
      });
    }),

  /**
   * Past shifts for a branch — for the owner's end-of-day review.
   */
  list: managerProcedure
    .input(
      z.object({
        branchId: z.string(),
        limit: z.number().int().positive().max(100).default(30),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.shift.findMany({
        where: {
          organizationId: ctx.auth.organizationId,
          branchId: input.branchId,
          status: "CLOSED",
        },
        select: {
          id: true,
          openingFloat: true,
          countedCash: true,
          expectedCash: true,
          discrepancy: true,
          openedAt: true,
          closedAt: true,
          cashier: { select: { name: true } },
          _count: { select: { cashEntries: true } },
        },
        orderBy: { openedAt: "desc" },
        take: input.limit,
      });
    }),
});
