import { Prisma } from "@prisma/client";
import { z } from "zod";
import { managerProcedure, router } from "../trpc";

// BigInt → Number helper (safe; pesewas never exceed Number.MAX_SAFE_INTEGER)
function n(v: bigint | null | undefined): number {
  return Number(v ?? 0n);
}

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
   * Period P&L summary using DB-level aggregation — scales to any sales volume.
   * All four component queries run in parallel.
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

      const branchSql = input.branchId
        ? Prisma.sql`AND "branchId" = ${input.branchId}`
        : Prisma.empty;

      const branchJoinSql = input.branchId
        ? Prisma.sql`AND s."branchId" = ${input.branchId}`
        : Prisma.empty;

      type SaleRow = {
        sales_count: bigint;
        revenue: bigint;
        cash: bigint;
        momo: bigint;
        credit: bigint;
      };

      const [saleRows, cogsRows, expenseAgg, salaryAgg] = await Promise.all([
        // Sales aggregate — single GROUP-free query, sub-millisecond with indexes
        ctx.prisma.$queryRaw<SaleRow[]>`
          SELECT
            COUNT(*)::bigint                                                         AS sales_count,
            COALESCE(SUM(total),         0)::bigint                                 AS revenue,
            COALESCE(SUM("cashAmount"),  0)::bigint                                 AS cash,
            COALESCE(SUM("momoAmount"),  0)::bigint                                 AS momo,
            COALESCE(SUM(CASE WHEN "paymentMethod"::text = 'CREDIT' THEN total ELSE 0 END), 0)::bigint AS credit
          FROM sales
          WHERE "organizationId" = ${orgId}
            AND status::text   = 'COMPLETED'
            AND "createdAt"   >= ${from}
            AND "createdAt"   <= ${to}
            ${branchSql}
        `,

        // COGS — DB-side SUM(costPrice * quantity), no row transfer to app
        ctx.prisma.$queryRaw<Array<{ cogs: bigint }>>`
          SELECT COALESCE(SUM(si."costPrice" * si.quantity), 0)::bigint AS cogs
          FROM sale_items si
          JOIN sales s ON s.id = si."saleId"
          WHERE s."organizationId" = ${orgId}
            AND s.status::text    = 'COMPLETED'
            AND s."createdAt"    >= ${from}
            AND s."createdAt"    <= ${to}
            ${branchJoinSql}
        `,

        ctx.prisma.expense.aggregate({
          where: {
            organizationId: orgId,
            ...(input.branchId ? { branchId: input.branchId } : {}),
            paidAt: { gte: from, lte: to },
          },
          _sum: { amount: true },
        }),

        ctx.prisma.salaryPayment.aggregate({
          where: { organizationId: orgId, paidAt: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
      ]);

      const sr = saleRows[0];
      const salesCount = n(sr?.sales_count);
      const revenue    = n(sr?.revenue);
      const cogs       = n(cogsRows[0]?.cogs);
      const expenses   = expenseAgg._sum.amount ?? 0;
      const salaryPaid = salaryAgg._sum.amount ?? 0;
      const byMethod   = { CASH: n(sr?.cash), MOMO: n(sr?.momo), CREDIT: n(sr?.credit) };

      return {
        period: { from: from.toISOString(), to: to.toISOString() },
        salesCount,
        revenue,
        cogs,
        grossProfit: revenue - cogs,
        byMethod,
        expenses,
        salaryPaid,
        netProfit: revenue - cogs - expenses - salaryPaid,
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
   * Sales performance per cashier — uses groupBy so no rows are transferred.
   */
  staffPerformance: managerProcedure
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

      const grouped = await ctx.prisma.sale.groupBy({
        by: ["cashierId"],
        where: {
          organizationId: orgId,
          status: "COMPLETED",
          createdAt: { gte: from, lte: to },
          ...(input.branchId ? { branchId: input.branchId } : {}),
        },
        _sum: { total: true },
        _count: { id: true },
        orderBy: { _sum: { total: "desc" } },
      });

      if (grouped.length === 0) return [];

      // Fetch names in one query
      const cashiers = await ctx.prisma.user.findMany({
        where: { id: { in: grouped.map((g) => g.cashierId) } },
        select: { id: true, name: true },
      });
      const names = new Map(cashiers.map((u) => [u.id, u.name]));

      return grouped.map((g) => ({
        cashierId: g.cashierId,
        name: names.get(g.cashierId) ?? "Unknown",
        count: g._count.id,
        revenue: g._sum.total ?? 0,
      }));
    }),

  /**
   * Daily revenue breakdown — raw SQL GROUP BY date, fills zero-revenue days
   * server-side so the chart always has a bar per calendar day.
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

      const branchSql = input.branchId
        ? Prisma.sql`AND "branchId" = ${input.branchId}`
        : Prisma.empty;

      const rows = await ctx.prisma.$queryRaw<
        Array<{ date: string; revenue: bigint; count: bigint }>
      >`
        SELECT
          "createdAt"::date::text                   AS date,
          COALESCE(SUM(total), 0)::bigint           AS revenue,
          COUNT(*)::bigint                          AS count
        FROM sales
        WHERE "organizationId" = ${orgId}
          AND status::text   = 'COMPLETED'
          AND "createdAt"   >= ${from}
          AND "createdAt"   <= ${to}
          ${branchSql}
        GROUP BY "createdAt"::date
        ORDER BY date
      `;

      // Map DB rows, then fill missing days with zeros for chart alignment
      const dayMap = new Map(rows.map((r) => [r.date, { revenue: n(r.revenue), count: n(r.count) }]));

      const result: Array<{ date: string; revenue: number; count: number }> = [];
      const cursor = new Date(from);
      cursor.setUTCHours(0, 0, 0, 0);
      const end = new Date(to);
      end.setUTCHours(0, 0, 0, 0);

      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        result.push({ date: key, ...(dayMap.get(key) ?? { revenue: 0, count: 0 }) });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return result;
    }),

  /**
   * Top-selling products by revenue — raw SQL aggregation for scale.
   * Returns current product name and correct COGS (costPrice × quantity).
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

      const branchSql = input.branchId
        ? Prisma.sql`AND s."branchId" = ${input.branchId}`
        : Prisma.empty;

      type ProdRow = {
        product_id: string;
        product_name: string;
        qty: bigint;
        revenue: bigint;
        cogs: bigint;
      };

      const rows = await ctx.prisma.$queryRaw<ProdRow[]>`
        SELECT
          si."productId"                              AS product_id,
          MAX(si.name)                               AS product_name,
          SUM(si.quantity)::bigint                   AS qty,
          SUM(si."lineTotal")::bigint                AS revenue,
          SUM(si."costPrice" * si.quantity)::bigint  AS cogs
        FROM sale_items si
        JOIN sales s ON s.id = si."saleId"
        WHERE s."organizationId" = ${orgId}
          AND s.status::text    = 'COMPLETED'
          AND s."createdAt"    >= ${from}
          AND s."createdAt"    <= ${to}
          ${branchSql}
        GROUP BY si."productId"
        ORDER BY revenue DESC
        LIMIT ${input.limit}
      `;

      return rows.map((r) => ({
        productId: r.product_id,
        name: r.product_name,
        qty: n(r.qty),
        revenue: n(r.revenue),
        cogs: n(r.cogs),
      }));
    }),
});
