import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc";

/** Emails that can access platform-level admin. Comma-separated env var. */
function adminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Looks up the calling user's email and verifies it is in PLATFORM_ADMIN_EMAILS. */
const platformAdminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await ctx.prisma.user.findUnique({
    where: { id: ctx.auth.userId },
    select: { email: true },
  });

  const email = user?.email?.toLowerCase() ?? "";
  if (!email || !adminEmails().has(email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Platform admin access required",
    });
  }

  return next({ ctx });
});

export const superAdminRouter = router({
  /** Returns true/false so the frontend can conditionally show the admin entry point. */
  isAdmin: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.auth.userId },
      select: { email: true },
    });
    const email = user?.email?.toLowerCase() ?? "";
    return adminEmails().has(email);
  }),

  /** Platform-level stats: org counts, total sales. */
  getStats: platformAdminProcedure.query(async ({ ctx }) => {
    const [total, trialing, active, pastDue, locked, cancelled, totalSales, totalOrgsAllTime] =
      await Promise.all([
        ctx.prisma.organization.count({ where: { deletedAt: null } }),
        ctx.prisma.organization.count({ where: { subscriptionStatus: "TRIALING", deletedAt: null } }),
        ctx.prisma.organization.count({ where: { subscriptionStatus: "ACTIVE", deletedAt: null } }),
        ctx.prisma.organization.count({ where: { subscriptionStatus: "PAST_DUE", deletedAt: null } }),
        ctx.prisma.organization.count({ where: { subscriptionStatus: "LOCKED", deletedAt: null } }),
        ctx.prisma.organization.count({ where: { subscriptionStatus: "CANCELLED", deletedAt: null } }),
        ctx.prisma.sale.count({ where: { status: "COMPLETED" } }),
        ctx.prisma.organization.count(),
      ]);

    return { total, trialing, active, pastDue, locked, cancelled, totalSales, totalOrgsAllTime };
  }),

  /** All active organisations with basic stats. */
  listOrgs: platformAdminProcedure.query(async ({ ctx }) => {
    const orgs = await ctx.prisma.organization.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        createdAt: true,
        referralCode: true,
        _count: {
          select: { users: true, sales: true, products: true },
        },
        users: {
          where: { role: "OWNER" },
          select: { email: true, name: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return orgs.map((o) => ({
      id: o.id,
      name: o.name,
      subscriptionStatus: o.subscriptionStatus,
      trialEndsAt: o.trialEndsAt?.toISOString() ?? null,
      createdAt: o.createdAt.toISOString(),
      ownerEmail: o.users[0]?.email ?? null,
      ownerName: o.users[0]?.name ?? null,
      userCount: o._count.users,
      saleCount: o._count.sales,
      productCount: o._count.products,
    }));
  }),

  /** Update an organisation's subscription status and/or trial end date. */
  updateSubscription: platformAdminProcedure
    .input(
      z.object({
        orgId: z.string(),
        status: z.enum(["TRIALING", "ACTIVE", "PAST_DUE", "LOCKED", "CANCELLED"]),
        trialEndsAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.organization.update({
        where: { id: input.orgId },
        data: {
          subscriptionStatus: input.status,
          ...(input.trialEndsAt ? { trialEndsAt: new Date(input.trialEndsAt) } : {}),
        },
        select: { id: true, subscriptionStatus: true, trialEndsAt: true },
      });
    }),

  /** Recent sales across ALL organisations — for the platform activity feed. */
  recentActivity: platformAdminProcedure.query(async ({ ctx }) => {
    const sales = await ctx.prisma.sale.findMany({
      where: { status: "COMPLETED" },
      select: {
        id: true,
        total: true,
        paymentMethod: true,
        createdAt: true,
        organization: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return sales.map((s) => ({
      id: s.id,
      total: s.total,
      paymentMethod: s.paymentMethod as string,
      createdAt: s.createdAt.toISOString(),
      orgName: s.organization.name,
      branchName: s.branch.name,
    }));
  }),

  /** Platform-wide today stats for the admin live header. */
  todayStats: platformAdminProcedure.query(async ({ ctx }) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [salesToday, newOrgsToday] = await Promise.all([
      ctx.prisma.sale.findMany({
        where: { status: "COMPLETED", createdAt: { gte: start } },
        select: { total: true },
      }),
      ctx.prisma.organization.count({ where: { createdAt: { gte: start }, deletedAt: null } }),
    ]);
    const revenue = salesToday.reduce((s, r) => s + r.total, 0);
    // count distinct orgs that sold today
    const activeOrgs = await ctx.prisma.sale.groupBy({
      by: ["organizationId"],
      where: { status: "COMPLETED", createdAt: { gte: start } },
    });
    return {
      salesCount: salesToday.length,
      revenue,
      activeOrgs: activeOrgs.length,
      newOrgs: newOrgsToday,
    };
  }),

  /** Extend a trial by N days from today. */
  extendTrial: platformAdminProcedure
    .input(z.object({ orgId: z.string(), days: z.number().int().min(1).max(365) }))
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.prisma.organization.findUniqueOrThrow({
        where: { id: input.orgId },
        select: { trialEndsAt: true },
      });

      const base = org.trialEndsAt && org.trialEndsAt > new Date() ? org.trialEndsAt : new Date();
      const trialEndsAt = new Date(base.getTime() + input.days * 24 * 60 * 60 * 1000);

      return ctx.prisma.organization.update({
        where: { id: input.orgId },
        data: { subscriptionStatus: "TRIALING", trialEndsAt },
        select: { id: true, subscriptionStatus: true, trialEndsAt: true },
      });
    }),
});
