import { initTRPC } from "@trpc/server";
import { ZodError } from "zod";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Surface Zod validation details in a shape the client can render.
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;

/** Open to anyone. Use only for health checks, signup, and login. */
export const publicProcedure = t.procedure;

// protectedProcedure / tenantProcedure are added with the auth work —
// see Tracker.md "Multi-tenant foundation".
