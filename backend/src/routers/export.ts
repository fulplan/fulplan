import { z } from "zod";
import { managerProcedure, router } from "../trpc";

/**
 * Data export procedures. Each returns an array of plain objects
 * that the frontend serialises to CSV and triggers a browser download.
 * Scoped to managers and above; sensitive but not owner-only.
 */
export const exportRouter = router({
  sales: managerProcedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const sales = await ctx.prisma.sale.findMany({
        where: {
          organizationId: orgId,
          createdAt: { gte: new Date(input.from), lte: new Date(input.to) },
        },
        select: {
          id: true,
          createdAt: true,
          status: true,
          paymentMethod: true,
          total: true,
          amountTendered: true,
          change: true,
          cashier: { select: { name: true } },
          branch: { select: { name: true } },
          customer: { select: { name: true } },
          items: {
            select: {
              name: true,
              quantity: true,
              unitPrice: true,
              costPrice: true,
              lineTotal: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      // Flatten: one row per line item
      return sales.flatMap((sale) =>
        sale.items.map((item) => ({
          date: sale.createdAt.toISOString(),
          saleId: sale.id,
          status: sale.status,
          cashier: sale.cashier.name,
          branch: sale.branch.name,
          customer: sale.customer?.name ?? "",
          paymentMethod: sale.paymentMethod,
          product: item.name,
          qty: item.quantity,
          unitPriceGhs: (item.unitPrice / 100).toFixed(2),
          costPriceGhs: (item.costPrice / 100).toFixed(2),
          lineTotalGhs: (item.lineTotal / 100).toFixed(2),
          saleTotalGhs: (sale.total / 100).toFixed(2),
        })),
      );
    }),

  products: managerProcedure.query(async ({ ctx }) => {
    const orgId = ctx.auth.organizationId;

    const products = await ctx.prisma.product.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        barcode: true,
        active: true,
        costPrice: true,
        sellingPrice: true,
        purchaseUnit: true,
        saleUnit: true,
        unitsPerPurchase: true,
        lowStockThreshold: true,
        category: { select: { name: true } },
        stockLevels: { select: { quantity: true, branch: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    });

    return products.flatMap((p) => {
      const rows = p.stockLevels.map((sl) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode ?? "",
        category: p.category?.name ?? "",
        active: p.active ? "yes" : "no",
        costPriceGhs: (p.costPrice / 100).toFixed(2),
        sellingPriceGhs: (p.sellingPrice / 100).toFixed(2),
        purchaseUnit: p.purchaseUnit,
        saleUnit: p.saleUnit,
        unitsPerPurchase: p.unitsPerPurchase,
        lowStockThreshold: p.lowStockThreshold,
        branch: sl.branch.name,
        stockQty: sl.quantity,
      }));
      // If no stock levels, still include the product
      if (rows.length === 0) {
        return [{
          id: p.id,
          name: p.name,
          barcode: p.barcode ?? "",
          category: p.category?.name ?? "",
          active: p.active ? "yes" : "no",
          costPriceGhs: (p.costPrice / 100).toFixed(2),
          sellingPriceGhs: (p.sellingPrice / 100).toFixed(2),
          purchaseUnit: p.purchaseUnit,
          saleUnit: p.saleUnit,
          unitsPerPurchase: p.unitsPerPurchase,
          lowStockThreshold: p.lowStockThreshold,
          branch: "",
          stockQty: 0,
        }];
      }
      return rows;
    });
  }),

  customers: managerProcedure.query(async ({ ctx }) => {
    const orgId = ctx.auth.organizationId;

    const customers = await ctx.prisma.customer.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        phone: true,
        notes: true,
        active: true,
        creditLimit: true,
        createdAt: true,
        creditEntries: { select: { type: true, amount: true } },
      },
      orderBy: { name: "asc" },
    });

    return customers.map((c) => {
      const balance = c.creditEntries.reduce(
        (sum, e) => sum + (e.type === "CHARGE" ? e.amount : -e.amount),
        0,
      );
      return {
        id: c.id,
        name: c.name,
        phone: c.phone ?? "",
        notes: c.notes ?? "",
        active: c.active ? "yes" : "no",
        creditLimitGhs: c.creditLimit != null ? (c.creditLimit / 100).toFixed(2) : "",
        balanceOwedGhs: (balance / 100).toFixed(2),
        createdAt: c.createdAt.toISOString(),
      };
    });
  }),

  expenses: managerProcedure
    .input(
      z.object({
        from: z.string().datetime(),
        to: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const expenses = await ctx.prisma.expense.findMany({
        where: {
          organizationId: orgId,
          paidAt: { gte: new Date(input.from), lte: new Date(input.to) },
        },
        select: {
          id: true,
          category: true,
          amount: true,
          paidAt: true,
          note: true,
          branch: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { paidAt: "asc" },
      });

      return expenses.map((e) => ({
        date: e.paidAt.toISOString(),
        category: e.category,
        amountGhs: (e.amount / 100).toFixed(2),
        branch: e.branch?.name ?? "",
        note: e.note ?? "",
        recordedBy: e.createdBy.name,
      }));
    }),
});
