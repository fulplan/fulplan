import { config } from "dotenv";
import { defineConfig } from "vitest/config";

// Load test env. dotenv never overwrites variables that already exist, so in
// CI (where DATABASE_URL is injected by the workflow) the CI values win.
config({ path: ".env.test" });

export default defineConfig({
  test: {
    // Database tests share tables; running files in parallel would let one
    // file's truncate wipe another file's fixtures mid-assertion.
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      JWT_SECRET: process.env.JWT_SECRET ?? "test-secret",
      NODE_ENV: "test",
    },
  },
});
