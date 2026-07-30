/**
 * Optional Redis client.
 *
 * Returns null when REDIS_URL is not set so the app degrades gracefully to
 * in-memory fallbacks during local development. Import `getRedis()` anywhere
 * that needs Redis — never import the client directly.
 */
import Redis from "ioredis";

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      connectTimeout: 4000,
    });
    client.on("error", (err) => {
      console.error("[redis] connection error — falling back to in-memory:", err.message);
      client = null;
    });
  }
  return client;
}
