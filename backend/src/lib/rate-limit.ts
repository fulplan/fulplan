/**
 * Rate limiter for login endpoints.
 *
 * Uses Redis when REDIS_URL is set; falls back to an in-memory Map so the app
 * still works during local development. The in-memory path resets on deploy and
 * does not span multiple API instances — acceptable for single-process deploys.
 */
import { getRedis } from "./redis.js";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60_000;  // 5 minutes
const LOCKOUT_MS = 5 * 60_000; // 5 minutes

// ── In-memory fallback ────────────────────────────────────────────────────────

interface Attempts {
  count: number;
  firstAt: number;
  lockedUntil?: number;
}

const memStore = new Map<string, Attempts>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

// ── Redis helpers ─────────────────────────────────────────────────────────────

async function redisCheck(key: string): Promise<RateLimitResult> {
  const redis = getRedis()!;
  const lockKey = `rl:lock:${key}`;
  const ttl = await redis.pttl(lockKey);
  if (ttl > 0) {
    return { allowed: false, retryAfterSeconds: Math.ceil(ttl / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

async function redisRecord(key: string): Promise<void> {
  const redis = getRedis()!;
  const countKey = `rl:cnt:${key}`;
  const lockKey  = `rl:lock:${key}`;

  const count = await redis.incr(countKey);
  if (count === 1) {
    await redis.pexpire(countKey, WINDOW_MS);
  }
  if (count >= MAX_ATTEMPTS) {
    await redis.set(lockKey, "1", "PX", LOCKOUT_MS);
    await redis.del(countKey);
  }
}

async function redisClear(key: string): Promise<void> {
  const redis = getRedis()!;
  await redis.del(`rl:cnt:${key}`, `rl:lock:${key}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const redis = getRedis();
  if (redis) {
    try { return await redisCheck(key); } catch { /* fall through */ }
  }

  // In-memory path
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry) return { allowed: true, retryAfterSeconds: 0 };
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  if (now - entry.firstAt > WINDOW_MS) {
    memStore.delete(key);
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordFailure(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try { await redisRecord(key); return; } catch { /* fall through */ }
  }

  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    memStore.set(key, { count: 1, firstAt: now });
    return;
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = now + LOCKOUT_MS;
}

export async function clearAttempts(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try { await redisClear(key); return; } catch { /* fall through */ }
  }
  memStore.delete(key);
}

/** Test helper */
export function __resetRateLimits(): void {
  memStore.clear();
}
