import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../trpc";

const productInput = z.object({
  name: z.string().trim().min(1).max(200),
  barcode: z.string().trim().max(50).optional(),
  categoryId: z.string().optional(),
  purchaseUnit: z.string().trim().min(1).max(30).default("unit"),
  saleUnit: z.string().trim().min(1).max(30).default("unit"),
  unitsPerPurchase: z.number().int().positive().default(1),
  costPrice: z.number().int().nonnegative(),
  sellingPrice: z.number().int().positive(),
  lowStockThreshold: z.number().int().nonnegative().default(5),
});

export const productsRouter = router({
  /**
   * Full product list for the tenant, with the stock level for the requested
   * branch injected as a flat field (null if no branch specified).
   */
  list: tenantProcedure
    .input(z.object({ branchId: z.string().optional(), includeInactive: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const branchId = input.branchId ?? ctx.auth.branchId ?? null;

      const products = await ctx.db.product.findMany({
        where: input.includeInactive ? {} : { active: true },
        select: {
          id: true,
          name: true,
          barcode: true,
          categoryId: true,
          category: { select: { id: true, name: true } },
          purchaseUnit: true,
          saleUnit: true,
          unitsPerPurchase: true,
          costPrice: true,
          sellingPrice: true,
          lowStockThreshold: true,
          active: true,
          stockLevels: branchId
            ? { where: { branchId }, select: { quantity: true } }
            : false,
        },
        orderBy: [{ name: "asc" }],
      });

      return products.map((p) => ({
        ...p,
        stockQuantity: branchId ? (p.stockLevels[0]?.quantity ?? 0) : null,
        stockLevels: undefined,
      }));
    }),

  get: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.product.findFirst({
        where: { id: input.id },
        include: {
          category: { select: { id: true, name: true } },
          stockLevels: {
            select: {
              quantity: true,
              branchId: true,
              branch: { select: { name: true } },
            },
          },
        },
      });
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }
      return product;
    }),

  /**
   * Create a product, optionally seeding its stock at a specific branch.
   * Uses raw prisma inside the transaction so the tenant condition is applied
   * via explicit organizationId rather than the extension wrapper.
   */
  create: managerProcedure
    .input(
      productInput.extend({
        initialStock: z.number().int().nonnegative().optional(),
        branchId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { initialStock, branchId, ...productData } = input;
      const orgId = ctx.auth.organizationId;

      return ctx.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: { ...productData, organizationId: orgId },
        });

        if (initialStock && initialStock > 0 && branchId) {
          await tx.stockLevel.create({
            data: {
              organizationId: orgId,
              productId: product.id,
              branchId,
              quantity: initialStock,
            },
          });
          await tx.stockMovement.create({
            data: {
              organizationId: orgId,
              productId: product.id,
              branchId,
              type: "ADJUSTMENT",
              quantity: initialStock,
              note: "Initial stock",
              createdById: ctx.auth.userId,
            },
          });
        }

        return product;
      });
    }),

  update: managerProcedure
    .input(productInput.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.product.update({
        where: { id },
        data,
      });
    }),

  setActive: managerProcedure
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.product.update({
        where: { id: input.id },
        data: { active: input.active },
      });
      return { ok: true };
    }),

  /**
   * Manual stock adjustment — creates an event-sourced movement record and
   * updates the per-branch cache atomically. quantity is SIGNED (sale units):
   * positive to add stock, negative to remove.
   */
  adjustStock: managerProcedure
    .input(
      z.object({
        productId: z.string(),
        branchId: z.string(),
        quantity: z.number().int().refine((n) => n !== 0, "Quantity must not be zero"),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      // Verify the product belongs to this tenant before touching stock.
      const product = await ctx.db.product.findFirst({
        where: { id: input.productId },
        select: { id: true },
      });
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      await ctx.prisma.$transaction([
        ctx.prisma.stockMovement.create({
          data: {
            organizationId: orgId,
            productId: input.productId,
            branchId: input.branchId,
            type: "ADJUSTMENT",
            quantity: input.quantity,
            note: input.note,
            createdById: ctx.auth.userId,
          },
        }),
        ctx.prisma.stockLevel.upsert({
          where: {
            productId_branchId: {
              productId: input.productId,
              branchId: input.branchId,
            },
          },
          create: {
            organizationId: orgId,
            productId: input.productId,
            branchId: input.branchId,
            quantity: input.quantity,
          },
          update: { quantity: { increment: input.quantity } },
        }),
      ]);

      return { ok: true };
    }),
});
