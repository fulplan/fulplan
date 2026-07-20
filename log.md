---
tags: [log]
---

# Log

## 2026-07-19 — Vault created; full planning session ingested
Built the entire project brain from an extensive planning conversation covering:
- Business model, pricing, target market ([[Business-Model]])
- Locked tech stack: React/Vite/TS/Tailwind PWA, Fastify, PostgreSQL+Prisma, Vercel+Railway ([[Architecture]])
- Multi-tenant SaaS mechanics: isolation, billing, super-admin, trial/dunning ([[Multi-Tenancy]])
- Full data model ([[Data-Model]])
- Product features including anti-theft (PIN-gated discounts, shift reconciliation) ([[Product-Features]])
- Visual design language: clean, minimal, no rounded corners ([[Design-Language]])
- Dev practices: monorepo, tRPC, testing, CI/CD ([[Dev-Practices]])
- Phased roadmap ([[Roadmap]])
- Open risks flagged for later ([[Open-Risks]])

Source: build plan at `C:\Users\c4\.claude\plans\well-i-am-in-sleepy-raven.md`, itself the product of ~90+ Q&A exchanges with the founder.

**Next**: begin Phase 1 scaffold — see [[Roadmap]] "First concrete step."

## 2026-07-20 — External research ingested and reconciled
Two research documents (Ghana POS market report + an alternative full architecture proposal) were reviewed against the existing plan. See [[Research-Notes]] for full detail. Key outcomes:
- Adopted directly (no conflict): pesewas-as-integers money handling, event-sourced stock, Postgres RLS as a second tenant-isolation layer, payment provider abstraction, cashier PIN login + device revocation, concrete performance budgets, refined sunlight-readable design tokens
- Decided with real trade-offs: **stayed online-only** for MVP despite research calling offline-first "non-negotiable" (revisit after pilot if shops lose real sales to outages); **deferred GRA E-VAT integration** to Phase 3 (schema fields only for now); **raised pricing target** from GHS 50-100 to GHS 99-150/month based on real competitor data

Feature-level additions from earlier sessions this same day, folded into [[Product-Features]] and [[Data-Model]]: unit conversion ("breaking bulk"), split payments, voids/returns, stock take, parked sales, daily branch summary, till cash in/out, supplier payables, multi-cashier live sync, salary records, business expenses, P&L report, formal invoices vs. receipts, report export formats (PDF/Excel), and the [[Marketing-Site]] as a distinct surface.

## 2026-07-20 — Vault expanded into an active tracker, not just reference
Added three new pages to make the vault a working "second brain" rather than a static plan dump:
- [[Tracker]] — every Phase 1-3 task as a checkbox, grouped by build area
- [[Pre-Launch-Checklist]] — the non-code to-dos (legal, branding, payments setup, go-to-market) that were deferred/dismissed during planning, so they don't get lost
- [[Decisions-Log]] — every locked decision in one scannable table with status (locked / contested / deferred / not decided) and a link to full reasoning

[[Home]] restructured to put these three + [[Open-Risks]] under "Active work" at the top, with the "why" documents below as reference.

## 2026-07-20 — Codebase scaffolded, round-trip working locally
First code written. Monorepo (npm workspaces) with `backend/` (Fastify + tRPC + Prisma) and `frontend/` (React 19 + Vite + Tailwind v4), matching the stack locked in [[Architecture]].

Built and verified:
- tRPC end-to-end type safety across the workspace boundary (frontend imports `AppRouter` as a type-only import, erased at build)
- Prisma schema with the multi-tenant core: `organizations`, `branches`, `users`, `devices` — including the PIN-vs-password split and device revocation from [[Research-Notes]]
- `money.ts` enforcing the pesewas-as-integers convention, with tests proving the float trap is avoided
- Design tokens from [[Design-Language]] as real CSS: sunlight-readable palette, global zero border-radius, tabular figures, 56/64px touch targets
- Local Postgres via Docker, `init` migration applied, demo tenant seeded
- CI workflow (typecheck + test + build against a Postgres service)

**Gotcha worth remembering**: port 5432 was already occupied by a pre-existing local PostgreSQL install, which silently answered Prisma's connection and failed auth. Moved the dev container to **host port 5433** rather than disturbing the existing install.

Not yet done: shadcn/ui components, ESLint/Prettier, and both deploys (Vercel + Railway). See [[Tracker]].

**Next**: the multi-tenant foundation — signup, JWT auth, PIN login, tenant-scoping middleware, Postgres RLS, and the isolation test suite. Everything else depends on it.
