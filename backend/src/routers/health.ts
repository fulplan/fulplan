import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  /** Liveness — does the API respond at all? */
  ping: publicProcedure.query(() => ({
    ok: true,
    service: "ghpos-api",
    time: new Date().toISOString(),
  })),

  /** Readiness — can the API actually reach Postgres? */
  db: publicProcedure.query(async ({ ctx }) => {
    const organizations = await ctx.prisma.organization.count();
    return { ok: true, organizations };
  }),
});
