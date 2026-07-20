/**
 * Minimal in-memory attempt limiter for login endpoints.
 *
 * A 4-6 digit PIN is trivially brute-forceable without this. Deliberately
 * simple: it lives in one process, so it resets on deploy and does not span
 * multiple API instances. That is acceptable while we run a single instance;
 * move it to Redis before scaling horizontally.
 */

interface Attempts {
  count: number;
  firstAt: number;
  lockedUntil?: number;
}

const attempts = new Map<string, Attempts>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60_000; // 5 minutes
const LOCKOUT_MS = 5 * 60_000; // 5 minutes

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry) return { allowed: true, retryAfterSeconds: 0 };

  if (entry.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }

  // Window elapsed — forget the old attempts.
  if (now - entry.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return;
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}

/** Test helper — resets all limiter state. */
export function __resetRateLimits(): void {
  attempts.clear();
}
