import cors from "@fastify/cors";
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import crypto from "node:crypto";
import { prisma } from "./db";
import { createContext } from "./context";
import { env, isProduction } from "./env";
import { appRouter, type AppRouter } from "./routers";
import { startCronJobs } from "./lib/cron";

const server = Fastify({
  // tRPC encodes query input in the URL; the default limit is too small.
  routerOptions: { maxParamLength: 5000 },
  logger: isProduction
    ? true
    : {
        transport: {
          target: "pino-pretty",
          options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      },
});

await server.register(cors, {
  origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  credentials: true,
});

/** Plain HTTP health check for Railway/uptime probes (not tRPC). */
server.get("/health", async () => ({ ok: true, service: "ghpos-api" }));

// ── Paystack webhook ──────────────────────────────────────────────────────────
// Must be registered BEFORE tRPC so the raw body is available.
server.addContentTypeParser("application/json", { parseAs: "buffer" }, (req, body, done) => {
  done(null, body);
});

server.post("/webhooks/paystack", async (req, reply) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    server.log.warn("Paystack webhook received but PAYSTACK_SECRET_KEY is not set");
    return reply.status(400).send({ error: "Not configured" });
  }

  const signature = req.headers["x-paystack-signature"] as string | undefined;
  if (!signature) return reply.status(400).send({ error: "Missing signature" });

  const rawBody = req.body as Buffer;
  const expected = crypto
    .createHmac("sha512", secret)
    .update(rawBody)
    .digest("hex");

  if (signature !== expected) {
    server.log.warn("Paystack webhook: invalid signature");
    return reply.status(401).send({ error: "Invalid signature" });
  }

  let event: { event: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return reply.status(400).send({ error: "Invalid JSON" });
  }

  server.log.info({ event: event.event }, "Paystack webhook received");

  try {
    if (event.event === "charge.success") {
      const meta = event.data.metadata as Record<string, unknown> | undefined;
      const organizationId = meta?.organizationId as string | undefined;
      if (organizationId) {
        // Activate subscription for 30 days from today
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await prisma.organization.updateMany({
          where: { id: organizationId, deletedAt: null },
          data: { subscriptionStatus: "ACTIVE" as const, trialEndsAt: expiresAt },
        });
        server.log.info({ organizationId }, "Paystack charge.success: org activated");
      }
    }

    if (event.event === "subscription.disable") {
      const meta = event.data.metadata as Record<string, unknown> | undefined;
      const organizationId = meta?.organizationId as string | undefined;
      if (organizationId) {
        await prisma.organization.updateMany({
          where: { id: organizationId, deletedAt: null },
          data: { subscriptionStatus: "LOCKED" },
        });
        server.log.info({ organizationId }, "Paystack subscription.disable: org expired");
      }
    }
  } catch (err) {
    server.log.error({ err }, "Error processing Paystack webhook");
  }

  // Always return 200 so Paystack stops retrying
  return reply.status(200).send({ ok: true });
});

// ── tRPC ──────────────────────────────────────────────────────────────────────
await server.register(fastifyTRPCPlugin, {
  prefix: "/trpc",
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }) {
      server.log.error({ path, err: error }, "tRPC procedure failed");
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

// ── Startup ───────────────────────────────────────────────────────────────────
try {
  await server.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  server.log.error(err);
  process.exit(1);
}

startCronJobs(prisma);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    server.log.info(`${signal} received, shutting down`);
    await server.close();
    process.exit(0);
  });
}
