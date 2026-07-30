import cron from "node-cron";
import type { PrismaClient } from "@prisma/client";
import { sendTrialWarningEmail } from "./email.js";

export function startCronJobs(prisma: PrismaClient): void {
  // Daily at 00:05 — lock orgs whose trial has expired, warn orgs near expiry
  cron.schedule("5 0 * * *", async () => {
    try {
      await runTrialCheck(prisma);
    } catch (err) {
      console.error("[cron] trial check failed:", err);
    }
  });

  console.log("[cron] jobs scheduled");
}

async function runTrialCheck(prisma: PrismaClient): Promise<void> {
  const now = new Date();

  // Lock expired orgs
  const expired = await prisma.organization.findMany({
    where: {
      trialEndsAt: { lte: now },
      subscriptionStatus: "TRIALING",
      deletedAt: null,
    },
    select: { id: true, name: true },
  });

  if (expired.length > 0) {
    await prisma.organization.updateMany({
      where: { id: { in: expired.map((o) => o.id) } },
      data: { subscriptionStatus: "LOCKED" },
    });
    console.log(`[cron] locked ${expired.length} expired org(s)`);
  }

  // Warn orgs expiring in 3 days or 1 day
  const warnDays = [3, 1];
  for (const days of warnDays) {
    const windowStart = new Date(now.getTime() + days * 86_400_000);
    const windowEnd   = new Date(windowStart.getTime() + 86_400_000);

    const expiring = await prisma.organization.findMany({
      where: {
        trialEndsAt: { gte: windowStart, lt: windowEnd },
        subscriptionStatus: "TRIALING",
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        users: {
          where: { role: "OWNER", active: true },
          select: { email: true },
          take: 1,
        },
      },
    });

    for (const org of expiring) {
      const ownerEmail = org.users[0]?.email;
      if (ownerEmail) {
        await sendTrialWarningEmail(ownerEmail, org.name, days);
      }
    }

    if (expiring.length > 0) {
      console.log(`[cron] sent ${days}-day trial warnings to ${expiring.length} org(s)`);
    }
  }
}
