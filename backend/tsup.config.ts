import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  // Prisma's client is not bundle-friendly; keep it external.
  external: ["@prisma/client", ".prisma/client"],
});
