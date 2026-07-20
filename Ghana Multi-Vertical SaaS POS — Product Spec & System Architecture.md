

  

> **Target:** Retail, supermarkets, restaurants/bars, pharmacies, and general SMEs in Ghana

> **Non-negotiables:** Offline-first, MoMo-native, GRA E-VAT compliant, sub-300ms checkout

  

---

  

## 1. Product Thesis

  

A Ghanaian shop owner should be able to open a browser tab on a GH¢900 Android tablet, ring up a customer in under three seconds with no internet, take payment by MTN MoMo, print an 80mm receipt with a GRA-cleared QR code, and see their profit on their phone that evening.

  

Everything in this architecture serves that sentence.

  

**Three design commitments that drive every decision below:**

  

| Commitment | Consequence |

|---|---|

| The network is a bonus, not a dependency | Local-first data store; the server is a sync target, not the source of truth during a sale |

| Payment means Mobile Money | MoMo is a first-class tender type with automatic reconciliation, not a "notes" field |

| Compliance is a feature, not a chore | E-VAT clearance built into the sale pipeline, works offline, syncs within 24h |

  

---

  

## 2. Scope: Modules & Verticals

  

### 2.1 Core platform (every business gets this)

  

| Module | Contents |

|---|---|

| **Sales / Checkout** | Cart, tender split, discounts, holds/parked sales, returns, refunds, receipts |

| **Inventory** | Products, variants, categories, units, stock levels, adjustments, transfers, low-stock alerts |

| **Purchasing** | Suppliers, purchase orders, goods received notes, landed cost |

| **Customers** | Directory, purchase history, credit accounts (a huge deal in Ghana), loyalty points |

| **Payments** | Cash, MoMo (MTN/Telecel/AT), card, bank transfer, GhQR, credit/on-account |

| **Cash management** | Register sessions, opening float, cash drops, blind close, variance reporting |

| **Staff & Permissions** | Roles, PIN login, per-action permissions, activity audit trail |

| **Reports** | Z-report, sales by hour/product/staff, profit margin, stock valuation, tax report |

| **Multi-branch** | Branch-level stock, consolidated reporting, inter-branch transfers |

| **Compliance** | GRA E-VAT invoicing, VAT/levy line items, invoice archive |

  

### 2.2 Vertical packs (toggleable, sold as add-ons)

  

**Pharmacy pack** — batch & expiry tracking (FEFO dispensing), controlled-substance register, drug interaction warnings, NHIS claim lines, prescription records, Pharmacy Council-friendly reporting, near-expiry dashboard.

  

**Restaurant & bar pack** — table map & floor plan, order → kitchen ticket flow, KDS (kitchen display), course timing, split bills & merge tables, modifiers ("no pepper", "extra sauce"), waiter assignment & tips, recipe-based stock depletion, happy-hour pricing.

  

**Supermarket pack** — scale/weighted items, barcode label printing, multi-lane cashier sessions, promotions engine (BOGO, bundles), shelf-price audit.

  

**Services pack** (salons, workshops, clinics) — appointment booking, service catalogue with duration, technician commission, walk-in queue.

  

**Design rule:** vertical packs are *feature flags over the same schema*, not forks. A restaurant that also sells packaged goods gets both packs on one account.

  

---

  

## 3. System Architecture

  

### 3.1 The shape of it

  

```

┌──────────────────────────────────────────────────────────────┐

│  CLIENT (PWA)  — Android tablet / Windows PC / phone         │

│                                                              │

│  React UI ──► Local Query Layer ──► SQLite (OPFS/WASM)       │

│                       │                                       │

│                       ▼                                       │

│              Sync Engine (outbox + pull)                     │

│                       │                                       │

│  Peripherals: WebUSB/WebSerial printer, HID scanner          │

└───────────────────────┬──────────────────────────────────────┘

                        │  (delta sync, compressed, resumable)

                        ▼

┌──────────────────────────────────────────────────────────────┐

│  EDGE  — Cloudflare (Accra PoP): TLS, cache, WAF, static     │

└───────────────────────┬──────────────────────────────────────┘

                        ▼

┌──────────────────────────────────────────────────────────────┐

│  API TIER  (stateless, horizontally scaled)                  │

│   • Sync service      • Auth service    • Reporting service  │

│   • Payments service  • Tax/E-VAT service                    │

└───────┬──────────────────┬───────────────────┬───────────────┘

        ▼                  ▼                   ▼

┌──────────────┐  ┌─────────────────┐  ┌──────────────────────┐

│ PostgreSQL   │  │ Redis           │  │ Job Queue (workers)  │

│ (primary +   │  │ (cache, rate    │  │ • MoMo reconcile     │

│  read rep.)  │  │  limit, locks)  │  │ • E-VAT transmit     │

└──────────────┘  └─────────────────┘  │ • Reports, SMS       │

                                        └──────────────────────┘

        ▼                                        ▼

┌──────────────────────┐              ┌──────────────────────┐

│ Object storage (S3)  │              │ External: Hubtel/     │

│ receipts, backups    │              │ Paystack, MTN MoMo,   │

└──────────────────────┘              │ GRA VSDC, SMS        │

                                       └──────────────────────┘

```

  

### 3.2 Why local-first (and what it actually means)

  

A conventional cloud POS sends the sale to the server and waits. In Kumasi at 6pm on a congested 3G cell, that wait is 2–8 seconds, and during an outage it's forever. That is a dead business.

  

In this architecture the **client owns a full replica** of that branch's operational data — products, prices, customers, open sessions, today's sales. A sale is:

  

1. Write to local SQLite inside a transaction (~5–15ms)

2. Render the receipt, print, done — **the cashier is free**

3. Append the mutation to an outbox table

4. Sync engine drains the outbox whenever a network exists

  

The server is authoritative for *conflict resolution and reporting*, never for *transaction latency*.

  

**What syncs down (pull):** product catalogue, prices, customers, staff, settings, other branches' summaries.

**What syncs up (push):** sales, payments, stock movements, session events, customer edits.

  

### 3.3 Conflict resolution

  

| Data type | Strategy | Rationale |

|---|---|---|

| Sales / receipts | **Append-only, never conflicts** | Each sale has a client-generated ULID; server dedupes on it |

| Stock levels | **Event-sourced deltas, not absolutes** | Never sync "stock = 40". Sync "-3". Two offline tills selling the same item both apply correctly |

| Products, prices, settings | **Last-write-wins + `updated_at` + `updated_by`** | Rare edits, low conflict risk |

| Customer credit balance | **Server-computed from ledger entries** | Client shows a cached balance flagged "as of <time>" when offline |

  

Event-sourced stock is the single most important choice here. Absolute-value sync silently destroys inventory accuracy the moment two devices go offline. Deltas are commutative — order doesn't matter.

  

Negative stock is *allowed* and *flagged*, never blocked. A shop that can't sell because the software disagrees about stock will uninstall the software.

  

### 3.4 Sync protocol

  

- **Transport:** HTTPS + JSON, gzip/brotli. WebSocket for live push when connected; polling fallback (30s) when not.

- **Cursor-based:** client sends `last_server_seq`; server returns changes since, plus a new cursor.

- **Batched & chunked:** max 500 mutations or 256KB per request, resumable — a dropped connection mid-sync never loses or duplicates data (idempotency key per batch).

- **Backoff:** exponential with jitter, capped at 60s, so 400 tills reconnecting after a national outage don't stampede the API.

- **Bandwidth budget:** a day of trading for a busy shop (400 sales) should sync in **under 400KB**. Compress, send IDs not objects, never re-send the catalogue.

  

---

  

## 4. Tech Stack

  

| Layer | Choice | Why |

|---|---|---|

| **Client shell** | PWA (installable, service worker) | One codebase for Android tablet, Windows till, and the owner's phone. No app-store friction, no APK sideloading, instant updates. |

| **UI framework** | React 18 + TypeScript + Vite | Hiring pool in Ghana/Nigeria, ecosystem, fast builds |

| **Local DB** | SQLite via WASM + OPFS (`wa-sqlite`) | Real SQL, real indexes, real transactions in the browser. IndexedDB alone can't do joins fast enough for a 10,000-SKU catalogue search. |

| **Sync engine** | Custom outbox on SQLite (or PowerSync if buying) | Full control over the delta semantics above; PowerSync is the buy option if you want to skip ~8 weeks of work |

| **State** | Zustand + TanStack Query (server slices only) | Minimal re-render surface; the DB is the state |

| **Styling** | Tailwind CSS + custom design tokens | Fast, no runtime CSS-in-JS cost |

| **Backend** | Go (or Node/NestJS) | Go for sync/API throughput and tiny memory footprint on cheap instances; Node if hiring speed matters more |

| **Database** | PostgreSQL 16 + read replica | Row-level multi-tenancy, JSONB for vertical-specific fields, partitioning on sales by month |

| **Cache/locks** | Redis | Session cache, rate limits, idempotency keys, distributed locks |

| **Queue** | Redis Streams or NATS | E-VAT transmission, MoMo reconciliation, SMS, report generation |

| **Object storage** | S3-compatible (Backblaze/Wasabi for cost) | Receipt PDFs, backups, product images |

| **Hosting** | AWS `af-south-1` (Cape Town) primary | Nearest hyperscaler region; ~80–120ms to Accra |

| **Edge/CDN** | Cloudflare (Accra PoP) | Static assets served locally = fast first load; WAF + DDoS |

| **Observability** | OpenTelemetry → Grafana/Loki; Sentry | Must trace a slow sync back to a specific merchant device |

  

**On Go vs Node:** the sync endpoint is the hot path — it will handle every mutation from every till in the country. Go's concurrency and memory profile lets you run this on a US$40/month instance for the first 500 merchants. If your team is JS-only, NestJS + Fastify is acceptable; just plan to scale horizontally sooner.

  

---

  

## 5. Data Model (core tables)

  

```sql

-- Multi-tenancy: every operational table carries tenant_id + branch_id

-- Postgres RLS enforces isolation; the client replica only ever holds one tenant

  

tenants          (id, name, plan, vertical_packs[], vat_registered, tin, gra_cis_id, created_at)

branches         (id, tenant_id, name, address, timezone, receipt_header, momo_merchant_code)

users            (id, tenant_id, name, phone, pin_hash, role, branch_ids[], active)

  

products         (id, tenant_id, sku, barcode, name, category_id, unit, tax_group,

                  cost_price, sell_price, track_stock, track_batch, is_service, updated_at)

product_variants (id, product_id, attrs jsonb, barcode, sell_price, cost_price)

stock_levels     (branch_id, product_id, variant_id, qty)          -- materialised, rebuildable

stock_movements  (id, tenant_id, branch_id, product_id, variant_id, batch_id,

                  delta, reason, ref_type, ref_id, occurred_at, device_id)  -- EVENT LOG, source of truth

batches          (id, product_id, batch_no, expiry_date, qty_received, cost_price)  -- pharmacy

  

sales            (id ULID, tenant_id, branch_id, session_id, user_id, customer_id,

                  subtotal, discount, tax_total, total, status, occurred_at,

                  synced_at, device_id, evat_status, evat_code, evat_qr)

sale_lines       (id, sale_id, product_id, variant_id, batch_id, qty, unit_price,

                  discount, tax_rate, tax_amount, line_total, modifiers jsonb)

payments         (id, sale_id, method, amount, momo_network, momo_ref, momo_status,

                  provider, provider_ref, settled_at)

  

customers        (id, tenant_id, name, phone, credit_limit, loyalty_points, updated_at)

customer_ledger  (id, customer_id, entry_type, amount, ref_id, occurred_at)  -- credit balance = SUM

  

register_sessions(id, branch_id, user_id, opened_at, opening_float, closed_at,

                  counted_cash, expected_cash, variance, status)

  

suppliers        (id, tenant_id, name, phone, balance)

purchase_orders  (id, tenant_id, branch_id, supplier_id, status, total, expected_at)

po_lines         (id, po_id, product_id, qty_ordered, qty_received, unit_cost)

  

sync_outbox      (id, tenant_id, device_id, entity, entity_id, op, payload jsonb,

                  created_at, attempts, status)   -- client-side only

sync_log         (id, tenant_id, device_id, server_seq, applied_at)  -- server-side cursor

audit_log        (id, tenant_id, user_id, action, entity, entity_id, before, after, at)

```

  

**Key modelling decisions:**

  

- `stock_movements` is the truth; `stock_levels` is a cache you can rebuild from scratch. This makes offline stock math correct and makes "why is my stock wrong?" answerable.

- Sale IDs are **ULIDs generated on the client** — sortable by time, collision-free, no server round-trip needed to create a sale.

- `modifiers jsonb` on sale lines carries restaurant extras without a separate schema.

- Sales table is **partitioned monthly** — a merchant's 3-year history stays fast and old partitions can move to cold storage.

  

---

  

## 6. Payments Architecture (Mobile Money)

  

### 6.1 Layered approach

  

```

POS Checkout

     │

     ▼

Payment Abstraction Layer  ─── tender types: cash | momo | card | ghqr | credit | bank

     │

     ▼

Provider Adapter Interface  (charge, status, refund, webhook, reconcile)

     │

     ├── AggregatorAdapter (Hubtel / Paystack)  ◄── DEFAULT: covers MTN + Telecel + AT + card + GhQR

     ├── MtnDirectAdapter   (MTN MoMo Collections API)  ◄── for high-MTN-volume merchants, lower fees

     └── ManualAdapter      (merchant's own MoMo number, cashier confirms) ◄── offline / unlicensed merchants

```

  

Build the **abstraction first**, then Hubtel or Paystack as the first concrete adapter. Never let provider SDK types leak into the domain layer — you will change providers.

  

### 6.2 The MoMo payment flow (online)

  

1. Cashier taps **MoMo**, enters/scans customer phone number

2. POS creates a `payment` row locally with status `pending`, and calls the API

3. Backend calls provider → provider sends USSD push to customer's phone

4. POS shows a live "Waiting for customer to approve…" screen with a 90s countdown and the reference

5. Provider webhook → backend → WebSocket push → POS flips to `success`, prints receipt

6. If the webhook is slow, the POS polls status every 3s as a fallback

  

**Timeout handling matters more than the happy path.** After 90s, offer three buttons: *Check again*, *Switch to cash*, *Cancel*. Never leave a cashier stuck with a queue behind them.

  

### 6.3 The MoMo flow when offline

  

The customer still pays — they send to the merchant's MoMo number directly. The POS records a **`momo_manual`** payment with the customer's number and the transaction reference the cashier types in. When connectivity returns, a reconciliation worker matches those against the merchant's MoMo statement (fetched via the provider API) and flags mismatches on a **Reconciliation** screen. This is the feature that will sell the product — every Ghanaian merchant currently does this by hand at night.

  

### 6.4 Regulatory position

  

Route all funds through a licensed aggregator. Do **not** touch merchant money, do **not** hold balances, do **not** apply for a Bank of Ghana PSP licence at this stage — settlement goes provider → merchant's own bank/MoMo account. You are software. This keeps you out of the GH¢2m integrity-capital regime entirely.

  

Revenue model follows from this: **flat GHS subscription, zero transaction rake.** It's a genuine differentiator and it keeps your regulatory surface minimal.

  

---

  

## 7. Performance & Optimization Strategy

  

You emphasised speed. Here is the budget, and how each number is achieved.

  

### 7.1 Performance budget (enforced in CI)

  

| Metric | Target | Hard fail |

|---|---|---|

| First load (cold, 3G) | < 3.0s | 5.0s |

| Repeat load (service worker) | < 800ms | 1.5s |

| Add item to cart | < 50ms | 100ms |

| Product search (10k SKUs, keystroke → results) | < 80ms | 150ms |

| Complete sale → receipt printing | < 300ms | 500ms |

| JS bundle (initial, gzipped) | < 180KB | 250KB |

| Memory after 8h shift | < 250MB | 400MB |

| Sync of 400 sales | < 400KB | 800KB |

  

### 7.2 How each is achieved

  

**Bundle & load**

- Route-level code splitting: the checkout screen loads alone; reports/settings/admin are lazy chunks

- Preload the checkout route in the service worker on install — the till opens to checkout instantly

- Self-host fonts, subset to Latin, `font-display: swap`

- No moment.js, no lodash, no heavyweight UI kit. Date handling via native `Intl`

- Brotli at the edge; immutable hashed asset filenames with 1-year cache

  

**Search & catalogue (the classic POS bottleneck)**

- SQLite FTS5 virtual table over product name + SKU + barcode → sub-millisecond prefix search on 50k rows

- Debounce at 40ms (not 300ms — cashiers type fast and expect instant)

- Virtualised lists (`@tanstack/virtual`) — render 15 rows, not 10,000

- Barcode scan bypasses search entirely: exact index lookup on `barcode`

  

**Checkout hot path**

- Cart lives in memory (Zustand), not in the DB — only the *completed* sale hits SQLite

- Tax and discount math is pure, synchronous, integer-based (store money in **minor units — pesewas — as integers**, never floats)

- Receipt printing is fire-and-forget to a worker; the UI unblocks immediately

- Optimistic UI everywhere: the sale is done the moment it's in local SQLite

  

**Rendering**

- `React.memo` + stable keys on the cart list; the number pad must never re-render the cart

- CSS transforms for all animation (GPU), no layout thrash

- `content-visibility: auto` on long report tables

  

**Backend**

- Every query on the hot path has a covering index; `EXPLAIN ANALYZE` in code review for anything touching `sales`

- Reports are **pre-aggregated** by a nightly + hourly rollup job into `daily_summaries` — never `GROUP BY` over raw sales at request time

- Connection pooling (PgBouncer), statement timeouts (5s), read replica for all reporting

- Redis cache on catalogue reads with tenant-scoped keys; 60s TTL

- Sales table partitioned monthly; indexes on `(tenant_id, branch_id, occurred_at)`

  

**Network**

- Static assets from Cloudflare's Accra PoP (~10–20ms) instead of Cape Town (~100ms)

- API responses gzipped; sync payloads use short field names and ID references

- HTTP/3 enabled — meaningful gains on lossy mobile networks

  

### 7.3 Device reality

  

Test on the actual hardware Ghanaian merchants buy, not a MacBook:

- A GH¢900 Android tablet (2GB RAM, Chrome)

- A 5-year-old Windows laptop (4GB RAM, integrated graphics)

- Throttled to Slow 3G with 400ms RTT

  

If it's fast there, it's fast everywhere. Put one of each on the team's desk.

  

---

  

## 8. Frontend Design Direction

  

### 8.1 Design brief

  

The user is a cashier or shop owner, standing, often in a shop open to the street with **direct sunlight on the screen**, working on a cheap panel with poor contrast, frequently with one hand occupied by a product or a phone. They are not "using software" — they are serving a queue. Every design decision comes from that.

  

This rules out the whole category of soft, low-contrast, pastel SaaS dashboards. Those are designed for an air-conditioned office and a Retina display.

  

### 8.2 Design tokens

  

**Palette** — built for glare, not for screenshots.

  

| Token | Hex | Use |

|---|---|---|

| `--ink` | `#0B1220` | Primary text, till chrome. Near-black, slightly blue — reads darker than pure grey in sunlight |

| `--paper` | `#FFFFFF` | Surfaces. Pure white, maximum contrast, no cream tint |

| `--field` | `#EEF1F6` | Input & inactive surfaces |

| `--line` | `#C9D1DE` | Borders — heavier than typical SaaS hairlines; hairlines vanish on cheap panels |

| `--green` | `#0B7A4B` | Primary action, confirmed payment, positive totals |

| `--amber` | `#B45309` | Offline state, pending payment, low stock |

| `--red` | `#B4231E` | Destructive, variance, expired stock |

  

Nothing is decorative. **Colour in this product is a status signal only** — if a thing is coloured, it means something. A cashier should be able to read the state of the till from across the room.

  

**Typography**

  

| Role | Face | Notes |

|---|---|---|

| Display / headings | **Bricolage Grotesque** | Slightly compressed, a bit of grit — gives the product an identity without costing legibility |

| UI / body | **IBM Plex Sans** | Designed for interfaces and small sizes; excellent at 14px on a bad screen |

| Numerals & codes | **IBM Plex Sans, tabular figures** (`font-variant-numeric: tabular-nums`) | **Non-negotiable.** Prices must align in columns and must not jitter as digits change during entry |

| References / barcodes | **IBM Plex Mono** | MoMo refs, invoice codes, E-VAT clearance codes |

  

Type scale is deliberately short — 6 steps: 12 / 14 / 16 / 20 / 28 / 44. A POS with twelve text sizes is a POS nobody can scan quickly.

  

**Signature element — money as the hero.** The running total is set in 44px tabular figures, right-aligned, in a dedicated panel that never scrolls and never moves. Everything else on screen is quiet around it. The customer can read it from their side of the counter; the cashier never hunts for it. This is the one place the design is loud, and it's loud because that number is the entire reason the software exists.

  

### 8.3 Interaction rules

  

- **Touch targets: 56px minimum**, 64px for anything on the checkout path. Fingers, not styluses, sometimes wet, sometimes with a pen in hand.

- **Bottom-anchored actions.** Primary buttons sit in the lower third — thumb reach on a tablet held at counter height, not the top-right corner where desktop SaaS puts them.

- **Keyboard-first parity.** Supermarket lanes use USB scanners and keyboards. Every checkout action has a hardware key: `F2` search, `F4` MoMo, `F5` cash, `Enter` complete, `Esc` cancel. A trained cashier should never touch the screen.

- **No modal for the common case.** Payment is a panel that slides in beside the cart, so the cashier can still see what they're selling.

- **Motion budget: 150ms, transforms only.** Enough to show causality, never enough to make anyone wait. `prefers-reduced-motion` honoured.

- **Every destructive action is undoable, not confirmed.** A "Void sale — Undo" toast for 8 seconds beats a confirm dialog that gets muscle-memoried away.

  

### 8.4 Checkout layout

  

```

┌────────────────────────────────────────────────────────────────────┐

│ ● Online   Branch: Adum Main   Kofi M.   Session #418   14:22      │  ← status bar (36px)

├──────────────────────────────────┬─────────────────────────────────┤

│  [ 🔍 Scan or search product ]   │                                 │

│                                  │   CART                          │

│  ┌────────┐┌────────┐┌────────┐  │   ────────────────────────────  │

│  │ Rice   ││ Milo   ││ Sugar  │  │   2 × Rice 5kg      GH¢ 120.00 │

│  │ 5kg    ││ 400g   ││ 1kg    │  │   1 × Milo 400g     GH¢  38.50 │

│  │ ¢60.00 ││ ¢38.50 ││ ¢18.00 │  │   3 × Sugar 1kg     GH¢  54.00 │

│  └────────┘└────────┘└────────┘  │                                 │

│  ┌────────┐┌────────┐┌────────┐  │   ────────────────────────────  │

│  │ ...    ││ ...    ││ ...    │  │   Subtotal          GH¢ 212.50 │

│  └────────┘└────────┘└────────┘  │   VAT + levies      GH¢  42.50 │

│                                  │                                 │

│  [Favourites] [Categories] [All] │        TOTAL                    │

│                                  │      GH¢ 255.00                 │  ← signature: 44px tabular

│                                  │                                 │

│                                  │  ┌───────────┐ ┌─────────────┐ │

│                                  │  │   CASH    │ │    MoMo     │ │  ← 64px, bottom-anchored

│                                  │  └───────────┘ └─────────────┘ │

│                                  │  [Card] [Credit] [Split] [Hold] │

└──────────────────────────────────┴─────────────────────────────────┘

```

  

On a phone, the cart becomes a bottom sheet that expands; the total stays pinned above it. Same information hierarchy, same muscle memory.

  

### 8.5 The offline indicator

  

A single dot in the status bar: **green = synced**, **amber = working offline, N sales queued**, **red = sync failing, needs attention**. Tapping it opens a plain-language panel: *"You're offline. 14 sales are saved on this device and will upload when you're back online. Nothing has been lost."*

  

Merchants' single largest fear about cloud software is losing their day's sales. Address it directly, in plain words, in the interface, permanently visible. This indicator is worth more to conversion than any marketing page.

  

---

  

## 9. Compliance Architecture

  

### 9.1 GRA E-VAT

  

Ghana runs a real-time clearance model — VAT invoices must be transmitted to GRA and returned with a clearance code and QR. The catch: your merchants will frequently be offline. The architecture handles this natively.

  

```

Sale completed (offline)

   │

   ├─► Local invoice signed with device certificate, evat_status = 'pending_local'

   ├─► Receipt prints immediately with "VAT invoice — clearance pending"

   │

   └─► [connectivity restored]

          │

          ▼

      E-VAT worker → GRA VSDC API → clearance code + QR + digital signature

          │

          ├─► Sale updated: evat_status = 'cleared', code stored

          └─► Merchant can reprint/email the cleared invoice; customer can verify by QR

```

  

- Transmission must complete **within 24 hours** — the worker retries aggressively and raises a dashboard alarm at 18 hours.

- Tax engine supports **line-item level tax groups** and prints standard VAT plus levies (NHIL, GETFund) as **separate lines**, as required.

- Invoice numbering is gapless per branch and reconcilable — build the sequence server-side per branch with client-side reserved blocks so offline tills never collide.

- The tax rate table is **versioned with effective dates**, never hard-coded. Ghanaian VAT rules changed in 2025 and will change again; a rate change should be a config push, not a release.

  

### 9.2 Data protection (Act 843)

  

- Register with the Data Protection Commission **before launch** — it's mandatory and increasingly enforced.

- Data minimisation: collect customer name + phone only; never store card PANs (the aggregator does that).

- Encryption at rest (Postgres TDE / encrypted EBS) and in transit (TLS 1.3).

- Per-tenant data export and deletion endpoints — merchants own their data and should be able to leave with it.

- Audit log for every access to customer records.

  

### 9.3 Pharmacy pack compliance

  

Batch/expiry tracking with FEFO enforcement, a controlled-substances register with dispensing records, and exportable reports in the formats the Pharmacy Council and FDA expect. Expiry alerts at 90/60/30 days.

  

---

  

## 10. Security & Multi-Tenancy

  

| Concern | Approach |

|---|---|

| Tenant isolation | `tenant_id` on every row + **Postgres Row-Level Security**, set per connection from the JWT. Belt and braces — a missing `WHERE` clause cannot leak another merchant's data |

| Auth (owner/admin) | Phone + password, TOTP optional, JWT access (15min) + refresh (30d) rotation |

| Auth (cashier) | **4–6 digit PIN**, device-bound, rate-limited (5 attempts → 5min lockout). Cashiers will not type passwords 200 times a day |

| Device trust | Each till registers once and holds a device token; owner can revoke a device remotely (critical when a tablet is stolen) |

| Permissions | Role-based with per-action overrides: void sale, apply discount above X%, open drawer without sale, edit price, view profit margins |

| Local data at rest | SQLite encrypted with a key held in the device token; wiping the token wipes access |

| API | Rate limits per tenant and per device, idempotency keys on all mutations, request signing on the sync endpoint |

| Secrets | Vault/AWS Secrets Manager; no provider keys ever reach the client |

| Audit | Immutable `audit_log` for voids, price edits, discount overrides, cash drops — this is how shop owners catch staff theft, and it's a selling feature |

  

**Fraud note:** staff theft via voided sales and discounts is the number one loss channel for Ghanaian retail. Make the audit trail a *product feature* on the owner's dashboard ("12 voids by Kofi this week — above average"), not a hidden log.

  

---

  

## 11. Infrastructure & Delivery

  

### 11.1 Environments

  

`local` (Docker Compose: Postgres, Redis, MinIO) → `staging` (mirrors prod, seeded demo tenants) → `production`.

  

### 11.2 Production topology

  

- **Region:** AWS `af-south-1` (Cape Town) — nearest hyperscaler to Ghana

- **Compute:** ECS Fargate or a small k8s cluster; 2+ API tasks behind an ALB, autoscaling on CPU + request latency

- **Database:** RDS Postgres 16, Multi-AZ, one read replica for reporting, PgBouncer in front

- **Edge:** Cloudflare in front of everything — Accra PoP serves the PWA shell, WAF, DDoS, HTTP/3

- **Workers:** separate task group for E-VAT, reconciliation, SMS, reports — never share a pool with the API

- **Backups:** automated daily snapshots + PITR (7 days) + weekly logical dump to object storage in a second region

  

### 11.3 CI/CD

  

- Trunk-based, PR checks: typecheck, unit, integration (testcontainers), **Lighthouse budget gate**, bundle-size gate

- Sync-engine tests are the highest-value tests in the codebase: simulate two offline devices selling the same stock, reconnecting in either order, and assert the ledger reconciles

- Blue/green deploys; DB migrations always backward-compatible for one release (the client replicas lag)

- **Client version skew is a first-class problem** — a till may be offline for a week. The sync API must accept payloads from the previous 3 client versions; version negotiation on every sync

  

### 11.4 Observability

  

- Structured logs with `tenant_id` + `device_id` on every line

- Traces across sync → DB → provider

- Alerts: sync failure rate > 1%, E-VAT queue age > 6h, MoMo webhook latency p95 > 10s, any merchant with > 50 unsynced sales for > 12h (call them)

  

---

  

## 12. Build Roadmap

  

| Phase | Duration | Deliverable | Exit criteria |

|---|---|---|---|

| **0 — Foundations** | 3 wks | Repo, CI, Docker, schema v1, auth, tenant model, design tokens & component library | A cashier can log in with a PIN on a tablet |

| **1 — Offline core** ⭐ | 6 wks | SQLite replica, sync engine, outbox, event-sourced stock, conflict tests | Two offline tills sell the same item; stock reconciles correctly on reconnect |

| **2 — Checkout & inventory** | 5 wks | Full cart, tenders, receipts, thermal printing, products, stock, register sessions, Z-report | A real shop trades a full day on it, offline, with no data loss |

| **3 — Payments** | 4 wks | Aggregator adapter (Hubtel/Paystack), MoMo push flow, manual MoMo, reconciliation screen | End-to-end MTN MoMo collection with a real merchant account |

| **4 — Compliance** | 4 wks | Tax engine, E-VAT integration, offline clearance queue, DPC registration | A VAT-registered pilot merchant issues cleared invoices |

| **5 — Pilot** | 6 wks | 10 merchants across 3 verticals in Kumasi/Accra, free, heavily supported | < 1% sync error rate; merchants refuse to go back to their books |

| **6 — Verticals** | 6 wks | Pharmacy pack, restaurant pack | Two paying merchants in each vertical |

| **7 — Commercial** | 4 wks | Billing, plans, self-serve onboarding, owner mobile dashboard, multi-branch | First 50 paying merchants |

  

**Phase 1 is the whole company.** Everything else is table stakes that any competent team can build; the sync engine is what makes the product work in Ghana and what nobody can copy quickly. Do not compress it. If the timeline must shrink, buy the sync layer (PowerSync, ~$49/mo) rather than rushing your own.

  

### Suggested team

2 full-stack engineers (one strong on offline/sync), 1 frontend engineer, 1 designer (part-time after phase 2), 1 founder/product doing merchant support personally through pilot. The founder doing support during phase 5 is not a cost-saving measure — it's the product research.

  

---

  

## 13. Key Risks

  

| Risk | Mitigation |

|---|---|

| Sync bugs corrupt merchant inventory | Event-sourced stock (rebuildable), extensive conflict test suite, per-merchant sync health dashboard, never block a sale on stock |

| MTN MoMo production onboarding drags | Launch on an aggregator; treat direct MTN as an optimisation, never a dependency |

| E-VAT spec or rates change | Versioned tax tables with effective dates; adapter pattern on the GRA client |

| Merchants won't pay monthly | Annual discount, hardware bundling, and prove ROI in-product ("this month you caught GH¢1,400 of missing stock") |

| Support burden crushes the team | In-app WhatsApp support, self-serve onboarding, and instrument the top 10 support reasons then engineer them away |

| Aggregator outage stops payments | Two adapters live (Hubtel + Paystack), automatic failover, manual MoMo always available |

| Cheap devices can't run it | Enforce the performance budget in CI; test on real GH¢900 tablets |

  

---

  

## 14. What to Decide Next

  

1. **Build vs buy the sync engine** — custom (control, ~8 weeks) vs PowerSync (fast, ~$49/mo, less control). This gates Phase 1.

2. **Go or Node backend** — driven by who you can hire in the next 60 days.

3. **First aggregator** — Hubtel (strongest local presence, POS hardware, ~1.95%) vs Paystack (best developer experience, 1–3 day approval).

4. **Beachhead vertical** — pharmacies (high compliance pain, high willingness to pay) or restaurants (volume, viral among owners). Pick one for the pilot; don't do both.

5. **Hardware strategy** — software-only, or bundle printers/scanners/terminals sourced locally as a margin and lock-in play.