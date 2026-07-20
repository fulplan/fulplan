import { randomInt } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

// No 0/O/1/I/L — these codes get read aloud and written on paper.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function randomCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => ALPHABET[randomInt(ALPHABET.length)],
  ).join("");
}

/**
 * Referral codes are unique across the platform, so generation retries on
 * collision. At 31^6 (~887M) combinations, collisions are vanishingly rare.
 */
export async function generateReferralCode(
  prisma: Pick<PrismaClient, "organization">,
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const taken = await prisma.organization.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  throw new Error("Could not generate a unique referral code");
}
