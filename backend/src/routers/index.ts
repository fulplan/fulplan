import { router } from "../trpc";
import { authRouter } from "./auth";
import { branchesRouter } from "./branches";
import { categoriesRouter } from "./categories";
import { devicesRouter } from "./devices";
import { healthRouter } from "./health";
import { productsRouter } from "./products";
import { staffRouter } from "./staff";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  staff: staffRouter,
  devices: devicesRouter,
  branches: branchesRouter,
  categories: categoriesRouter,
  products: productsRouter,
});

/** The frontend imports this type only — no server code crosses the wire. */
export type AppRouter = typeof appRouter;
