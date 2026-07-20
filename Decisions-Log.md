---
tags: [decisions, reference]
---

# Decisions Log

Quick-scan reference of every major decision, its status, and where the full reasoning lives. For narrative context, see [[log]]. For active work, see [[Tracker]].

| # | Decision | Status | Detail |
|---|---|---|---|
| 1 | Multi-tenant SaaS (not custom build) | 🔒 Locked | [[Business-Model]] |
| 2 | GHS 99-150/month, single plan | 🔒 Locked (recalibrated once) | [[Business-Model]], [[Research-Notes]] |
| 3 | MVP market: provision stores | 🔒 Locked | [[Business-Model]] |
| 4 | Stack: React/Vite/TS/Tailwind + Fastify + Postgres/Prisma + Vercel/Railway | 🔒 Locked | [[Architecture]] |
| 5 | tRPC over REST | 🔒 Locked | [[Architecture]] |
| 6 | Shared DB, tenant-scoped by middleware + Postgres RLS | 🔒 Locked (strengthened once) | [[Multi-Tenancy]], [[Research-Notes]] |
| 7 | Super-admin panel, read-only (no impersonation) | 🔒 Locked | [[Multi-Tenancy]] |
| 8 | 30-day trial, automated dunning, auto-lock | 🔒 Locked | [[Multi-Tenancy]] |
| 9 | Online-only (not offline-first) | ⚠️ Locked but contested | Confirmed 3x; conflicts with external research — see [[Open-Risks]], [[Research-Notes]] |
| 10 | Optimistic UI + sync-failure queue at checkout | 🔒 Locked | [[Dev-Practices]] |
| 11 | Clean/minimal, no rounded corners, sunlight-readable palette | 🔒 Locked | [[Design-Language]] |
| 12 | PIN-gated discount override, logged | 🔒 Locked | [[Product-Features]] |
| 13 | Shift/till reconciliation incl. cash in/out | 🔒 Locked | [[Product-Features]] |
| 14 | Unit conversion ("breaking bulk") | 🔒 Locked | [[Product-Features]] |
| 15 | Split payments, voids/returns, parked sales | 🔒 Locked | [[Product-Features]] |
| 16 | Salary records, expenses, real P&L | 🔒 Locked | [[Product-Features]] |
| 17 | Formal invoices distinct from receipts | 🔒 Locked | [[Product-Features]] |
| 18 | Event-sourced stock (`stock_movements` = truth) | 🔒 Locked | [[Data-Model]], [[Research-Notes]] |
| 19 | Cashier PIN login + device revocation | 🔒 Locked | [[Architecture]], [[Research-Notes]] |
| 20 | GRA E-VAT: schema fields only, no integration yet | 🔒 Locked (deferred) | [[Research-Notes]], [[Open-Risks]] |
| 21 | Marketing website, built alongside Phase 1 | 🔒 Locked | [[Marketing-Site]] |
| 22 | Legal (ToS/Privacy/DPC registration) | 🟡 Founder handling separately | [[Pre-Launch-Checklist]] |
| 23 | Product name | ⬜ Not decided | [[Open-Risks]], [[Pre-Launch-Checklist]] |
| 24 | Business registration status | ⬜ Not decided | [[Pre-Launch-Checklist]] |
| 25 | Customer acquisition channel | ⬜ Not decided | [[Open-Risks]], [[Pre-Launch-Checklist]] |

**Legend**: 🔒 Locked = confirmed, build against it · ⚠️ Contested = locked but flagged as a real open disagreement worth revisiting · 🟡 Deferred = intentionally out of this plan's scope · ⬜ Not decided = genuinely open

Related: [[Home]], [[Tracker]], [[Open-Risks]]
