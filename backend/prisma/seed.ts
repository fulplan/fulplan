/**
 * Development seed — creates one demo tenant so the app has something to
 * show locally. Credentials are intentionally absent: password/PIN hashing
 * arrives with the auth work (see Tracker.md "Multi-tenant foundation").
 *
 * Run with: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function makeReferralCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no confusable chars
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

async function main() {
  const existing = await prisma.organization.findFirst({
    where: { name: "Demo Provision Store" },
  });

  if (existing) {
    console.log("Seed data already present — nothing to do.");
    return;
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 30); // 30-day trial

  const org = await prisma.organization.create({
    data: {
      name: "Demo Provision Store",
      referralCode: makeReferralCode(),
      trialEndsAt,
      branches: {
        create: {
          name: "Main Branch",
          address: "Accra, Ghana",
          receiptHeader: "Demo Provision Store\nAccra, Ghana",
        },
      },
    },
    include: { branches: true },
  });

  const mainBranch = org.branches[0];

  await prisma.user.create({
    data: {
      organizationId: org.id,
      branchId: mainBranch?.id ?? null,
      name: "Demo Owner",
      email: "owner@demo.local",
      role: "OWNER",
    },
  });

  console.log(`Seeded organization "${org.name}" (${org.id})`);
  console.log(`  referral code: ${org.referralCode}`);
  console.log(`  trial ends:    ${trialEndsAt.toDateString()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
