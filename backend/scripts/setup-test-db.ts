/**
 * Creates the test database (if missing) and syncs the schema to it.
 *
 * Tests truncate every table, so they must never point at the dev database.
 * Run once after cloning, and again whenever the Prisma schema changes:
 *
 *   npm run db:test:setup --workspace=backend
 */
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.test" });

const testUrl = process.env.DATABASE_URL;
if (!testUrl) {
  console.error("DATABASE_URL missing — is backend/.env.test present?");
  process.exit(1);
}

const parsed = new URL(testUrl);
const testDbName = parsed.pathname.replace(/^\//, "");

async function ensureDatabase(): Promise<void> {
  // Connect to the default `postgres` database to issue CREATE DATABASE.
  const adminUrl = new URL(testUrl!);
  adminUrl.pathname = "/postgres";

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();

  try {
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [testDbName],
    );

    if (rowCount === 0) {
      // Identifier can't be parameterised; it comes from our own .env.test.
      await client.query(`CREATE DATABASE "${testDbName}"`);
      console.log(`Created database "${testDbName}"`);
    } else {
      console.log(`Database "${testDbName}" already exists`);
    }
  } finally {
    await client.end();
  }
}

await ensureDatabase();

execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
  shell: process.platform === "win32",
});

console.log("Test database ready.");
