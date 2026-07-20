---
tags: [research]
---

# External Research — Ingested

Two research documents were dropped into the project directory and reviewed:
- `another research.md` — Ghana POS market research report (SME/MoMo market data, competitor landscape, regulatory environment, pricing benchmarks)
- `Ghana Multi-Vertical SaaS POS — Product Spec & System Architecture.md` — a full alternative architecture proposal (offline-first PWA + SQLite + sync engine, Go backend, AWS af-south-1, GRA E-VAT compliance, detailed design system)

## How they were handled
The alternative architecture proposal assumes a different stack (Go, AWS, Cloudflare, custom SQLite sync engine) than our locked stack (see [[Architecture]]: React/Fastify/PostgreSQL+Prisma/Vercel+Railway). Rather than switching stacks, the *ideas* were extracted and adapted onto our existing stack where they were clear improvements, and treated as real decisions (not auto-adopted) where they genuinely conflicted with something already confirmed.

## Adopted directly (no conflict, clear improvement)
- Money stored as integers in minor units (pesewas), never floats
- Event-sourced stock: `stock_movements` is the source of truth (append-only deltas), `stock_levels` a rebuildable cache
- Postgres Row-Level Security as a second layer under the existing tenant-scoping middleware
- Payment provider abstraction layer (adapter interface), Paystack as first concrete adapter
- Cashier login via PIN (device-bound, rate-limited) instead of password; owner/manager keep password + JWT
- Device trust & revocation — owner can remotely revoke a lost/stolen device's access
- Concrete performance budgets: checkout <300ms, JS bundle <180KB gzipped, search <80ms
- Refined design tokens: sunlight-readable high-contrast palette, tabular numerals for prices, 56-64px touch targets

See [[Architecture]], [[Data-Model]], [[Design-Language]] for where these now live.

## Decided with real trade-offs (not auto-adopted)

### Offline-first vs. online-only
Both research documents call offline-first "non-negotiable" for Ghana — directly conflicting with the online-only decision confirmed twice earlier in this project. **Decision: stay online-only for MVP, revisit after the pilot.** True offline-first is real dedicated scope (the research's own roadmap treats it as a 6-week phase on its own) that doesn't fit the 1-2 month timeline. The existing optimistic-UI + sync-queue design already softens the most common pain point.

**This is now the single biggest open disagreement between this plan and outside research — treat any pilot feedback about lost sales during outages as a serious signal, not noise.** See [[Open-Risks]].

### GRA E-VAT compliance
Real government real-time invoice clearance requirement for VAT-registered businesses — but the MVP target (small provision stores) is unlikely to be VAT-registered. **Decision: add VAT/levy line-item fields to the schema now** (cheap while fresh) **without building the actual GRA API integration** — save real integration for Phase 3 when expanding to VAT-registered supermarkets/pharmacies.

### Pricing
Research showed real competitors (SellarPro, CliqPOS) cluster at GHS 99–300/month, not the originally estimated GHS 50–100. **Decision: raise target to ~GHS 99–150/month** — still on the affordable end, not underpriced relative to the real market. See [[Business-Model]].

## Notable data points worth remembering
- MoMo dominates Ghana payments at massive scale (GH¢518.4B in Dec 2025 alone); MTN holds ~73% of MoMo customers
- The only telco with a public developer API is MTN; Telecel Cash and AT Money require going through an aggregator (Hubtel/Paystack/Flutterwave) — confirms the aggregator-first payment decision already made
- A pure software POS routing payments through a licensed aggregator does **not** need its own Bank of Ghana PSP license — good, avoids a major regulatory burden
- Staff theft via voided sales and undocumented discounts is named as the #1 loss channel for Ghanaian retail — validates the PIN-gated discount override and audit log already planned as high-value, not nice-to-have
- Common complaints about existing POS competitors: unreliable offline behavior, no MoMo reconciliation, no local support, foreign/generic workflows — reinforces where a local, well-supported product can win

Related: [[Architecture]], [[Business-Model]], [[Open-Risks]], [[Data-Model]], [[Design-Language]]
