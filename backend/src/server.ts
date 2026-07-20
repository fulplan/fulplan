import cors from "@fastify/cors";
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { createContext } from "./context";
import { env, isProduction } from "./env";
import { appRouter, type AppRouter } from "./routers";

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

try {
  await server.listen({ port: env.PORT, host: "0.0.0.0" });
} catch (err) {
  server.log.error(err);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    server.log.info(`${signal} received, shutting down`);
    await server.close();
    process.exit(0);
  });
}
