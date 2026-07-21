import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../trpc";

export const stockTakesRouter = router({
  /**
   * Start a new stock take session for a branch.
   * Snapshots every active product's current stock level as the expected qty.
   * Enforces one open session per branch at a time.
   */
  start: managerProcedure
    .input(
      z.object({
        branchId: z.string(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const existing = await ctx.prisma.stockTake.findFirst({
        where: { organizationId: orgId, branchId: input.branchId, status: "OPEN" },
        select: { id: true },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A stock take is already in progress for this branch.",
        });
      }

      // Snapshot current stock levels for all active products at this branch.
      const stockLevels = await ctx.prisma.stockLevel.findMany({
        where: { organizationId: orgId, branchId: input.branchId },
        include: { product: { select: { id: true, name: true, active: true } } },
      });

      // Also include active products with no stock level yet (qty = 0).
      const allProducts = await ctx.prisma.product.findMany({
        where: { organizationId: orgId, active: true },
        select: { id: true, name: true },
      });

      const levelMap = new Map(stockLevels.map((sl) => [sl.productId, sl]));

      const items = allProducts.map((p) => ({
        productId: p.id,
        name: p.name,
        expectedQty: levelMap.get(p.id)?.quantity ?? 0,
      }));

      if (items.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No active products to count. Add products first.",
        });
      }

      return ctx.prisma.stockTake.create({
        data: {
          organizationId: orgId,
          branchId: input.branchId,
          note: input.note,
          createdById: ctx.auth.userId,
          items: { create: items },
        },
        select: { id: true, createdAt: true, _count: { select: { items: true } } },
      });
    }),

  /**
   * Get the current open stock take for a branch (or null).
   */
  current: tenantProcedure
    .input(z.object({ branchId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.stockTake.findFirst({
        where: {
          organizationId: ctx.auth.organizationId,
          branchId: input.branchId,
          status: "OPEN",
        },
        include: {
          items: { orderBy: { name: "asc" } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  /**
   * Update the counted quantity for a single item.
   */
  setCount: managerProcedure
    .input(
      z.object({
        stockTakeId: z.string(),
        productId: z.string(),
        countedQty: z.number().int().min(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      // Verify the stock take belongs to this org and is open.
      const stockTake = await ctx.prisma.stockTake.findFirst({
        where: { id: input.stockTakeId, organizationId: orgId, status: "OPEN" },
        select: { id: true, branchId: true },
      });

      if (!stockTake) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Stock take not found or already closed." });
      }

      return ctx.prisma.stockTakeItem.update({
        where: {
          stockTakeId_productId: {
            stockTakeId: input.stockTakeId,
            productId: input.productId,
          },
        },
        data: { countedQty: input.countedQty },
        select: { productId: true, countedQty: true },
      });
    }),

  /**
   * Close the stock take.
   * For each item where countedQty was entered and differs from expectedQty:
   *  - appends an ADJUSTMENT StockMovement (signed delta)
   *  - updates StockLevel cache
   * Items not counted are skipped (assumed correct).
   */
  close: managerProcedure
    .input(
      z.object({
        stockTakeId: z.string(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const stockTake = await ctx.prisma.stockTake.findFirst({
        where: { id: input.stockTakeId, organizationId: orgId, status: "OPEN" },
        include: { items: true },
      });

      if (!stockTake) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Stock take not found or already closed." });
      }

      const adjustments = stockTake.items.filter(
        (item) => item.countedQty != null && item.countedQty !== item.expectedQty,
      );

      await ctx.prisma.$transaction(async (tx) => {
        for (const item of adjustments) {
          const delta = item.countedQty! - item.expectedQty;

          await tx.stockMovement.create({
            data: {
              organizationId: orgId,
              productId: item.productId,
              branchId: stockTake.branchId,
              type: "ADJUSTMENT",
              quantity: delta,
              note: `Stock take adjustment (expected ${item.expectedQty}, counted ${item.countedQty})`,
              createdById: ctx.auth.userId,
            },
          });

          await tx.stockLevel.upsert({
            where: {
              productId_branchId: {
                productId: item.productId,
                branchId: stockTake.branchId,
              },
            },
            create: {
              organizationId: orgId,
              productId: item.productId,
              branchId: stockTake.branchId,
              quantity: item.countedQty!,
            },
            update: { quantity: { increment: delta } },
          });
        }

        await tx.stockTake.update({
          where: { id: input.stockTakeId },
          data: {
            status: "CLOSED",
            closedById: ctx.auth.userId,
            closedAt: new Date(),
            note: input.note ?? stockTake.note,
          },
        });
      });

      return {
        adjustmentsApplied: adjustments.length,
        itemsCounted: stockTake.items.filter((i) => i.countedQty != null).length,
        itemsTotal: stockTake.items.length,
      };
    }),

  /**
   * Past closed stock takes for a branch.
   */
  list: managerProcedure
    .input(
      z.object({
        branchId: z.string(),
        limit: z.number().int().positive().max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.stockTake.findMany({
        where: {
          organizationId: ctx.auth.organizationId,
          branchId: input.branchId,
          status: "CLOSED",
        },
        select: {
          id: true,
          note: true,
          createdAt: true,
          closedAt: true,
          createdBy: { select: { name: true } },
          closedBy: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
