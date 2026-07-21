import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../trpc";

export const customersRouter = router({
  /**
   * Paginated list of customers with their current balance.
   * Balance = sum of CHARGE entries - sum of PAYMENT entries (pesewas, never negative by design).
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

      const customers = await ctx.prisma.customer.findMany({
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
          _count: { select: { sales: true } },
          creditEntries: {
            select: { type: true, amount: true },
          },
        },
        orderBy: { name: "asc" },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });

      let nextCursor: string | undefined;
      if (customers.length > input.limit) {
        nextCursor = customers.pop()!.id;
      }

      return {
        customers: customers.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          notes: c.notes,
          creditLimit: c.creditLimit,
          active: c.active,
          createdAt: c.createdAt,
          salesCount: c._count.sales,
          balance: computeBalance(c.creditEntries),
        })),
        nextCursor,
      };
    }),

  /**
   * Single customer with full credit ledger.
   */
  get: tenantProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const customer = await ctx.prisma.customer.findFirst({
        where: { id: input.customerId, organizationId: orgId },
        include: {
          creditEntries: {
            include: {
              sale: { select: { id: true, createdAt: true } },
              createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 100,
          },
        },
      });

      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }

      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        notes: customer.notes,
        creditLimit: customer.creditLimit,
        active: customer.active,
        createdAt: customer.createdAt,
        balance: computeBalance(customer.creditEntries),
        entries: customer.creditEntries,
      };
    }),

  /**
   * Create a new customer.
   */
  create: managerProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        phone: z.string().trim().max(20).optional(),
        notes: z.string().trim().max(500).optional(),
        creditLimit: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.customer.create({
        data: {
          organizationId: ctx.auth.organizationId,
          name: input.name,
          phone: input.phone,
          notes: input.notes,
          creditLimit: input.creditLimit,
        },
        select: { id: true, name: true, phone: true, creditLimit: true },
      });
    }),

  /**
   * Update customer profile.
   */
  update: managerProcedure
    .input(
      z.object({
        customerId: z.string(),
        name: z.string().trim().min(1).max(100).optional(),
        phone: z.string().trim().max(20).optional(),
        notes: z.string().trim().max(500).optional(),
        creditLimit: z.number().int().nonnegative().nullable().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const existing = await ctx.prisma.customer.findFirst({
        where: { id: input.customerId, organizationId: orgId },
        select: { id: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }

      return ctx.prisma.customer.update({
        where: { id: input.customerId },
        data: {
          name: input.name,
          phone: input.phone,
          notes: input.notes,
          creditLimit: input.creditLimit,
          active: input.active,
        },
        select: { id: true, name: true, phone: true, creditLimit: true, active: true },
      });
    }),

  /**
   * Record a repayment. Creates a PAYMENT CreditEntry.
   */
  addPayment: managerProcedure
    .input(
      z.object({
        customerId: z.string(),
        amount: z.number().int().positive(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const customer = await ctx.prisma.customer.findFirst({
        where: { id: input.customerId, organizationId: orgId },
        select: { id: true, name: true },
      });

      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" });
      }

      return ctx.prisma.creditEntry.create({
        data: {
          organizationId: orgId,
          customerId: input.customerId,
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
    (sum, e) => sum + (e.type === "CHARGE" ? e.amount : -e.amount),
    0,
  );
}
