import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { hashSecret, isValidPassword, isValidPin } from "../lib/password";
import { hashDeviceToken } from "../lib/tokens";
import {
  managerProcedure,
  publicProcedure,
  router,
  tenantProcedure,
} from "../trpc";

export const staffRouter = router({
  /**
   * The cashier sign-in screen: a registered till shows the staff who can use
   * it, and the cashier taps their name then types a PIN.
   *
   * Unauthenticated by necessity — this runs before anyone has signed in — so
   * it is gated on possession of a valid device token and returns names only,
   * never PIN hashes, emails, or roles beyond what the screen needs.
   */
  listForDevice: publicProcedure
    .input(z.object({ deviceToken: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const device = await ctx.prisma.device.findFirst({
        where: { tokenHash: hashDeviceToken(input.deviceToken), revokedAt: null },
        select: {
          organizationId: true,
          branchId: true,
          organization: { select: { name: true, deletedAt: true } },
        },
      });

      if (!device || device.organization.deletedAt) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "This device is not registered. Ask the owner to set it up.",
        });
      }

      const staff = await ctx.prisma.user.findMany({
        where: {
          organizationId: device.organizationId,
          active: true,
          pinHash: { not: null },
          ...(device.branchId ? { branchId: device.branchId } : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      return { organizationName: device.organization.name, staff };
    }),

  list: tenantProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        branchId: true,
        active: true,
        createdAt: true,
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    });
  }),

  /** Add a staff member. Cashiers get a PIN; managers get email + password. */
  create: managerProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(120),
        role: z.enum(["MANAGER", "CASHIER"]),
        branchId: z.string().optional(),
        pin: z.string().optional(),
        email: z.string().trim().toLowerCase().email().optional(),
        password: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only an owner may create another manager — a manager promoting
      // themselves sideways is a privilege-escalation path.
      if (input.role === "MANAGER" && ctx.auth.role !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the owner can add a manager",
        });
      }

      if (input.role === "CASHIER") {
        if (!input.pin || !isValidPin(input.pin)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cashiers need a 4-6 digit PIN",
          });
        }
      } else if (
        !input.email ||
        !input.password ||
        !isValidPassword(input.password)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Managers need an email and a password of at least 8 characters",
        });
      }

      if (input.branchId) {
        const branch = await ctx.db.branch.findFirst({
          where: { id: input.branchId },
          select: { id: true },
        });
        if (!branch) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found" });
        }
      }

      return ctx.db.user.create({
        data: {
          // Required by Prisma's types and verified by tenantDb — a mismatch
          // against the caller's session throws rather than writing.
          organizationId: ctx.auth.organizationId,
          name: input.name,
          role: input.role,
          branchId: input.branchId ?? null,
          email: input.email ?? null,
          passwordHash: input.password ? await hashSecret(input.password) : null,
          pinHash: input.pin ? await hashSecret(input.pin) : null,
        },
        select: { id: true, name: true, role: true, branchId: true },
      });
    }),

  setPin: managerProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        pin: z.string().refine(isValidPin, { message: "PIN must be 4-6 digits" }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.user.updateMany({
        where: { id: input.userId },
        data: { pinHash: await hashSecret(input.pin) },
      });

      if (updated.count === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found" });
      }
      return { ok: true };
    }),

  /**
   * Verify that a PIN belongs to a manager or owner in this org.
   * Used by cashiers to get manager approval for discounts and overrides.
   * Returns the approver's name and role on success; throws UNAUTHORIZED on failure.
   */
  verifyManagerPin: tenantProcedure
    .input(z.object({ pin: z.string().min(4).max(6) }))
    .mutation(async ({ ctx, input }) => {
      const { verifySecret } = await import("../lib/password.js");
      const candidates = await ctx.db.user.findMany({
        where: {
          organizationId: ctx.auth.organizationId,
          active: true,
          role: { in: ["MANAGER", "OWNER"] },
          pinHash: { not: null },
        },
        select: { id: true, name: true, role: true, pinHash: true },
      });

      for (const user of candidates) {
        if (user.pinHash && (await verifySecret(input.pin, user.pinHash))) {
          return { approved: true, approverName: user.name, approverRole: user.role };
        }
      }

      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid manager PIN" });
    }),

  setActive: managerProcedure
    .input(z.object({ userId: z.string().min(1), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.auth.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot deactivate your own account",
        });
      }

      const target = await ctx.db.user.findFirst({
        where: { id: input.userId },
        select: { role: true },
      });

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found" });
      }
      if (target.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "The owner account cannot be deactivated",
        });
      }

      await ctx.db.user.updateMany({
        where: { id: input.userId },
        data: { active: input.active },
      });

      // Deactivating someone must also cut off any till they are signed in on.
      if (!input.active) {
        await ctx.db.device.updateMany({
          where: { userId: input.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      return { ok: true };
    }),
});
