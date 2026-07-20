import type { FastifyReply, FastifyRequest } from "fastify";
import type { Context } from "../context";
import { prisma } from "../db";
import { hashSecret } from "../lib/password";
import { generateDeviceToken, type AccessTokenPayload } from "../lib/tokens";
import { appRouter } from "../routers";

/**
 * Wipes every table. Called before each test so one test's fixtures can never
 * leak into another's assertions — which matters more than usual here, since
 * the whole point of these tests is proving data does not leak.
 */
export async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "devices", "users", "branches", "organizations" RESTART IDENTITY CASCADE`,
  );
}

/** Builds a tRPC context, optionally already authenticated. */
export function testContext(auth: AccessTokenPayload | null = null): Context {
  return {
    req: { headers: {} } as FastifyRequest,
    res: {} as FastifyReply,
    prisma,
    auth,
  };
}

export function caller(auth: AccessTokenPayload | null = null) {
  return appRouter.createCaller(testContext(auth));
}

export interface SeededTenant {
  organizationId: string;
  branchId: string;
  ownerId: string;
  ownerAuth: AccessTokenPayload;
  referralCode: string;
}

/**
 * Creates a complete tenant directly through Prisma (bypassing the signup
 * endpoint) so isolation tests don't depend on the auth layer working.
 */
export async function seedTenant(options: {
  name: string;
  referralCode: string;
  ownerEmail?: string;
  ownerPassword?: string;
}): Promise<SeededTenant> {
  const org = await prisma.organization.create({
    data: { name: options.name, referralCode: options.referralCode },
  });

  const branch = await prisma.branch.create({
    data: { organizationId: org.id, name: `${options.name} Main` },
  });

  const owner = await prisma.user.create({
    data: {
      organizationId: org.id,
      branchId: branch.id,
      name: `${options.name} Owner`,
      email: options.ownerEmail ?? null,
      passwordHash: options.ownerPassword
        ? await hashSecret(options.ownerPassword)
        : null,
      role: "OWNER",
    },
  });

  return {
    organizationId: org.id,
    branchId: branch.id,
    ownerId: owner.id,
    referralCode: org.referralCode,
    ownerAuth: {
      userId: owner.id,
      organizationId: org.id,
      branchId: branch.id,
      role: "OWNER",
      deviceId: null,
    },
  };
}

export async function seedCashier(options: {
  organizationId: string;
  branchId: string;
  name: string;
  pin: string;
}) {
  return prisma.user.create({
    data: {
      organizationId: options.organizationId,
      branchId: options.branchId,
      name: options.name,
      role: "CASHIER",
      pinHash: await hashSecret(options.pin),
    },
  });
}

export async function seedDevice(options: {
  organizationId: string;
  userId: string;
  branchId: string | null;
  label?: string;
}) {
  const { token, tokenHash } = generateDeviceToken();
  const device = await prisma.device.create({
    data: {
      organizationId: options.organizationId,
      userId: options.userId,
      branchId: options.branchId,
      label: options.label ?? "Test till",
      tokenHash,
    },
  });
  return { device, token };
}
