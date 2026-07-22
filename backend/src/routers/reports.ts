import { z } from "zod";
import { managerProcedure, router } from "../trpc";

export const reportsRouter = router({
  /**
   * Owner dashboard snapshot: today's sales + recent shift discrepancies + low stock.
   * Single efficient call so the dashboard loads in one round-trip.
   */
  dashboard: managerProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
      const branchFilter = input.branchId ? { branchId: input.branchId } : {};

      const [todaySales, recentShifts, lowStockLevels] = await Promise.all([
        ctx.prisma.sale.findMany({
          where: {
            organizationId: orgId,
            ...branchFilter,
            status: "COMPLETED",
            createdAt: { gte: todayStart, lt: todayEnd },
          },
          select: { total: true, paymentMethod: true, cashAmount: true, momoAmount: true },
        }),

        ctx.prisma.shift.findMany({
          where: {
            organizationId: orgId,
            ...branchFilter,
            status: "CLOSED",
            closedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
          select: {
            id: true,
            closedAt: true,
            discrepancy: true,
            cashier: { select: { name: true } },
            branch: { select: { name: true } },
          },
          orderBy: { closedAt: "desc" },
          take: 10,
        }),

        ctx.prisma.stockLevel.findMany({
          where: {
            organizationId: orgId,
            ...(input.branchId ? { branchId: input.branchId } : {}),
            product: { active: true },
          },
          select: {
            quantity: true,
            product: { select: { name: true, lowStockThreshold: true } },
            branch: { select: { name: true } },
          },
        }),
      ]);

      let revenue = 0;
      const byMethod = { CASH: 0, MOMO: 0, CREDIT: 0 };
      for (const s of todaySales) {
        revenue += s.total;
        byMethod.CASH += s.cashAmount;
        byMethod.MOMO += s.momoAmount;
        if (s.paymentMethod === "CREDIT") byMethod.CREDIT += s.total;
      }

      const discrepancyAlerts = recentShifts.filter(
        (s) => s.discrepancy !== null && s.discrepancy !== 0,
      );

      const lowStock = lowStockLevels
        .filter((s) => s.quantity <= s.product.lowStockThreshold)
        .slice(0, 10);

      return {
        today: { salesCount: todaySales.length, revenue, byMethod },
        discrepancyAlerts,
        lowStock,
      };
    }),


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
          cashAmount: true,
          momoAmount: true,
          items: { select: { costPrice: true, quantity: true } },
        },
      });

      let revenue = 0;
      let cogs = 0;
      const byMethod = { CASH: 0, MOMO: 0, CREDIT: 0 };

      for (const sale of sales) {
        revenue += sale.total;
        // Use actual cashAmount/momoAmount so split sales are correctly attributed
        byMethod.CASH += sale.cashAmount;
        byMethod.MOMO += sale.momoAmount;
        if (sale.paymentMethod === "CREDIT") byMethod.CREDIT += sale.total;
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
        byMethod,
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
   * Daily revenue breakdown for a period — used for the trend chart on the
   * Reports summary tab. Returns one entry per calendar day (UTC) in order.
   */
  dailyTrend: managerProcedure
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

      const sales = await ctx.prisma.sale.findMany({
        where: {
          organizationId: orgId,
          ...(input.branchId ? { branchId: input.branchId } : {}),
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
        },
        select: { total: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      });

      // Group by YYYY-MM-DD in UTC
      const map = new Map<string, { revenue: number; count: number }>();
      for (const sale of sales) {
        const dateKey = sale.createdAt.toISOString().slice(0, 10);
        const existing = map.get(dateKey);
        if (existing) {
          existing.revenue += sale.total;
          existing.count += 1;
        } else {
          map.set(dateKey, { revenue: sale.total, count: 1 });
        }
      }

      // Fill in missing days with zero so chart bars stay evenly spaced
      const days: Array<{ date: string; revenue: number; count: number }> = [];
      const cursor = new Date(from);
      cursor.setUTCHours(0, 0, 0, 0);
      const end = new Date(to);
      end.setUTCHours(0, 0, 0, 0);

      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        const d = map.get(key) ?? { revenue: 0, count: 0 };
        days.push({ date: key, ...d });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return days;
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
