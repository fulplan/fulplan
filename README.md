# GhPOS

Multi-tenant retail POS SaaS for Ghana. Working name — final product name still to be decided (see `Pre-Launch-Checklist.md`).

The full product thinking lives in this repo as an Obsidian vault — start at **[Home.md](Home.md)**, then **[Tracker.md](Tracker.md)** for what's built and what's next.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind v4 (PWA) |
| API | tRPC over Fastify |
| Database | PostgreSQL + Prisma |
| Hosting | Vercel (frontend) + Railway (backend + Postgres) |

Why these: see [Architecture.md](Architecture.md).

## Getting started

Prerequisites: Node 20+, Docker Desktop (for the local database).

```bash
# 1. Install dependencies (npm workspaces — installs both apps)
npm install

# 2. Create local env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 3. Start Postgres (requires Docker Desktop running)
npm run db:up

# 4. Create the schema and seed a demo tenant
npm run db:migrate
npm run db:seed

# 5. Create the test database (separate from dev — tests truncate tables)
npm run db:test:setup --workspace=backend

# 6. Run both apps
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3000 (health check at `/health`, tRPC at `/trpc`)

## Testing

```bash
npm test
```

Tests run against a **separate `ghpos_test` database** and truncate every table
between runs, so they never touch your dev data. Re-run `db:test:setup` after
changing the Prisma schema.

The highest-value tests are `backend/src/lib/tenant-db.test.ts` — they assert
that one shop cannot read or write another shop's data through any Prisma
operation. Treat a failure there as a release blocker, not a flaky test.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Runs backend + frontend together |
| `npm run build` | Builds both |
| `npm run typecheck` | Typechecks both |
| `npm test` | Runs all tests |
| `npm run db:up` / `db:down` | Starts/stops local Postgres |
| `npm run db:migrate` | Creates + applies a migration |
| `npm run db:studio` | Opens Prisma Studio (visual DB browser) |
| `npm run db:seed` | Seeds a demo tenant |

## Repo layout

```
backend/     Fastify + tRPC + Prisma API
frontend/    React + Vite PWA
*.md         The project brain (Obsidian vault) — see Home.md
```

## Conventions that matter

- **Money is always an integer count of pesewas.** Never a float. Use `backend/src/lib/money.ts`.
- **Every tenant-scoped table carries `organizationId`**, enforced by tRPC middleware *and* Postgres row-level security.
- **Stock is event-sourced** — `stock_movements` is the source of truth, stock levels are a rebuildable cache.
- **No rounded corners.** Sharp rectangles throughout — see [Design-Language.md](Design-Language.md).
- **Secrets never enter the repo.** `.env` is gitignored; real values live in Vercel/Railway env vars.
