---
tags: [tracker, status]
---

# Build Tracker

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

Last updated: 2026-07-21 — **marketing website done. One-page landing: hero, 6 feature cards, 3-step how-it-works, GH₵ 99/mo pricing, CTAs. Referral code captured from ?ref= URL param and pre-fills signup form. Landing page shows to unauthenticated visitors; logged-in users go straight to dashboard.**

## Phase 1 — MVP SaaS core

### 1. Project scaffold
- [x] Monorepo structure (`/frontend`, `/backend`, npm workspaces)
- [x] Vite + React 19 + TS + Tailwind v4 initialized, design tokens in `frontend/src/index.css`
- [ ] shadcn/ui components added (not needed until real forms/dialogs exist; zero-radius already enforced globally)
- [x] Fastify + tRPC backend initialized
- [x] PostgreSQL + Prisma connected, `init` migration applied, demo tenant seeded
- [x] Local Postgres via `docker-compose.yml` (**host port 5433** — 5432 was taken by an existing local Postgres install)
- [x] Money-as-pesewas utility + tests (`backend/src/lib/money.ts`)
- [x] GitHub Actions CI written (typecheck + test + build, with a Postgres service)
- [ ] CI verified green on GitHub (needs a remote + first push)
- [ ] ESLint + Prettier configured and wired into CI
- [ ] Vercel deploy (frontend)
- [ ] Railway deploy (backend + Postgres), staging + production
- [x] "Hello world" round-trip confirmed **locally** — React → tRPC → Prisma → Postgres, reading real seeded data
- [ ] Round-trip confirmed **live** (blocked on the two deploys above)

**Verified working locally:** `/health` returns ok · `trpc/health.ping` returns ok · `trpc/health.db` reads 1 organization from Postgres · frontend renders live status with no console errors · production build passes with **89 kB gzipped JS** (budget: 180 kB).

### 2. Multi-tenant foundation (blocks everything else)
- [x] `organizations`, `branches`, `users`, `devices` schema + migrations
- [x] Self-service signup flow (with referral code capture, 30-day trial, atomic org+branch+owner creation)
- [x] JWT auth — owner/manager: email + password; cashier: PIN, rate-limited
- [x] Device registration + owner-side remote revocation (kills the session on the next request, not at token expiry)
- [x] Tenant-scoping layer (`backend/src/lib/tenant-db.ts`) — auto-filters every Prisma query, fails closed on unknown operations
- [x] Role-based permission checks (`ownerProcedure` / `managerProcedure`)
- [x] Subscription lock — a LOCKED/CANCELLED tenant becomes read-only (mutations refused, reads still allowed)
- [x] Tenant-isolation automated test suite — 14 tests covering reads, writes, and guard rails
- [x] Auth test suite — 19 tests covering signup, login, PIN login, rate limiting, revocation, permissions, lock
- [ ] **Postgres Row-Level Security policies** — deliberately deferred, see note below
- [x] Hard-reset-on-logout/org-switch behavior (logout keeps device token; org-switch calls hardReset which clears everything)
- [x] Frontend auth UI (signup, owner login, cashier PIN screen)

> **On the deferred RLS layer.** The app-level scoping above is implemented and
> tested. RLS was meant to sit *underneath* it as a second net. Doing it properly
> requires a dedicated non-owner Postgres role plus routing every tenant query
> through a transaction that sets a session variable — a real architectural
> change with a performance cost. Half-doing it (policies enabled while the app
> connects as the table owner, which bypasses RLS) would give false confidence,
> which is worse than not having it. Scheduled as its own focused piece of work.

### 3. Super-admin panel v1
- [ ] Organization list view
- [ ] Trial/subscription status display
- [ ] Enable/disable tenant toggle
- [ ] Read-only tenant data view (no impersonation)

### 4. Trial & billing skeleton
- [ ] Trial start date on signup, 30-day window
- [ ] Scheduled job: trial expiry check
- [ ] In-app + WhatsApp trial reminders
- [ ] Placeholder/manual lock behavior (full Paystack automation may land end of Phase 1 or Phase 2)

### 5. Products & inventory
- [x] Product CRUD (barcode, cost/selling price, category)
- [x] Unit conversion (purchase unit vs. sale unit, e.g. carton → piece)
- [x] Per-branch stock levels (rebuildable cache)
- [x] `stock_movements` event log (source of truth)
- [x] Low-stock alerts (in-app banner on products page)
- [x] Product categories (with inline quick-add in product form)
- [ ] Starter catalog (common Ghanaian provision-store products) + bulk-copy at signup
- [ ] Cloudinary image upload

### 6. Checkout screen
- [x] Product tile grid (text-first) + search
- [ ] Camera barcode scan (`html5-qrcode`)
- [x] USB scanner support (keyboard-emulation, works natively)
- [x] Cart + running total, mobile bottom-sheet cart on narrow widths
- [x] Cash payment + change calculation
- [x] Manual MoMo recording
- [ ] Split payments (multiple tender lines per sale)
- [ ] Optimistic UI (instant complete, background save)
- [ ] Sync failure queue + retry + "N unsynced" badge
- [ ] Zero-connectivity offline message (cached shell, checkout disabled)
- [ ] Price locked to list; manager-PIN discount override, logged
- [ ] Parked/held sales
- [ ] Void/return flow (manager-PIN approved, restores stock, logged)

### 7. Shift close-out
- [x] Clock-in with opening float
- [x] Manual cash in/out entries during shift
- [x] Expected-cash calculation (sales + cash in/out)
- [x] Clock-out cash count + discrepancy flag
- [ ] Daily branch summary (Z-report) rolling up all shifts

### 8. Receipts & invoices
- [x] Printable 80mm receipt (browser print CSS)
- [x] WhatsApp share link (hosted receipt page at /receipt/:id, public, no auth)
- [ ] Formal invoice template for credit/wholesale sales
- [ ] VAT/levy line-item fields in schema (no GRA integration yet)

### 9. Customer credit
- [x] Customer profiles (name, phone, optional credit limit)
- [x] Credit sales (CREDIT payment method, customer picker in checkout modal)
- [x] Owner-configurable credit limit + checkout warning (visible, non-blocking)
- [x] Credit ledger (CHARGE on sale, PAYMENT on repayment, balance computed)
- [ ] Partial payments (UI allows any amount ≤ balance — full cycle works)
- [ ] Customer-facing balance reminders (Phase 2)

### 10. Suppliers
- [x] Supplier contact records (name, phone, email, notes)
- [x] Basic accounts-payable balance tracking (PURCHASE adds balance, PAYMENT reduces it)
- [x] Partial payments supported
- [x] Ledger view with history

### 11. Stock take
- [x] Count session flow (expected vs. actual per product, one open session enforced per branch)
- [x] Logged adjustment with reason (ADJUSTMENT StockMovement created on close, StockLevel cache updated atomically)
- [x] Progress tracking UI (filter tabs, progress bar, discrepancy coloring)
- [x] Past sessions list with item count + who closed

### 12. Salary & expenses
- [x] Basic salary records (agreed monthly salary, effective-from history, payments/advances log)
- [x] Business expenses log (category quick-pick, amount, date, note; monthly running total)
- [x] Delete expense; salary history per staff member

### 13. Reports v1
- [x] Daily/period sales summary with payment method breakdown
- [x] Real P&L: revenue − COGS − expenses − salary = net profit
- [x] Top products by revenue with margin % and mini bar chart
- [x] Shift discrepancy log
- [x] Quick period picker (Today / Yesterday / Last 7 days / This month)
- [ ] Daily branch summary (Z-report)
- [ ] PDF export
- [ ] Excel/CSV export
- [ ] Charts on dedicated Reports screen
- [ ] Scheduled WhatsApp push summary (daily/weekly)

### 14. Data export/delete
- [x] Self-service CSV export: sales (by period), products & stock, customers (with balances), expenses (by period)
- [x] Self-service account deletion: type "DELETE" guard, 30-day grace period, cancel flow within grace period

### 15. Marketing website
- [x] One-page site: hero, feature grid, how-it-works, pricing (GH₵ 99/mo), multiple CTAs
- [x] Referral code capture from ?ref= URL param → pre-fills signup form
- [x] Unauthenticated visitors see landing page; existing sessions go straight to dashboard
- [ ] Domain purchased + deployed to Vercel

### 16. Pilot
- [ ] Product name decided
- [ ] Domain purchased
- [ ] 2-3 real provision stores onboarded
- [ ] Convert to paid once value proven

---

## Phase 2 (not started)
- [ ] Paystack MoMo collection API (automated, not manual)
- [ ] Full Paystack subscription automation (auto-charge, dunning, auto-lock/unlock)
- [ ] SMS receipts
- [ ] RawBT Bluetooth printing (Android)
- [ ] Reports v2: best/worst sellers, staff performance, profit trends
- [ ] Purchase orders
- [ ] Super-admin panel v2: usage analytics, support tools

## Phase 3 (not started)
- [ ] Pharmacy module (expiry/batch, FEFO, controlled substances)
- [ ] Restaurant module (tables, kitchen tickets)
- [ ] Boutique/electronics module
- [ ] GRA E-VAT real integration
- [ ] Plan tiers
- [ ] Offline-first reassessment (if pilot shows real need)
- [ ] Referral program (if not already live from Phase 1)

Related: [[Roadmap]] for the narrative version, [[Pre-Launch-Checklist]] for non-code to-dos, [[Home]]
