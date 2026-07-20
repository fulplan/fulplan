import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, router, tenantProcedure } from "../trpc";

export const categoriesRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db.category.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }),

  create: managerProcedure
    .input(z.object({ name: z.string().trim().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.category.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" } },
        select: { id: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `A category named "${input.name}" already exists`,
        });
      }
      return ctx.db.category.create({
        data: { organizationId: ctx.auth.organizationId, name: input.name },
        select: { id: true, name: true },
      });
    }),

  rename: managerProcedure
    .input(z.object({ id: z.string(), name: z.string().trim().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.category.update({
        where: { id: input.id },
        data: { name: input.name },
      });
      return { ok: true };
    }),
});
