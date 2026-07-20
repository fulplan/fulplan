import { router, tenantProcedure } from "../trpc";

export const branchesRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db.branch.findMany({
      select: { id: true, name: true, address: true },
      orderBy: { name: "asc" },
    });
  }),
});
