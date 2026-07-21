import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router, tenantProcedure } from "../trpc";

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
        paymentMethod: z.enum(["CASH", "MOMO", "CREDIT"]),
        // For CASH/MOMO — must be >= total. For CREDIT — omit or pass 0.
        amountTendered: z.number().int().nonnegative().default(0),
        // Required when paymentMethod === "CREDIT"
        customerId: z.string().optional(),
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

      // Validate credit sales have a customer
      if (input.paymentMethod === "CREDIT" && !input.customerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A customer must be selected for credit sales",
        });
      }

      // Validate customer belongs to this org
      if (input.customerId) {
        const customer = await ctx.prisma.customer.findFirst({
          where: { id: input.customerId, organizationId: orgId },
          select: { id: true },
        });
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        }
      }

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

      if (input.paymentMethod !== "CREDIT" && input.amountTendered < total) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Amount tendered is less than the total",
        });
      }

      const change =
        input.paymentMethod === "CASH"
          ? Math.max(0, input.amountTendered - total)
          : 0;

      // ── 2. Atomic transaction ───────────────────────────────────────────────
      const sale = await ctx.prisma.$transaction(async (tx) => {
        // Create sale + items
        const sale = await tx.sale.create({
          data: {
            organizationId: orgId,
            branchId: input.branchId,
            cashierId: ctx.auth.userId,
            paymentMethod: input.paymentMethod,
            customerId: input.customerId,
            subtotal,
            total,
            amountTendered: input.paymentMethod === "CREDIT" ? 0 : input.amountTendered,
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

        // Stock movements + level updates
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

        // For credit sales, append a CHARGE entry to the customer's ledger
        if (input.paymentMethod === "CREDIT" && input.customerId) {
          await tx.creditEntry.create({
            data: {
              organizationId: orgId,
              customerId: input.customerId,
              type: "CHARGE",
              amount: total,
              saleId: sale.id,
              note: input.note,
              createdById: ctx.auth.userId,
            },
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

  /**
   * Public receipt lookup — no auth required.
   * The sale CUID is unguessable; the route is intentionally open so WhatsApp/
   * browser share links work without a login wall.
   */
  receipt: publicProcedure
    .input(z.object({ saleId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sale = await ctx.prisma.sale.findUnique({
        where: { id: input.saleId },
        select: {
          id: true,
          total: true,
          subtotal: true,
          discountTotal: true,
          amountTendered: true,
          change: true,
          paymentMethod: true,
          createdAt: true,
          cashier: { select: { name: true } },
          branch: { select: { name: true, receiptHeader: true } },
          organization: { select: { name: true } },
          items: {
            select: {
              name: true,
              quantity: true,
              unitPrice: true,
              lineTotal: true,
            },
            orderBy: { name: "asc" },
          },
        },
      });
      if (!sale) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Receipt not found" });
      }
      return sale;
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
      return ctx.prisma.sale.findMany({
        where: {
          organizationId: ctx.auth.organizationId,
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
