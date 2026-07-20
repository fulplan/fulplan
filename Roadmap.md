---
tags: [roadmap, planning]
---

# Roadmap

## Phase 1 — MVP SaaS core (weeks 1–8), aiming for paying pilot customers
1. Project scaffold: Vite React + Fastify + PostgreSQL/Prisma, deploy pipeline (Vercel + Railway) working end-to-end on day one
2. **Multi-tenant foundation** (built before any business feature — everything else depends on it): self-service signup with referral capture → org + first branch auto-created, JWT auth, tenant-scoping middleware, role-based permissions, hard-reset-on-logout behavior
3. Super-admin panel v1: org list, trial/subscription status, enable/disable toggle
4. Trial & billing skeleton: trial start date, scheduled expiry check, placeholder lock behavior
5. Products & inventory: CRUD, barcode, cost/selling price, stock levels, low-stock alerts
6. Checkout screen: search + tap grid, camera/USB barcode scan, cart, cash + manual MoMo, optimistic UI, PIN-gated discount override
7. Shift close-out: opening float, expected vs. counted cash, discrepancy flag
8. Receipts: printable 80mm + WhatsApp share link
9. Customer credit: customer list, credit sales, partial payments, balance owed
10. Reports v1: daily sales summary, basic profit view, shift discrepancy log
11. Data export/delete (self-service)
12. **Pilot + first paying customers**: onboard 2–3 real provision stores, convert to paid once value is proven

## Phase 2 — Full billing automation & polish (months 3–4)
- Paystack MoMo collection API (customer pays via phone prompt)
- Full Paystack subscription automation (auto-charge, webhook-driven auto-lock/unlock)
- SMS receipts (Arkesel/Hubtel)
- RawBT Bluetooth printing for Android
- Reports v2: best/worst sellers, staff performance, profit trends
- Suppliers & purchase orders
- Super-admin panel v2: usage analytics, support tools

## Phase 3 — Expand market (months 5+)
- Pharmacy, restaurant, boutique/electronics modules
- Plan tiers (feature gating) once usage data shows what to charge for
- Revisit offline support if network outages are costing pilot shops sales
- Referral program (if not already live from Phase 1)

## First concrete step
Scaffold React (Vite) frontend + Fastify backend + PostgreSQL/Prisma in `D:\C4`, deploy a "hello world" end-to-end on Vercel + Railway, then build the multi-tenant foundation as the first real feature.

Related: [[Open-Risks]], [[Business-Model]] for the "why" behind priority order.
