---
tags: [database, schema]
---

# Data Model

PostgreSQL tables via Prisma. All tables tenant-scoped except the platform layer. See [[Multi-Tenancy]] for how isolation is enforced.

## Platform-level (not tenant-scoped)
- `platform_admins`
- `subscription_events` — Paystack webhook log
- `catalog_products` — shared starter catalog of common Ghanaian provision-store items, read-only, bulk-copyable into a new tenant's `products` at signup (see [[Product-Features]] onboarding speed)

## Tenant-scoped (every row carries `organization_id`, indexed)

All tenant-scoped tables are protected by both the app-level middleware and Postgres Row-Level Security (belt-and-braces, see [[Research-Notes]]). All money fields are integers in minor units (pesewas), never floats.

```
organizations (trial/subscription status, referral code + referred-by)
  └─ branches
       └─ users (role: owner/manager/cashier, per-branch assignment;
                  owner/manager: password hash, cashier: PIN hash)
       └─ devices (per-user registered device, owner-revocable —
                    protects against lost/stolen tablets)
       └─ product_categories (e.g. Drinks, Snacks, Toiletries)
       └─ products (barcode scoped PER-TENANT, not globally unique;
                     purchase_unit + sale_unit + conversion factor
                     for "breaking bulk", e.g. carton of 24 -> piece)
            └─ stock_levels (per-branch, tracked in base/sale units)
       └─ suppliers
       └─ sales (voided flag, void reason, approving-manager reference)
            └─ sale_items (cashier, cost snapshot,
                            discount + approving-manager reference if any)
            └─ sale_payments (multiple lines per sale — split cash/MoMo)
       └─ shifts (cashier, opening float, expected cash,
                   counted cash, discrepancy, clock-in/out times)
       └─ stock_takes (count session: expected vs actual per product,
                        adjustment reason, logged)
       └─ staff_salaries (agreed salary, payments/advances log per user)
       └─ expenses (category, amount, date, note — feeds P&L)

  # stock_levels is a REBUILDABLE CACHE, not the source of truth —
  # stock_movements (event-sourced, append-only deltas) is authoritative.
  # Two concurrent sales both apply correctly since deltas are commutative.
  └─ customers (name, phone, optional credit limit override)
       └─ credit_ledger_entries
  └─ stock_movements (audit trail — includes stock-take adjustments,
                       void restocks, unit-conversion receipts)
  └─ audit_log (actor, action, target, timestamp)
```

## Key correctness rule
A DB-level transaction wraps sale creation + stock movement + credit ledger entry as one atomic unit. This is the main reason PostgreSQL was worth the switch from MongoDB — see [[Architecture]].

## Notable design decisions
- **Barcodes are per-tenant, not globally unique** — two shops can legitimately use the same manufacturer barcode for different local products
- **`audit_log`** is the record that resolves owner/staff disputes (discount overrides, stock adjustments, account changes) — not just a debug log
- **`customers`** support full optional profiles for anyone, not just credit customers — enables repeat-customer recognition and future loyalty without re-architecting later (see [[Product-Features]])
- **`stock_movements` over `stock_levels`**: event-sourced deltas as the source of truth, rebuildable cache for the current count — adopted from [[Research-Notes]] as a correctness improvement independent of the offline-first question

Related: [[Multi-Tenancy]], [[Architecture]], [[Product-Features]], [[Research-Notes]]
