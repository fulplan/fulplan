import { router } from "../trpc";
import { authRouter } from "./auth";
import { branchesRouter } from "./branches";
import { categoriesRouter } from "./categories";
import { customersRouter } from "./customers";
import { devicesRouter } from "./devices";
import { accountRouter } from "./account";
import { expensesRouter } from "./expenses";
import { exportRouter } from "./export";
import { reportsRouter } from "./reports";
import { suppliersRouter } from "./suppliers";
import { stockTakesRouter } from "./stockTakes";
import { healthRouter } from "./health";
import { productsRouter } from "./products";
import { salesRouter } from "./sales";
import { salaryRouter } from "./salary";
import { shiftsRouter } from "./shifts";
import { staffRouter } from "./staff";
import { superAdminRouter } from "./superAdmin";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  staff: staffRouter,
  devices: devicesRouter,
  branches: branchesRouter,
  categories: categoriesRouter,
  products: productsRouter,
  sales: salesRouter,
  shifts: shiftsRouter,
  customers: customersRouter,
  suppliers: suppliersRouter,
  stockTakes: stockTakesRouter,
  salary: salaryRouter,
  expenses: expensesRouter,
  reports: reportsRouter,
  export: exportRouter,
  account: accountRouter,
  superAdmin: superAdminRouter,
});

/** The frontend imports this type only — no server code crosses the wire. */
export type AppRouter = typeof appRouter;
