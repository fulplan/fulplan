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

  /**
   * Bulk-import a starter catalog of common Ghanaian provision store products.
   * Skips any product whose name already exists in the tenant's catalog.
   * Returns how many were created vs skipped.
   */
  importStarterCatalog: managerProcedure
    .input(z.object({ branchId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const existing = await ctx.db.product.findMany({
        where: { organizationId: orgId },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

      // Common provision store items in Ghana — prices in pesewas (~70-80% margin)
      const catalog: Array<{ name: string; costPrice: number; sellingPrice: number; lowStockThreshold: number }> = [
        // Dry goods
        { name: "Rice (5kg bag)", costPrice: 7500, sellingPrice: 9000, lowStockThreshold: 10 },
        { name: "Rice (1kg)", costPrice: 1500, sellingPrice: 1800, lowStockThreshold: 20 },
        { name: "Sugar (1kg)", costPrice: 600, sellingPrice: 800, lowStockThreshold: 20 },
        { name: "Sugar (500g)", costPrice: 300, sellingPrice: 420, lowStockThreshold: 15 },
        { name: "Flour (2kg)", costPrice: 1200, sellingPrice: 1500, lowStockThreshold: 10 },
        { name: "Salt (1kg)", costPrice: 200, sellingPrice: 280, lowStockThreshold: 10 },
        { name: "Salt (500g)", costPrice: 100, sellingPrice: 150, lowStockThreshold: 10 },
        // Oils
        { name: "Cooking Oil (1L)", costPrice: 1600, sellingPrice: 2000, lowStockThreshold: 10 },
        { name: "Cooking Oil (500ml)", costPrice: 800, sellingPrice: 1100, lowStockThreshold: 10 },
        { name: "Palm Oil (1L)", costPrice: 1400, sellingPrice: 1700, lowStockThreshold: 5 },
        // Tomatoes & canned goods
        { name: "Tomato Paste (70g)", costPrice: 100, sellingPrice: 130, lowStockThreshold: 30 },
        { name: "Tomato Paste (400g)", costPrice: 380, sellingPrice: 500, lowStockThreshold: 20 },
        { name: "Sardines (tin)", costPrice: 350, sellingPrice: 450, lowStockThreshold: 15 },
        { name: "Corned Beef (200g)", costPrice: 650, sellingPrice: 850, lowStockThreshold: 10 },
        // Milk & beverages
        { name: "Peak Milk (170g)", costPrice: 400, sellingPrice: 520, lowStockThreshold: 20 },
        { name: "Milo (200g)", costPrice: 900, sellingPrice: 1200, lowStockThreshold: 10 },
        { name: "Nescafé (sachet)", costPrice: 60, sellingPrice: 80, lowStockThreshold: 30 },
        { name: "Tea Bags (25 pack)", costPrice: 280, sellingPrice: 380, lowStockThreshold: 10 },
        // Beverages
        { name: "Water (sachet pack)", costPrice: 150, sellingPrice: 200, lowStockThreshold: 20 },
        { name: "Soft Drink (500ml)", costPrice: 300, sellingPrice: 400, lowStockThreshold: 20 },
        // Soap & household
        { name: "Soap (bar)", costPrice: 150, sellingPrice: 200, lowStockThreshold: 20 },
        { name: "Washing Powder (1kg)", costPrice: 700, sellingPrice: 950, lowStockThreshold: 10 },
        { name: "Bleach (500ml)", costPrice: 250, sellingPrice: 340, lowStockThreshold: 10 },
        { name: "Toilet Roll (4 pack)", costPrice: 450, sellingPrice: 600, lowStockThreshold: 10 },
        // Snacks & bread
        { name: "Bread (loaf)", costPrice: 500, sellingPrice: 650, lowStockThreshold: 10 },
        { name: "Biscuits (pack)", costPrice: 150, sellingPrice: 200, lowStockThreshold: 20 },
        { name: "Instant Noodles", costPrice: 180, sellingPrice: 250, lowStockThreshold: 20 },
        // Seasoning
        { name: "Maggi Cube (10 pack)", costPrice: 150, sellingPrice: 200, lowStockThreshold: 20 },
        { name: "Pepper (100g)", costPrice: 200, sellingPrice: 280, lowStockThreshold: 10 },
      ];

      let created = 0;
      let skipped = 0;

      for (const item of catalog) {
        if (existingNames.has(item.name.toLowerCase())) {
          skipped++;
          continue;
        }

        const product = await ctx.db.product.create({
          data: {
            organizationId: orgId,
            name: item.name,
            costPrice: item.costPrice,
            sellingPrice: item.sellingPrice,
            lowStockThreshold: item.lowStockThreshold,
          },
          select: { id: true },
        });

        // Set initial stock level to 0 for the specified branch
        if (input.branchId) {
          await ctx.db.stockLevel.create({
            data: {
              organizationId: orgId,
              productId: product.id,
              branchId: input.branchId,
              quantity: 0,
            },
          });
        }

        created++;
      }

      return { created, skipped, total: catalog.length };
    }),
});
