import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { beforeEach, describe, expect, it } from "vitest";
import { createContext } from "../context";
import { prisma } from "../db";
import { __resetRateLimits } from "../lib/rate-limit";
import { signAccessToken } from "../lib/tokens";
import {
  caller,
  resetDatabase,
  seedCashier,
  seedDevice,
  seedTenant,
} from "../test/helpers";

/** Builds a context the way a real HTTP request would, via the JWT header. */
async function contextFromToken(token: string) {
  return createContext({
    req: { headers: { authorization: `Bearer ${token}` } },
    res: {},
  } as unknown as CreateFastifyContextOptions);
}

describe("auth", () => {
  beforeEach(async () => {
    await resetDatabase();
    __resetRateLimits();
  });

  describe("signup", () => {
    const validSignup = {
      shopName: "Mama Aco Provisions",
      ownerName: "Ama Mensah",
      email: "ama@example.com",
      password: "correct horse battery",
      branchName: "Main Branch",
    };

    it("creates the organization, branch, and owner together", async () => {
      const result = await caller().auth.signup(validSignup);

      expect(result.user.role).toBe("OWNER");
      expect(result.organization.name).toBe("Mama Aco Provisions");
      expect(result.token).toBeTruthy();

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: result.organization.id },
        include: { branches: true, users: true },
      });

      expect(org.branches).toHaveLength(1);
      expect(org.users).toHaveLength(1);
      expect(org.subscriptionStatus).toBe("TRIALING");
    });

    it("starts a 30-day trial", async () => {
      const result = await caller().auth.signup(validSignup);

      const daysAway = Math.round(
        (result.organization.trialEndsAt!.getTime() - Date.now()) / 86_400_000,
      );
      expect(daysAway).toBe(30);
    });

    it("issues a unique referral code", async () => {
      const a = await caller().auth.signup(validSignup);
      const b = await caller().auth.signup({
        ...validSignup,
        email: "kofi@example.com",
        shopName: "Kofi Store",
      });

      expect(a.organization.referralCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(a.organization.referralCode).not.toBe(b.organization.referralCode);
    });

    it("records a valid referral code", async () => {
      const referrer = await seedTenant({
        name: "Referrer Shop",
        referralCode: "REF123",
      });

      const result = await caller().auth.signup({
        ...validSignup,
        referralCode: "ref123", // case-insensitive on the way in
      });

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: result.organization.id },
      });
      expect(org.referredByCode).toBe("REF123");
      expect(referrer.organizationId).toBeTruthy();
    });

    it("does not block signup on an unknown referral code", async () => {
      const result = await caller().auth.signup({
        ...validSignup,
        referralCode: "NOPE99",
      });

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: result.organization.id },
      });
      expect(org.referredByCode).toBeNull();
    });

    it("rejects a short password", async () => {
      await expect(
        caller().auth.signup({ ...validSignup, password: "short" }),
      ).rejects.toThrow();
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      await seedTenant({
        name: "Shop A",
        referralCode: "AAAAAA",
        ownerEmail: "owner@shopa.com",
        ownerPassword: "supersecret123",
      });
    });

    it("signs in with the right password", async () => {
      const result = await caller().auth.login({
        email: "owner@shopa.com",
        password: "supersecret123",
      });

      expect(result.status).toBe("ok");
      if (result.status !== "ok") throw new Error("unreachable");
      expect(result.token).toBeTruthy();
      expect(result.user.role).toBe("OWNER");
    });

    it("rejects a wrong password", async () => {
      await expect(
        caller().auth.login({
          email: "owner@shopa.com",
          password: "wrong-password",
        }),
      ).rejects.toThrow(/incorrect details/i);
    });

    it("gives the same error for an unknown email — no user enumeration", async () => {
      await expect(
        caller().auth.login({
          email: "nobody@nowhere.com",
          password: "supersecret123",
        }),
      ).rejects.toThrow(/incorrect details/i);
    });

    it("asks which shop when one email owns several", async () => {
      await seedTenant({
        name: "Shop B",
        referralCode: "BBBBBB",
        ownerEmail: "owner@shopa.com",
        ownerPassword: "supersecret123",
      });

      const result = await caller().auth.login({
        email: "owner@shopa.com",
        password: "supersecret123",
      });

      expect(result.status).toBe("choose_organization");
      if (result.status !== "choose_organization") throw new Error("unreachable");
      expect(result.organizations).toHaveLength(2);
    });

    it("locks out after repeated failures", async () => {
      for (let i = 0; i < 5; i++) {
        await expect(
          caller().auth.login({ email: "owner@shopa.com", password: "nope" }),
        ).rejects.toThrow();
      }

      // Even the correct password is refused while locked out.
      await expect(
        caller().auth.login({
          email: "owner@shopa.com",
          password: "supersecret123",
        }),
      ).rejects.toThrow(/too many attempts/i);
    });
  });

  describe("pinLogin", () => {
    it("signs a cashier in with their PIN", async () => {
      const shop = await seedTenant({ name: "Shop A", referralCode: "AAAAAA" });
      const cashier = await seedCashier({
        organizationId: shop.organizationId,
        branchId: shop.branchId,
        name: "Kofi",
        pin: "4821",
      });

      const result = await caller().auth.pinLogin({
        userId: cashier.id,
        pin: "4821",
      });

      expect(result.user.name).toBe("Kofi");
      expect(result.user.role).toBe("CASHIER");
    });

    it("rejects a wrong PIN", async () => {
      const shop = await seedTenant({ name: "Shop A", referralCode: "AAAAAA" });
      const cashier = await seedCashier({
        organizationId: shop.organizationId,
        branchId: shop.branchId,
        name: "Kofi",
        pin: "4821",
      });

      await expect(
        caller().auth.pinLogin({ userId: cashier.id, pin: "0000" }),
      ).rejects.toThrow(/incorrect details/i);
    });

    it("rejects a PIN that is not 4-6 digits", async () => {
      const shop = await seedTenant({ name: "Shop A", referralCode: "AAAAAA" });
      const cashier = await seedCashier({
        organizationId: shop.organizationId,
        branchId: shop.branchId,
        name: "Kofi",
        pin: "4821",
      });

      await expect(
        caller().auth.pinLogin({ userId: cashier.id, pin: "abc" }),
      ).rejects.toThrow();
    });
  });

  describe("device revocation", () => {
    it("cuts off a revoked device on its very next request", async () => {
      const shop = await seedTenant({ name: "Shop A", referralCode: "AAAAAA" });
      const { device } = await seedDevice({
        organizationId: shop.organizationId,
        userId: shop.ownerId,
        branchId: shop.branchId,
      });

      const token = await signAccessToken({
        userId: shop.ownerId,
        organizationId: shop.organizationId,
        branchId: shop.branchId,
        role: "OWNER",
        deviceId: device.id,
      });

      // Works while the device is trusted.
      expect((await contextFromToken(token)).auth).not.toBeNull();

      await prisma.device.update({
        where: { id: device.id },
        data: { revokedAt: new Date() },
      });

      // The JWT is still cryptographically valid, but the session is dead —
      // which is the whole point for a stolen tablet.
      expect((await contextFromToken(token)).auth).toBeNull();
    });
  });

  describe("permissions", () => {
    it("stops a cashier from creating staff", async () => {
      const shop = await seedTenant({ name: "Shop A", referralCode: "AAAAAA" });
      const cashier = await seedCashier({
        organizationId: shop.organizationId,
        branchId: shop.branchId,
        name: "Kofi",
        pin: "4821",
      });

      const asCashier = caller({
        userId: cashier.id,
        organizationId: shop.organizationId,
        branchId: shop.branchId,
        role: "CASHIER",
        deviceId: null,
      });

      await expect(
        asCashier.staff.create({ name: "New Guy", role: "CASHIER", pin: "1111" }),
      ).rejects.toThrow(/permission/i);
    });

    it("stops a manager from creating another manager", async () => {
      const shop = await seedTenant({ name: "Shop A", referralCode: "AAAAAA" });
      const manager = await prisma.user.create({
        data: {
          organizationId: shop.organizationId,
          branchId: shop.branchId,
          name: "Manager",
          role: "MANAGER",
        },
      });

      const asManager = caller({
        userId: manager.id,
        organizationId: shop.organizationId,
        branchId: shop.branchId,
        role: "MANAGER",
        deviceId: null,
      });

      await expect(
        asManager.staff.create({
          name: "Another Manager",
          role: "MANAGER",
          email: "m2@example.com",
          password: "password123",
        }),
      ).rejects.toThrow(/only the owner/i);
    });

    it("lets an owner add a cashier who can then sign in", async () => {
      const shop = await seedTenant({ name: "Shop A", referralCode: "AAAAAA" });

      const created = await caller(shop.ownerAuth).staff.create({
        name: "Akosua",
        role: "CASHIER",
        pin: "9090",
        branchId: shop.branchId,
      });

      const login = await caller().auth.pinLogin({
        userId: created.id,
        pin: "9090",
      });
      expect(login.user.name).toBe("Akosua");
    });
  });

  describe("subscription lock", () => {
    it("makes a locked tenant read-only", async () => {
      const shop = await seedTenant({ name: "Shop A", referralCode: "AAAAAA" });
      await prisma.organization.update({
        where: { id: shop.organizationId },
        data: { subscriptionStatus: "LOCKED" },
      });

      const asOwner = caller(shop.ownerAuth);

      // Reading still works — the shop can always see its own data.
      await expect(asOwner.staff.list()).resolves.toBeInstanceOf(Array);

      // Writing is paused until payment is sorted out.
      await expect(
        asOwner.staff.create({ name: "New", role: "CASHIER", pin: "1234" }),
      ).rejects.toThrow(/subscription is inactive/i);
    });
  });
});
