import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./db";
import { createContext } from "./context";
import { env, isProduction } from "./env";
import { appRouter, type AppRouter } from "./routers";
import { startCronJobs } from "./lib/cron";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const server = Fastify({
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

/** Health check for Railway/uptime probes. */
server.get("/health", async () => ({ ok: true, service: "uptilll-api" }));

// ── Paystack webhook ──────────────────────────────────────────────────────────
// Registered before tRPC so the raw body parser applies first.
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
  const expected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

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
        server.log.info({ organizationId }, "Paystack subscription.disable: org locked");
      }
    }
  } catch (err) {
    server.log.error({ err }, "Error processing Paystack webhook");
  }

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

// ── Frontend SPA ──────────────────────────────────────────────────────────────
// Serve the built Vite app. In production Railway builds both packages;
// the frontend dist lands at ../../frontend/dist relative to this file.
const frontendDist = path.resolve(__dirname, "../../frontend/dist");

await server.register(fastifyStatic, {
  root: frontendDist,
  prefix: "/",
  // Don't 404 on missing assets — fall through to the SPA catch-all below
  wildcard: false,
});

// SPA catch-all: any non-API, non-asset path returns index.html
server.setNotFoundHandler(async (req, reply) => {
  if (
    req.url.startsWith("/trpc") ||
    req.url.startsWith("/health") ||
    req.url.startsWith("/webhooks")
  ) {
    return reply.status(404).send({ error: "Not found" });
  }
  return reply.sendFile("index.html", frontendDist);
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
