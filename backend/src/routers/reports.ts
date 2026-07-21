import { z } from "zod";
import { managerProcedure, router } from "../trpc";

export const reportsRouter = router({
  /**
   * Period summary: revenue, COGS, gross profit, expenses, salary paid, net profit.
   * branchId is optional — omit for org-wide totals.
   */
  summary: managerProcedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        branchId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;
      const from = new Date(input.from);
      const to = new Date(input.to);
      const branchFilter = input.branchId ? { branchId: input.branchId } : {};

      // Completed sales in period
      const sales = await ctx.prisma.sale.findMany({
        where: {
          organizationId: orgId,
          ...branchFilter,
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
        },
        select: {
          total: true,
          paymentMethod: true,
          items: { select: { costPrice: true, quantity: true } },
        },
      });

      let revenue = 0;
      let cogs = 0;
      const byMethod: Record<string, number> = { CASH: 0, MOMO: 0, CREDIT: 0 };

      for (const sale of sales) {
        revenue += sale.total;
        byMethod[sale.paymentMethod] = (byMethod[sale.paymentMethod] ?? 0) + sale.total;
        for (const item of sale.items) {
          cogs += item.costPrice * item.quantity;
        }
      }

      // Expenses in period
      const expenseAgg = await ctx.prisma.expense.aggregate({
        where: {
          organizationId: orgId,
          ...(input.branchId ? { branchId: input.branchId } : {}),
          paidAt: { gte: from, lte: to },
        },
        _sum: { amount: true },
      });
      const expenses = expenseAgg._sum.amount ?? 0;

      // Salary payments in period
      const salaryAgg = await ctx.prisma.salaryPayment.aggregate({
        where: {
          organizationId: orgId,
          paidAt: { gte: from, lte: to },
        },
        _sum: { amount: true },
      });
      const salaryPaid = salaryAgg._sum.amount ?? 0;

      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - expenses - salaryPaid;

      return {
        period: { from: from.toISOString(), to: to.toISOString() },
        salesCount: sales.length,
        revenue,
        cogs,
        grossProfit,
        byMethod: byMethod as { CASH: number; MOMO: number; CREDIT: number },
        expenses,
        salaryPaid,
        netProfit,
      };
    }),

  /**
   * Recent closed shifts with discrepancy data.
   */
  shiftLog: managerProcedure
    .input(
      z.object({
        branchId: z.string().optional(),
        limit: z.number().int().positive().max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      return ctx.prisma.shift.findMany({
        where: {
          organizationId: orgId,
          ...(input.branchId ? { branchId: input.branchId } : {}),
          status: "CLOSED",
        },
        select: {
          id: true,
          openedAt: true,
          closedAt: true,
          openingFloat: true,
          expectedCash: true,
          countedCash: true,
          discrepancy: true,
          note: true,
          cashier: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { openedAt: "desc" },
        take: input.limit,
      });
    }),

  /**
   * Top-selling products by revenue in a period.
   */
  topProducts: managerProcedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
        branchId: z.string().optional(),
        limit: z.number().int().positive().max(20).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;
      const from = new Date(input.from);
      const to = new Date(input.to);

      const items = await ctx.prisma.saleItem.findMany({
        where: {
          sale: {
            organizationId: orgId,
            status: "COMPLETED",
            createdAt: { gte: from, lte: to },
            ...(input.branchId ? { branchId: input.branchId } : {}),
          },
        },
        select: {
          name: true,
          productId: true,
          quantity: true,
          lineTotal: true,
          costPrice: true,
        },
      });

      // Group by productId
      const map = new Map<string, { name: string; qty: number; revenue: number; cogs: number }>();
      for (const item of items) {
        const existing = map.get(item.productId);
        if (existing) {
          existing.qty += item.quantity;
          existing.revenue += item.lineTotal;
          existing.cogs += item.costPrice * item.quantity;
        } else {
          map.set(item.productId, {
            name: item.name,
            qty: item.quantity,
            revenue: item.lineTotal,
            cogs: item.costPrice * item.quantity,
          });
        }
      }

      return Array.from(map.entries())
        .map(([productId, v]) => ({ productId, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, input.limit);
    }),
});
