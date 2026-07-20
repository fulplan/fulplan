import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, tenantProcedure } from "../trpc";

export const salesRouter = router({
  /**
   * Complete a sale atomically:
   *  1. Snapshot product prices / names
   *  2. Validate amount tendered >= total
   *  3. Create Sale + SaleItems
   *  4. Append StockMovements (negative = stock out)
   *  5. Upsert StockLevels
   *
   * All five steps in one interactive transaction — either all land or none do.
   */
  complete: tenantProcedure
    .input(
      z.object({
        branchId: z.string(),
        paymentMethod: z.enum(["CASH", "MOMO"]),
        amountTendered: z.number().int().positive(),
        items: z
          .array(
            z.object({
              productId: z.string(),
              quantity: z.number().int().positive(),
            }),
          )
          .min(1, "Cart is empty"),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      // ── 1. Load product snapshots ──────────────────────────────────────────
      const productIds = input.items.map((i) => i.productId);
      const products = await ctx.prisma.product.findMany({
        where: { id: { in: productIds }, organizationId: orgId, active: true },
        select: {
          id: true,
          name: true,
          sellingPrice: true,
          costPrice: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or more products not found or no longer active",
        });
      }

      const productMap = new Map(products.map((p) => [p.id, p]));

      const lineItems = input.items.map((item) => {
        const p = productMap.get(item.productId)!;
        return {
          productId: item.productId,
          name: p.name,
          quantity: item.quantity,
          unitPrice: p.sellingPrice,
          costPrice: p.costPrice,
          lineTotal: p.sellingPrice * item.quantity,
        };
      });

      const subtotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);
      const total = subtotal; // no discounts at MVP
      const change =
        input.paymentMethod === "CASH"
          ? Math.max(0, input.amountTendered - total)
          : 0;

      if (input.amountTendered < total) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Amount tendered is less than the total",
        });
      }

      // ── 2. Atomic transaction ───────────────────────────────────────────────
      const sale = await ctx.prisma.$transaction(async (tx) => {
        // Create sale + items
        const sale = await tx.sale.create({
          data: {
            organizationId: orgId,
            branchId: input.branchId,
            cashierId: ctx.auth.userId,
            paymentMethod: input.paymentMethod,
            subtotal,
            total,
            amountTendered: input.amountTendered,
            change,
            note: input.note,
            items: {
              create: lineItems.map((li) => ({
                productId: li.productId,
                name: li.name,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                costPrice: li.costPrice,
                lineTotal: li.lineTotal,
              })),
            },
          },
        });

        // Stock movements + level updates (one loop = sequential awaits inside tx)
        for (const li of lineItems) {
          await tx.stockMovement.create({
            data: {
              organizationId: orgId,
              productId: li.productId,
              branchId: input.branchId,
              type: "SALE",
              quantity: -li.quantity,
              saleId: sale.id,
              createdById: ctx.auth.userId,
            },
          });

          await tx.stockLevel.upsert({
            where: {
              productId_branchId: {
                productId: li.productId,
                branchId: input.branchId,
              },
            },
            create: {
              organizationId: orgId,
              productId: li.productId,
              branchId: input.branchId,
              quantity: -li.quantity,
            },
            update: { quantity: { decrement: li.quantity } },
          });
        }

        return sale;
      });

      return {
        id: sale.id,
        total: sale.total,
        change: sale.change,
        paymentMethod: sale.paymentMethod,
        createdAt: sale.createdAt,
      };
    }),

  /** Recent sales for a branch — cashiers see their own, managers see all. */
  list: tenantProcedure
    .input(
      z.object({
        branchId: z.string().optional(),
        limit: z.number().int().positive().max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.sale.findMany({
        where: {
          ...(input.branchId ? { branchId: input.branchId } : {}),
          status: "COMPLETED",
        },
        select: {
          id: true,
          paymentMethod: true,
          total: true,
          change: true,
          createdAt: true,
          cashier: { select: { name: true } },
          items: {
            select: { name: true, quantity: true, lineTotal: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
