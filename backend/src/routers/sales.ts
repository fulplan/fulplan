import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, publicProcedure, router, tenantProcedure } from "../trpc";

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
        paymentMethod: z.enum(["CASH", "MOMO", "CREDIT", "SPLIT"]),
        // For CASH/MOMO — must be >= total. For CREDIT — omit or pass 0.
        // For SPLIT — amountTendered = total (no change), cashAmount + momoAmount = total.
        amountTendered: z.number().int().nonnegative().default(0),
        // Required when paymentMethod === "CREDIT"
        customerId: z.string().optional(),
        // Required when paymentMethod === "SPLIT"
        cashAmount: z.number().int().nonnegative().optional(),
        momoAmount: z.number().int().nonnegative().optional(),
        items: z
          .array(
            z.object({
              productId: z.string(),
              quantity: z.number().int().positive(),
            }),
          )
          .min(1, "Cart is empty"),
        note: z.string().trim().max(200).optional(),
        // Manager-approved discount in pesewas (0 = no discount)
        discountTotal: z.number().int().nonnegative().default(0),
        discountNote: z.string().trim().max(200).optional(),
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

      // Validate split payment amounts
      if (input.paymentMethod === "SPLIT") {
        const cash = input.cashAmount ?? 0;
        const momo = input.momoAmount ?? 0;
        if (cash <= 0 || momo <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Split payment requires both a cash amount and a MoMo amount",
          });
        }
      }

      // Validate customer belongs to this org and load credit data
      let creditLimitCheck: { limit: number; balance: number } | null = null;
      if (input.customerId) {
        const customer = await ctx.prisma.customer.findFirst({
          where: { id: input.customerId, organizationId: orgId },
          select: {
            id: true,
            creditLimit: true,
            creditEntries: { select: { type: true, amount: true } },
          },
        });
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
        }
        if (input.paymentMethod === "CREDIT" && customer.creditLimit !== null) {
          const currentBalance = customer.creditEntries.reduce(
            (sum: number, e: { type: string; amount: number }) =>
              sum + (e.type === "CHARGE" ? e.amount : -e.amount),
            0,
          );
          creditLimitCheck = { limit: customer.creditLimit, balance: currentBalance };
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
      const discountTotal = Math.min(input.discountTotal, subtotal);
      const total = subtotal - discountTotal;

      const effectiveTendered =
        input.paymentMethod === "SPLIT"
          ? (input.cashAmount ?? 0) + (input.momoAmount ?? 0)
          : input.amountTendered;

      if (input.paymentMethod !== "CREDIT" && effectiveTendered < total) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Amount tendered is less than the total",
        });
      }

      // Enforce credit limit
      if (creditLimitCheck !== null) {
        if (creditLimitCheck.balance + total > creditLimitCheck.limit) {
          const available = Math.max(0, creditLimitCheck.limit - creditLimitCheck.balance);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Credit limit exceeded. Available credit: GH₵ ${(available / 100).toFixed(2)}`,
          });
        }
      }

      // Cash change only applies to pure-cash sales (no change on split or MoMo)
      const change =
        input.paymentMethod === "CASH"
          ? Math.max(0, input.amountTendered - total)
          : 0;

      // Derived cash/momo amounts used for shift reconciliation
      const cashAmount =
        input.paymentMethod === "CASH"
          ? total
          : input.paymentMethod === "SPLIT"
            ? (input.cashAmount ?? 0)
            : 0;
      const momoAmount =
        input.paymentMethod === "MOMO"
          ? total
          : input.paymentMethod === "SPLIT"
            ? (input.momoAmount ?? 0)
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
            discountTotal,
            total,
            amountTendered: input.paymentMethod === "CREDIT" ? 0 : effectiveTendered,
            change,
            cashAmount,
            momoAmount,
            note: input.discountNote
              ? `${input.note ? input.note + ' | ' : ''}Discount: ${input.discountNote}`
              : input.note,
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
          cashAmount: true,
          momoAmount: true,
          note: true,
          status: true,
          createdAt: true,
          cashier: { select: { name: true } },
          branch: { select: { name: true, receiptHeader: true } },
          organization: { select: { name: true } },
          customer: { select: { name: true, phone: true } },
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

  /**
   * Void a completed sale. Requires manager or owner.
   * Appends RETURN stock movements to restore inventory.
   */
  void: managerProcedure
    .input(
      z.object({
        saleId: z.string(),
        reason: z.string().trim().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const sale = await ctx.prisma.sale.findFirst({
        where: { id: input.saleId, organizationId: orgId },
        select: {
          id: true,
          status: true,
          branchId: true,
          paymentMethod: true,
          total: true,
          customerId: true,
          items: {
            select: { productId: true, quantity: true, costPrice: true },
          },
        },
      });

      if (!sale) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Sale not found" });
      }
      if (sale.status === "VOIDED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sale has already been voided",
        });
      }

      await ctx.prisma.$transaction(async (tx) => {
        await tx.sale.update({
          where: { id: sale.id },
          data: {
            status: "VOIDED",
            voidedAt: new Date(),
            voidedById: ctx.auth.userId,
            voidReason: input.reason,
          },
        });

        // Restore stock — RETURN movement for each line item
        for (const item of sale.items) {
          await tx.stockMovement.create({
            data: {
              organizationId: orgId,
              productId: item.productId,
              branchId: sale.branchId,
              type: "RETURN",
              quantity: item.quantity,
              saleId: sale.id,
              note: `Void: ${input.reason}`,
              createdById: ctx.auth.userId,
            },
          });

          await tx.stockLevel.upsert({
            where: {
              productId_branchId: {
                productId: item.productId,
                branchId: sale.branchId,
              },
            },
            create: {
              organizationId: orgId,
              productId: item.productId,
              branchId: sale.branchId,
              quantity: item.quantity,
            },
            update: { quantity: { increment: item.quantity } },
          });
        }

        // Reverse the credit ledger entry if it was a credit sale
        if (sale.paymentMethod === "CREDIT" && sale.customerId) {
          await tx.creditEntry.create({
            data: {
              organizationId: orgId,
              customerId: sale.customerId,
              type: "PAYMENT",
              amount: sale.total,
              saleId: sale.id,
              note: `Void reversal: ${input.reason}`,
              createdById: ctx.auth.userId,
            },
          });
        }
      });

      return { ok: true };
    }),

  /** Recent sales — cursor-paginated, filterable by date/cashier/method/status. */
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
          items: { select: { name: true, quantity: true, lineTotal: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  /**
   * Full sales history — cursor-based pagination, multi-filter.
   * Used by the Sales History page for browsing and auditing all transactions.
   */
  history: managerProcedure
    .input(
      z.object({
        branchId: z.string().optional(),
        cashierId: z.string().optional(),
        paymentMethod: z.enum(["CASH", "MOMO", "CREDIT", "SPLIT"]).optional(),
        status: z.enum(["COMPLETED", "VOIDED"]).optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;
      const where = {
        organizationId: orgId,
        ...(input.branchId      ? { branchId: input.branchId }             : {}),
        ...(input.cashierId     ? { cashierId: input.cashierId }           : {}),
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod }   : {}),
        ...(input.status        ? { status: input.status }                 : {}),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: new Date(input.from) } : {}),
                ...(input.to   ? { lte: new Date(input.to)   } : {}),
              },
            }
          : {}),
      };

      const items = await ctx.prisma.sale.findMany({
        where,
        select: {
          id: true,
          status: true,
          paymentMethod: true,
          total: true,
          cashAmount: true,
          momoAmount: true,
          discountTotal: true,
          note: true,
          voidReason: true,
          createdAt: true,
          cashier:  { select: { id: true, name: true } },
          customer: { select: { name: true } },
          branch:   { select: { name: true } },
          items: {
            select: { name: true, quantity: true, unitPrice: true, lineTotal: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      const hasMore = items.length > input.limit;
      const page    = hasMore ? items.slice(0, -1) : items;

      return {
        items: page,
        nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
      };
    }),
});
