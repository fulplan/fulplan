import { prisma } from "../db";

/**
 * Tenant isolation — the single most important correctness property in this
 * system (see Multi-Tenancy.md and Open-Risks.md in the project vault).
 *
 * Rather than trusting every route handler to remember `where: { organizationId }`,
 * this wraps Prisma so the filter is injected automatically on every operation.
 * A developer physically cannot forget it, because they never write it.
 *
 * Design posture: FAIL CLOSED. An operation this module doesn't recognise
 * throws rather than silently running unscoped.
 *
 * Not covered (deliberately): `$queryRaw` / `$executeRaw`. Raw SQL bypasses
 * Prisma's query layer entirely, so it must scope itself by hand. Postgres
 * row-level security is the planned second net underneath this one.
 */

/** Models carrying an `organizationId` column. */
const TENANT_SCOPED_MODELS = new Set([
  "Branch",
  "User",
  "Device",
  "Product",
  "Category",
  "StockMovement",
  "StockLevel",
  "Sale",
  "Shift",
  "CashEntry",
  "Customer",
  "CreditEntry",
  "Supplier",
  "SupplierEntry",
  "StockTake",
  "SalaryRecord",
  "SalaryPayment",
  "Expense",
  // StockTakeItem is scoped via stockTakeId — no direct organizationId
]);

/** Scoped by its own primary key rather than an `organizationId` column. */
const ORGANIZATION_MODEL = "Organization";

/** Operations whose tenant filter belongs in `args.where`. */
const WHERE_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

/**
 * Operations that write a tenant value in `args.data`.
 *
 * These are VALIDATED rather than injected. Prisma's generated types already
 * require `organizationId` on create, so forgetting it is a compile error, not
 * a silent leak — there is nothing to defend against. What injection *would*
 * do is silently overwrite a wrong value, hiding a real bug. Checking instead
 * of overwriting surfaces it.
 */
const DATA_OPERATIONS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
]);

type AnyArgs = Record<string, unknown>;

/**
 * Adds the tenant filter as an additional AND condition rather than
 * overwriting whatever the caller passed.
 *
 * This distinction is security-relevant. Overwriting `where.organizationId`
 * would mean a query explicitly asking for another tenant's rows silently
 * returns YOUR rows instead — the wrong data, presented as if correct.
 * Intersecting makes such a query return nothing, which is the honest answer.
 *
 * The caller's own keys stay at the top level so `findUnique`/`update` still
 * see the unique field Prisma requires there; the tenant condition rides
 * alongside in AND.
 */
function scopeWhere(args: AnyArgs, field: string, value: string): AnyArgs {
  const where = (args.where as AnyArgs | undefined) ?? {};
  const existing = where.AND;
  const and = Array.isArray(existing)
    ? existing
    : existing !== undefined
      ? [existing]
      : [];

  return {
    ...args,
    where: { ...where, AND: [...and, { [field]: value }] },
  };
}

function assertDataScoped(
  args: AnyArgs,
  field: string,
  value: string,
  model: string,
): void {
  const rows = Array.isArray(args.data) ? args.data : [args.data];

  for (const row of rows) {
    const actual = (row as AnyArgs | undefined)?.[field];
    if (actual !== value) {
      throw new Error(
        `tenantDb: refusing to write ${model} for organization ` +
          `"${String(actual)}" from a client scoped to "${value}".`,
      );
    }
  }
}

/**
 * Returns a Prisma client permanently scoped to one organization.
 * Every query it issues is filtered to that tenant.
 */
export function tenantDb(organizationId: string) {
  if (!organizationId) {
    throw new Error("tenantDb requires an organizationId");
  }

  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const isTenantModel = TENANT_SCOPED_MODELS.has(model);
          const isOrgModel = model === ORGANIZATION_MODEL;

          // Models with no tenant dimension (none yet, but e.g. platform
          // tables later) pass through untouched.
          if (!isTenantModel && !isOrgModel) {
            return query(args);
          }

          const field = isOrgModel ? "id" : "organizationId";
          const typedArgs = (args ?? {}) as AnyArgs;

          // `query` is typed to the specific operation's args; our helpers work
          // structurally, so a cast back is needed at each hand-off.
          type QueryArgs = Parameters<typeof query>[0];

          if (WHERE_OPERATIONS.has(operation)) {
            return query(
              scopeWhere(typedArgs, field, organizationId) as QueryArgs,
            );
          }

          if (DATA_OPERATIONS.has(operation)) {
            // An Organization is created before a tenant context exists,
            // so creating one through a scoped client is always a bug.
            if (isOrgModel) {
              throw new Error(
                "Cannot create an Organization through a tenant-scoped client",
              );
            }
            assertDataScoped(typedArgs, field, organizationId, model);
            return query(args);
          }

          if (operation === "upsert") {
            assertDataScoped(
              { data: typedArgs.create },
              field,
              organizationId,
              model,
            );
            return query(
              scopeWhere(typedArgs, field, organizationId) as QueryArgs,
            );
          }

          // Fail closed: an unrecognised operation must never run unscoped.
          throw new Error(
            `tenantDb: unhandled operation "${operation}" on model "${model}". ` +
              `Add explicit handling before using it — refusing to run unscoped.`,
          );
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
