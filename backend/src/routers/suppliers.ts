import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../trpc";

export const suppliersRouter = router({
  /**
   * Paginated list of suppliers with current balance owed.
   * Balance = sum(PURCHASE amounts) − sum(PAYMENT amounts).
   */
  list: tenantProcedure
    .input(
      z.object({
        search: z.string().trim().optional(),
        activeOnly: z.boolean().default(true),
        limit: z.number().int().positive().max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const suppliers = await ctx.prisma.supplier.findMany({
        where: {
          organizationId: orgId,
          active: input.activeOnly ? true : undefined,
          OR: input.search
            ? [
                { name: { contains: input.search, mode: "insensitive" } },
                { phone: { contains: input.search, mode: "insensitive" } },
              ]
            : undefined,
        },
        include: {
          entries: { select: { type: true, amount: true } },
        },
        orderBy: { name: "asc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (suppliers.length > input.limit) {
        nextCursor = suppliers.pop()!.id;
      }

      return {
        suppliers: suppliers.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone,
          email: s.email,
          notes: s.notes,
          active: s.active,
          createdAt: s.createdAt,
          balance: computeBalance(s.entries),
        })),
        nextCursor,
      };
    }),

  /**
   * Single supplier with full ledger.
   */
  get: tenantProcedure
    .input(z.object({ supplierId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const supplier = await ctx.prisma.supplier.findFirst({
        where: { id: input.supplierId, organizationId: orgId },
        include: {
          entries: {
            include: { createdBy: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 100,
          },
        },
      });

      if (!supplier) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Supplier not found" });
      }

      return {
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        notes: supplier.notes,
        active: supplier.active,
        createdAt: supplier.createdAt,
        balance: computeBalance(supplier.entries),
        entries: supplier.entries,
      };
    }),

  /** Create a new supplier. */
  create: managerProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        phone: z.string().trim().max(20).optional(),
        email: z.string().trim().email().max(100).optional(),
        notes: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.supplier.create({
        data: {
          organizationId: ctx.auth.organizationId,
          name: input.name,
          phone: input.phone,
          email: input.email,
          notes: input.notes,
        },
        select: { id: true, name: true, phone: true },
      });
    }),

  /** Update supplier profile. */
  update: managerProcedure
    .input(
      z.object({
        supplierId: z.string(),
        name: z.string().trim().min(1).max(100).optional(),
        phone: z.string().trim().max(20).optional(),
        email: z.string().trim().email().max(100).optional(),
        notes: z.string().trim().max(500).optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const existing = await ctx.prisma.supplier.findFirst({
        where: { id: input.supplierId, organizationId: orgId },
        select: { id: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Supplier not found" });
      }

      return ctx.prisma.supplier.update({
        where: { id: input.supplierId },
        data: {
          name: input.name,
          phone: input.phone,
          email: input.email,
          notes: input.notes,
          active: input.active,
        },
        select: { id: true, name: true, phone: true, active: true },
      });
    }),

  /** Record a purchase on credit (adds to balance owed). */
  addPurchase: managerProcedure
    .input(
      z.object({
        supplierId: z.string(),
        amount: z.number().int().positive(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const supplier = await ctx.prisma.supplier.findFirst({
        where: { id: input.supplierId, organizationId: orgId },
        select: { id: true },
      });

      if (!supplier) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Supplier not found" });
      }

      return ctx.prisma.supplierEntry.create({
        data: {
          organizationId: orgId,
          supplierId: input.supplierId,
          type: "PURCHASE",
          amount: input.amount,
          note: input.note,
          createdById: ctx.auth.userId,
        },
        select: { id: true, type: true, amount: true, createdAt: true },
      });
    }),

  /** Record a payment to a supplier (reduces balance owed). */
  addPayment: managerProcedure
    .input(
      z.object({
        supplierId: z.string(),
        amount: z.number().int().positive(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const supplier = await ctx.prisma.supplier.findFirst({
        where: { id: input.supplierId, organizationId: orgId },
        select: { id: true },
      });

      if (!supplier) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Supplier not found" });
      }

      return ctx.prisma.supplierEntry.create({
        data: {
          organizationId: orgId,
          supplierId: input.supplierId,
          type: "PAYMENT",
          amount: input.amount,
          note: input.note,
          createdById: ctx.auth.userId,
        },
        select: { id: true, type: true, amount: true, createdAt: true },
      });
    }),
});

function computeBalance(entries: { type: string; amount: number }[]): number {
  return entries.reduce(
    (sum, e) => sum + (e.type === "PURCHASE" ? e.amount : -e.amount),
    0,
  );
}
