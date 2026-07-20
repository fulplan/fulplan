import { router } from "../trpc";
import { authRouter } from "./auth";
import { devicesRouter } from "./devices";
import { healthRouter } from "./health";
import { staffRouter } from "./staff";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  staff: staffRouter,
  devices: devicesRouter,
});

/** The frontend imports this type only — no server code crosses the wire. */
export type AppRouter = typeof appRouter;
