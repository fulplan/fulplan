import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  hashSecret,
  isValidPassword,
  isValidPin,
  verifySecret,
} from "../lib/password";
import {
  checkRateLimit,
  clearAttempts,
  recordFailure,
} from "../lib/rate-limit";
import { generateReferralCode } from "../lib/referral";
import { generateDeviceToken, signAccessToken } from "../lib/tokens";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const TRIAL_DAYS = 30;

/** Same message whether the account or the secret is wrong — no user enumeration. */
const INVALID_CREDENTIALS = new TRPCError({
  code: "UNAUTHORIZED",
  message: "Incorrect details. Please check and try again.",
});

function trialEndDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

async function issueDevice(
  prisma: PrismaClient,
  input: {
    organizationId: string;
    userId: string;
    branchId: string | null;
    label: string;
  },
): Promise<{ deviceId: string; deviceToken: string }> {
  const { token, tokenHash } = generateDeviceToken();
  const device = await prisma.device.create({
    data: { ...input, tokenHash, lastSeenAt: new Date() },
  });
  return { deviceId: device.id, deviceToken: token };
}

export const authRouter = router({
  /**
   * Self-service signup. Creates the organization, its first branch, and the
   * owner account in one transaction — a half-created tenant is worse than
   * no tenant, so all three succeed together or none do.
   */
  signup: publicProcedure
    .input(
      z.object({
        shopName: z.string().trim().min(2).max(120),
        ownerName: z.string().trim().min(2).max(120),
        email: z.string().trim().toLowerCase().email(),
        password: z.string().refine(isValidPassword, {
          message: "Password must be at least 8 characters",
        }),
        branchName: z.string().trim().min(1).max(120).default("Main Branch"),
        referralCode: z.string().trim().toUpperCase().max(12).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Referral codes are advisory — an unrecognised one must not block signup.
      let referredByCode: string | null = null;
      if (input.referralCode) {
        const referrer = await ctx.prisma.organization.findUnique({
          where: { referralCode: input.referralCode },
          select: { referralCode: true },
        });
        referredByCode = referrer?.referralCode ?? null;
      }

      const [referralCode, passwordHash] = await Promise.all([
        generateReferralCode(ctx.prisma),
        hashSecret(input.password),
      ]);

      const organization = await ctx.prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: input.shopName,
            referralCode,
            referredByCode,
            trialEndsAt: trialEndDate(),
          },
        });

        const branch = await tx.branch.create({
          data: {
            organizationId: org.id,
            name: input.branchName,
            receiptHeader: input.shopName,
          },
        });

        const owner = await tx.user.create({
          data: {
            organizationId: org.id,
            branchId: branch.id,
            name: input.ownerName,
            email: input.email,
            passwordHash,
            role: "OWNER",
          },
        });

        return { org, branch, owner };
      });

      const token = await signAccessToken({
        userId: organization.owner.id,
        organizationId: organization.org.id,
        branchId: organization.branch.id,
        role: "OWNER",
        deviceId: null,
      });

      return {
        token,
        user: {
          id: organization.owner.id,
          name: organization.owner.name,
          role: "OWNER" as const,
          branchId: organization.branch.id,
        },
        organization: {
          id: organization.org.id,
          name: organization.org.name,
          referralCode: organization.org.referralCode,
          trialEndsAt: organization.org.trialEndsAt,
        },
      };
    }),

  /**
   * Owner/manager sign-in with email + password.
   *
   * The same email may own more than one shop on the platform, so when the
   * password matches several accounts we ask which one rather than guessing.
   */
  login: publicProcedure
    .input(
      z.object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(1),
        organizationId: z.string().optional(),
        deviceLabel: z.string().trim().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const limitKey = `login:${input.email}`;
      const limit = checkRateLimit(limitKey);
      if (!limit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
        });
      }

      const candidates = await ctx.prisma.user.findMany({
        where: {
          email: input.email,
          active: true,
          passwordHash: { not: null },
          organization: { deletedAt: null },
          ...(input.organizationId
            ? { organizationId: input.organizationId }
            : {}),
        },
        select: {
          id: true,
          name: true,
          role: true,
          branchId: true,
          passwordHash: true,
          organizationId: true,
          organization: { select: { id: true, name: true } },
        },
      });

      const matches: typeof candidates = [];
      for (const candidate of candidates) {
        if (await verifySecret(candidate.passwordHash, input.password)) {
          matches.push(candidate);
        }
      }

      if (matches.length === 0) {
        recordFailure(limitKey);
        throw INVALID_CREDENTIALS;
      }

      clearAttempts(limitKey);

      if (matches.length > 1) {
        return {
          status: "choose_organization" as const,
          organizations: matches.map((m) => ({
            id: m.organization.id,
            name: m.organization.name,
          })),
        };
      }

      const user = matches[0]!;

      let device: { deviceId: string; deviceToken: string } | null = null;
      if (input.deviceLabel) {
        device = await issueDevice(ctx.prisma, {
          organizationId: user.organizationId,
          userId: user.id,
          branchId: user.branchId,
          label: input.deviceLabel,
        });
      }

      const token = await signAccessToken({
        userId: user.id,
        organizationId: user.organizationId,
        branchId: user.branchId,
        role: user.role,
        deviceId: device?.deviceId ?? null,
      });

      return {
        status: "ok" as const,
        token,
        deviceToken: device?.deviceToken ?? null,
        user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
        },
      };
    }),

  /**
   * Cashier sign-in. The till already knows which shop it belongs to, so the
   * cashier only picks their name and types a PIN — nobody types a password
   * two hundred times a day.
   */
  pinLogin: publicProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        pin: z.string().refine(isValidPin, { message: "PIN must be 4-6 digits" }),
        deviceLabel: z.string().trim().max(80).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const limitKey = `pin:${input.userId}`;
      const limit = checkRateLimit(limitKey);
      if (!limit.allowed) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.`,
        });
      }

      const user = await ctx.prisma.user.findFirst({
        where: {
          id: input.userId,
          active: true,
          pinHash: { not: null },
          organization: { deletedAt: null },
        },
        select: {
          id: true,
          name: true,
          role: true,
          branchId: true,
          pinHash: true,
          organizationId: true,
          organization: { select: { id: true, name: true } },
        },
      });

      if (!user || !(await verifySecret(user.pinHash, input.pin))) {
        recordFailure(limitKey);
        throw INVALID_CREDENTIALS;
      }

      clearAttempts(limitKey);

      let device: { deviceId: string; deviceToken: string } | null = null;
      if (input.deviceLabel) {
        device = await issueDevice(ctx.prisma, {
          organizationId: user.organizationId,
          userId: user.id,
          branchId: user.branchId,
          label: input.deviceLabel,
        });
      }

      const token = await signAccessToken({
        userId: user.id,
        organizationId: user.organizationId,
        branchId: user.branchId,
        role: user.role,
        deviceId: device?.deviceId ?? null,
      });

      return {
        token,
        deviceToken: device?.deviceToken ?? null,
        user: { id: user.id, name: user.name, role: user.role, branchId: user.branchId },
        organization: { id: user.organization.id, name: user.organization.name },
      };
    }),

  /** Who am I? Used by the client to restore a session on load. */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findFirst({
      where: { id: ctx.auth.userId, organizationId: ctx.auth.organizationId },
      select: {
        id: true,
        name: true,
        role: true,
        branchId: true,
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionStatus: true,
            trialEndsAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Session invalid" });
    }

    return user;
  }),
});
