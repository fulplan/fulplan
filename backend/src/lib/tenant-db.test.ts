import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db";
import { resetDatabase, seedCashier, seedTenant } from "../test/helpers";
import { tenantDb } from "./tenant-db";

/**
 * Tenant isolation is the single most important correctness property in this
 * system. These tests exist to make a cross-tenant leak impossible to ship
 * unnoticed — every one of them asserts that shop A cannot see or touch
 * shop B's data through a scoped client.
 */
describe("tenantDb isolation", () => {
  let shopA: Awaited<ReturnType<typeof seedTenant>>;
  let shopB: Awaited<ReturnType<typeof seedTenant>>;

  beforeEach(async () => {
    await resetDatabase();
    shopA = await seedTenant({ name: "Shop A", referralCode: "AAAAAA" });
    shopB = await seedTenant({ name: "Shop B", referralCode: "BBBBBB" });
    await seedCashier({
      organizationId: shopB.organizationId,
      branchId: shopB.branchId,
      name: "B Cashier",
      pin: "1234",
    });
  });

  describe("reads", () => {
    it("findMany returns only its own tenant's rows", async () => {
      const db = tenantDb(shopA.organizationId);

      const users = await db.user.findMany();
      expect(users).toHaveLength(1);
      expect(users[0]!.id).toBe(shopA.ownerId);

      // Sanity: the other shop genuinely has more users, so an unscoped
      // query would have returned them.
      expect(await prisma.user.count()).toBe(3);
    });

    it("findFirst cannot reach another tenant's branch", async () => {
      const db = tenantDb(shopA.organizationId);
      const branch = await db.branch.findFirst({
        where: { id: shopB.branchId },
      });
      expect(branch).toBeNull();
    });

    it("findUnique by primary key cannot reach another tenant's row", async () => {
      const db = tenantDb(shopA.organizationId);
      // Guessing a valid id must not be enough — this is the attack that
      // matters, since ids appear in URLs and API payloads.
      const user = await db.user.findUnique({ where: { id: shopB.ownerId } });
      expect(user).toBeNull();
    });

    it("findUniqueOrThrow throws rather than leaking", async () => {
      const db = tenantDb(shopA.organizationId);
      await expect(
        db.user.findUniqueOrThrow({ where: { id: shopB.ownerId } }),
      ).rejects.toThrow();
    });

    it("count only counts its own tenant", async () => {
      expect(await tenantDb(shopA.organizationId).user.count()).toBe(1);
      expect(await tenantDb(shopB.organizationId).user.count()).toBe(2);
    });

    it("an explicit where clause cannot widen the scope", async () => {
      const db = tenantDb(shopA.organizationId);
      // A caller trying (or being tricked into) reading another tenant still
      // gets nothing: the injected filter is applied last and wins.
      const users = await db.user.findMany({
        where: { organizationId: shopB.organizationId },
      });
      expect(users).toEqual([]);
    });

    it("scopes the Organization model by its own id", async () => {
      const db = tenantDb(shopA.organizationId);

      expect(await db.organization.findFirst()).toMatchObject({
        id: shopA.organizationId,
      });
      expect(
        await db.organization.findUnique({ where: { id: shopB.organizationId } }),
      ).toBeNull();
      expect(await db.organization.count()).toBe(1);
    });
  });

  describe("writes", () => {
    it("update cannot modify another tenant's row", async () => {
      const db = tenantDb(shopA.organizationId);

      const result = await db.user.updateMany({
        where: { id: shopB.ownerId },
        data: { name: "HACKED" },
      });
      expect(result.count).toBe(0);

      const victim = await prisma.user.findUniqueOrThrow({
        where: { id: shopB.ownerId },
      });
      expect(victim.name).toBe("Shop B Owner");
    });

    it("delete cannot remove another tenant's row", async () => {
      const db = tenantDb(shopA.organizationId);

      const result = await db.user.deleteMany({ where: { id: shopB.ownerId } });
      expect(result.count).toBe(0);

      expect(
        await prisma.user.findUnique({ where: { id: shopB.ownerId } }),
      ).not.toBeNull();
    });

    it("deleteMany with no filter only clears its own tenant", async () => {
      const db = tenantDb(shopA.organizationId);
      await db.device.deleteMany();
      await db.user.deleteMany();

      // Shop B is untouched.
      expect(
        await prisma.user.count({
          where: { organizationId: shopB.organizationId },
        }),
      ).toBe(2);
    });

    it("refuses to create a row belonging to another tenant", async () => {
      const db = tenantDb(shopA.organizationId);

      await expect(
        db.branch.create({
          data: { organizationId: shopB.organizationId, name: "Smuggled" },
        }),
      ).rejects.toThrow(/refusing to write/i);

      expect(
        await prisma.branch.count({
          where: { organizationId: shopB.organizationId },
        }),
      ).toBe(1);
    });

    it("allows creating a row for its own tenant", async () => {
      const db = tenantDb(shopA.organizationId);

      const branch = await db.branch.create({
        data: { organizationId: shopA.organizationId, name: "Second Branch" },
      });

      expect(branch.organizationId).toBe(shopA.organizationId);
    });

    it("refuses to create an Organization through a scoped client", async () => {
      const db = tenantDb(shopA.organizationId);
      await expect(
        db.organization.create({
          data: { name: "Sneaky", referralCode: "CCCCCC" },
        }),
      ).rejects.toThrow(/Cannot create an Organization/i);
    });
  });

  describe("guard rails", () => {
    it("refuses to build a client with no organization id", () => {
      expect(() => tenantDb("")).toThrow(/requires an organizationId/i);
    });
  });
});
