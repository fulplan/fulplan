import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id for both passwords (owner/manager) and PINs (cashier).
 *
 * A 4-6 digit PIN has very little entropy, so the hash is the only thing
 * standing between an attacker with DB access and every till in the country.
 * PIN login is additionally rate-limited and device-bound at the API layer —
 * see `verifyPinAttempt` in routers/auth.ts.
 */
const ARGON_OPTIONS = {
  memoryCost: 19456, // 19 MiB — OWASP minimum recommendation
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashSecret(plain: string): Promise<string> {
  return hash(plain, ARGON_OPTIONS);
}

export async function verifySecret(
  storedHash: string | null | undefined,
  plain: string,
): Promise<boolean> {
  if (!storedHash) return false;
  try {
    return await verify(storedHash, plain, ARGON_OPTIONS);
  } catch {
    // Malformed hash in the DB — treat as a failed login, never a crash.
    return false;
  }
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/** Deliberately loose: length beats composition rules for real-world security. */
export function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 200;
}
