---
tags: [glossary, reference]
---

# Glossary

- **Tenant** — one merchant/shop using the platform; has its own organization, branches, users, and data, isolated from every other tenant. See [[Multi-Tenancy]].
- **Organization** — the top-level record for a tenant in the data model (owns branches, users, products, etc.)
- **Branch** — one physical shop location under an organization; a tenant can have multiple.
- **Super-admin** — the founder's platform-wide view across all tenants (not a per-shop role).
- **MoMo** — Mobile Money (MTN MoMo, Telecel Cash, AT Money) — Ghana's dominant digital payment method.
- **Optimistic UI** — showing an action (e.g. a completed sale) as done instantly in the UI while the real save happens in the background, to hide network latency.
- **PWA** — Progressive Web App; a website that can be installed like a native app, works offline-capable to a degree, used here to cover Android/Windows/browser with one codebase.
- **PIN override** — a manager's PIN entered at checkout to authorize a discount a cashier can't grant on their own; logged in the audit trail.
- **Shift close-out / till reconciliation** — end-of-shift process where a cashier counts physical cash against what the system expected, surfacing discrepancies to the owner.
- **Dunning** — the retry/reminder process after a failed subscription payment, before the account is locked.
- **RawBT** — an Android app used as a workaround to send print jobs to Bluetooth thermal printers from a web app.
- **Act 843** — Ghana's Data Protection Act, relevant since the platform stores merchants' customers' personal data.

Related: [[Home]]
