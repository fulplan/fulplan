---
tags: [product, features]
---

# Product Features (per tenant)

## Core
- **Platforms**: Android phone/tablet, Windows PC, browser — one responsive PWA
- **Payments**: Cash + Mobile money via Paystack; manual MoMo recording at MVP, automated in Phase 2. **Split payments supported** — one sale can record multiple payment lines (e.g. part cash + part MoMo), matching real Ghanaian customer behavior
- **Connectivity**: **Online only** — deliberate speed trade-off. See [[Open-Risks]]
- **Inventory**: Full — stock levels, low-stock alerts (in-app), suppliers, cost vs. selling price, profit, product categories (e.g. Drinks, Snacks, Toiletries) for browsing/reporting
- **Unit conversion ("breaking bulk")**: a product can have a purchase unit (e.g. carton of 24) and a sale unit (e.g. piece); stock is tracked in base units so a carton purchase auto-updates piece-level stock. Core to how many target shops actually operate — buy wholesale, sell retail
- **Barcodes**: Phone camera scan + USB scanner gun support, per-tenant scoped (see [[Data-Model]])
- **Users & roles**: Owner / Manager / Cashier permission levels
- **Branches**: Multi-branch per tenant from day one; owners land on a combined "all branches" view by default with a switcher

## Anti-theft features (these are what actually sell a POS to a Ghanaian shop owner)
- **Price editing locked to owner/manager**: cashiers sell at list price only. Manager-PIN override required for any discount, every override logged in `audit_log`
- **Shift/till reconciliation**: cashier clocks in with a starting cash float; system tracks expected cash from that shift's sales **plus logged manual cash in/out entries** (e.g. "GHS 20 out — fuel"); cashier counts and enters actual cash at clock-out; discrepancy flagged to owner. Cash in/out logging matters because without it, legitimate small expenses would show up as a "discrepancy" every day, undermining the whole feature's credibility
- **Stock take**: periodic full inventory count — owner/manager walks the shop entering actual quantities, system shows expected-vs-actual and adjusts stock with a logged reason. Catches inventory shrinkage (theft, spoilage, miscounts), which is a bigger real-world theft vector across many small items than till cash alone
- **Voids/returns**: manager-PIN-approved (same mechanism as discount override), restores stock, adjusts cash/credit, logged in `audit_log` — without this, a wrong sale or genuine return has no clean correction path
- **Daily branch summary ("Z-report")**: rolls up all shifts/cashiers at a branch into one end-of-day total (sales, cash/MoMo split, discrepancies, top items) — distinct from a single cashier's shift report, this is the number an owner actually checks once a day

## Credit sales ("book" credit)
Partial payments, balance tracking, owner-configurable credit limit (per-customer or default) with a visible-but-not-blocking warning at checkout when a sale would cross it.

## Customers
Full optional profiles for any customer (name + phone, purchase history), not just credit customers. Shop-managed only — no customer portal, no automated balance reminders at MVP (matches how these relationships work today: in-person, trust-based). Loyalty/points out of scope for MVP.

## Receipts
Thermal printer (USB/Windows first, Bluetooth/Android via RawBT later) + WhatsApp share link; SMS in phase 2.

## Checkout flow extras
- **Parked/held sales**: a cashier can park an in-progress cart (not yet completed) to serve another customer, then return to it later — matches real busy-shop workflow

## Reports (v1)
Daily sales summary, basic profit view, shift discrepancy log, daily branch summary (Z-report). Best/worst sellers and staff performance land in Phase 2.

- **Formats**: viewable in-app, plus **PDF** export (clean printable summary for a bank/accountant) and **Excel/CSV** export (raw data for bookkeeping)
- **Visuals**: the dashboard stays low-density/number-first (see [[Design-Language]]), but the dedicated Reports screen — deliberately navigated to for analysis — includes simple charts (sales trend, category breakdown), since that's a different context than the at-a-glance dashboard
- **Scheduled push**: daily/weekly summary pushed automatically via WhatsApp (reuses the support channel and the daily branch summary data) rather than requiring the owner to open the app to check

## Salary & expenses (feature-parity check against a competitor's nav — see [[log]])
- **Salary records**: basic tracking, not full payroll — each staff member's agreed salary, log of payments/advances made to them. No Ghana SSNIT/PAYE compliance calculations (informal-sector shop staff scale, not a formal HR system)
- **Business expenses log**: owner logs any business expense (rent, utilities, restocking costs, salary payments once made) with a category and amount — this is what makes profit numbers trustworthy rather than just sales-minus-cost-of-goods
- **P&L report**: a real Profit & Loss statement — revenue − cost of goods − expenses = net profit — upgraded from the earlier "basic profit view," made meaningful specifically because expenses are now tracked. A genuine differentiator vs. a bare sales-summary competitor feature

## Suppliers / accounts payable
Basic supplier balance tracking mirrors the customer credit ledger, reversed: purchases on credit from a supplier and payments made to them. Reuses the existing `suppliers` entity already in the data model for stock-in.

## Multi-cashier live sync
Near-real-time via periodic refresh (TanStack Query auto-refetch every ~10-30s and on key actions), not full websockets. Catches the realistic risk (two cashiers at the same branch selling the last unit of something) without persistent-connection infrastructure that isn't justified until branches have genuinely simultaneous multi-cashier volume.

## Invoices vs. receipts
Two distinct documents from the same sale data:
- **Receipt** — the standard walk-in sale document (thermal print / WhatsApp link)
- **Formal invoice** — for credit/wholesale sales: itemized, customer name/address, invoice number, payment terms, due date. Same underlying sale data, different template/formatting

## Onboarding speed
Shared read-only starter catalog of common Ghanaian provision-store products (with typical barcodes) that a new shop can bulk-copy from at signup instead of typing every product by hand.

## Language
English only for MVP; revisit Twi/local language if pilot feedback asks for it.

Related: [[Design-Language]] for how these screens look, [[Multi-Tenancy]] for the SaaS layer these features sit inside.
