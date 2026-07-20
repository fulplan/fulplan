---
tags: [architecture, stack]
---

# Architecture — Locked Stack

Chosen to balance existing MERN knowledge against the two places it's worth deviating: financial data correctness (→ PostgreSQL) and checkout throughput (→ Fastify), while keeping the frontend on what's already known (React) and hosting on a platform that avoids cold-start latency.

## Frontend
React (Vite) + TypeScript + Tailwind CSS, installable as a **PWA** — one codebase for Android/Windows/browser.
- Speed on cheap Android devices via discipline: code-splitting, virtualized product lists, lazy routes, light UI deps — not a framework swap
- Component system: **shadcn/ui + Tailwind**, configured with zero border-radius (see [[Design-Language]])
- State: **TanStack Query** for all server data (fetching, caching, optimistic updates for checkout) + plain React Context for simple UI state

## Backend
Node.js + **Fastify** — same mental model as Express (routes/middleware/JSON), meaningfully better throughput, built-in schema validation. Chosen over Express for checkout API throughput under rapid sequential requests.

## API layer
**tRPC**, not plain REST. Both sides are TypeScript (monorepo), so tRPC gives end-to-end type safety with no hand-maintained API types, and pairs directly with TanStack Query.

## Database
**PostgreSQL + Prisma** — the one deliberate new-technology investment (deviates from MERN's MongoDB). Sales/stock/credit are financial data where atomic correctness matters more than schema flexibility: a sale and its stock decrement either both happen or neither does. Prisma's schema file + type-safe queries are the closest on-ramp from Mongoose available.

Tenant isolation is enforced twice: the app-level middleware (below) **plus Postgres Row-Level Security** as a database-level second layer — adopted from [[Research-Notes]] as belt-and-braces on the system's most important correctness property. All amounts are stored as integers in minor units (pesewas), never floats.

See [[Data-Model]] for the full schema.

## Auth
JWT-based, hand-rolled in Fastify — no vendor lock-in. **Owner/manager**: password + JWT. **Cashiers**: 4-6 digit PIN, device-bound, rate-limited — matches how cashiers actually use the app (nobody wants to type a password 200 times a day). **Device trust**: each login registers a device; the owner can view active devices and remotely revoke one, which addresses lost/stolen tablets. Separate elevated auth path for the super-admin panel.

## Payments
A `charge/status/refund/webhook/reconcile` adapter interface sits between checkout and Paystack (the first concrete adapter) — keeps provider SDK types out of domain logic and protects against provider lock-in or an aggregator outage.

## Performance budget
Adopted from [[Research-Notes]] as concrete targets behind the existing "be disciplined" principle: checkout completes <300ms, initial JS bundle <180KB gzipped, product search <80ms.

## Hosting (free-tier-first, no cold starts)
- Frontend: **Vercel**
- Backend + PostgreSQL: **Railway** (single platform for both; starter tier doesn't sleep like Render's free tier — directly protects checkout speed)
- ~$0 until real usage forces upgrades
- Staying on free-tier US/EU regions for MVP (not physically close to Ghana) — mitigated by optimistic UI, not by paying for a closer region yet

## Payments
Paystack aggregator API (MTN MoMo, Telecel Cash, AT Money) — manual MoMo recording at MVP, automated collection in Phase 2. Same provider used for merchant subscription billing (GHS).

## Receipts & barcodes
- Receipts: browser print (80mm CSS) for USB thermal printers; `wa.me` link to hosted receipt page; RawBT intent for Android Bluetooth (phase 2); SMS in phase 2 (Arkesel/Hubtel)
- Barcodes: `html5-qrcode` for camera scan; USB scanner guns work natively as keyboard input; barcodes scoped **per-tenant**, not globally unique (two shops can legitimately reuse a manufacturer barcode for different local products)

## Images
Cloudinary free tier for product photos — handles compression of large phone-camera uploads (data costs matter to users).

## Why not stay pure MERN?
Two deviations from MongoDB/Express, both deliberate trade-offs against the "move fast" priority:
- **PostgreSQL over MongoDB**: financial correctness (atomic sale+stock+credit transactions) outweighs the extra learning curve
- **Fastify over Express**: throughput + schema validation, but similar enough to Express that it's a same-day adjustment, not a real learning cost

React was deliberately *kept* (not swapped for Svelte/Solid) despite a brief consideration, specifically to avoid stacking two unfamiliar technologies against an aggressive timeline.

Related: [[Dev-Practices]] for repo/testing/CI, [[Multi-Tenancy]] for the isolation-enforcement mechanism built on this stack, [[Research-Notes]] for what was adapted from external research and why.
