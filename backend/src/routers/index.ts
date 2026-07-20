import { router } from "../trpc";
import { healthRouter } from "./health";

export const appRouter = router({
  health: healthRouter,
});

/** The frontend imports this type only — no server code crosses the wire. */
export type AppRouter = typeof appRouter;
