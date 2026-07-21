import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router } from "../trpc";

export const salaryRouter = router({
  /**
   * List all active staff with their current agreed salary and YTD payments.
   */
  listStaff: managerProcedure.query(async ({ ctx }) => {
    const orgId = ctx.auth.organizationId;

    const staff = await ctx.prisma.user.findMany({
      where: { organizationId: orgId, active: true },
      select: {
        id: true,
        name: true,
        role: true,
        branchId: true,
        branch: { select: { name: true } },
        salaryRecords: {
          orderBy: { effectiveFrom: "desc" },
          take: 1,
          select: { id: true, agreedAmount: true, effectiveFrom: true },
        },
        salaryPayments: {
          select: { amount: true, type: true, paidAt: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return staff.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      branchName: u.branch?.name ?? null,
      agreedAmount: u.salaryRecords[0]?.agreedAmount ?? null,
      totalPaidThisMonth: u.salaryPayments
        .filter((p) => {
          const d = new Date(p.paidAt);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        })
        .reduce((sum, p) => sum + p.amount, 0),
    }));
  }),

  /**
   * Full salary history for one staff member.
   */
  getStaff: managerProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const user = await ctx.prisma.user.findFirst({
        where: { id: input.userId, organizationId: orgId },
        select: {
          id: true,
          name: true,
          role: true,
          salaryRecords: {
            orderBy: { effectiveFrom: "desc" },
            select: {
              id: true,
              agreedAmount: true,
              effectiveFrom: true,
              note: true,
              createdBy: { select: { name: true } },
            },
          },
          salaryPayments: {
            orderBy: { paidAt: "desc" },
            take: 50,
            select: {
              id: true,
              type: true,
              amount: true,
              paidAt: true,
              note: true,
              createdBy: { select: { name: true } },
            },
          },
        },
      });

      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      return user;
    }),

  /**
   * Set (or update) the agreed monthly salary for a staff member.
   */
  setSalary: managerProcedure
    .input(
      z.object({
        userId: z.string(),
        agreedAmount: z.number().int().nonnegative(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const user = await ctx.prisma.user.findFirst({
        where: { id: input.userId, organizationId: orgId },
        select: { id: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.salaryRecord.create({
        data: {
          organizationId: orgId,
          userId: input.userId,
          agreedAmount: input.agreedAmount,
          note: input.note,
          createdById: ctx.auth.userId,
        },
        select: { id: true, agreedAmount: true, effectiveFrom: true },
      });
    }),

  /**
   * Record a salary payment or advance.
   */
  addPayment: managerProcedure
    .input(
      z.object({
        userId: z.string(),
        type: z.enum(["PAYMENT", "ADVANCE"]),
        amount: z.number().int().positive(),
        paidAt: z.string().datetime().optional(),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const orgId = ctx.auth.organizationId;

      const user = await ctx.prisma.user.findFirst({
        where: { id: input.userId, organizationId: orgId },
        select: { id: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.prisma.salaryPayment.create({
        data: {
          organizationId: orgId,
          userId: input.userId,
          type: input.type,
          amount: input.amount,
          paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
          note: input.note,
          createdById: ctx.auth.userId,
        },
        select: { id: true, type: true, amount: true, paidAt: true },
      });
    }),
});
