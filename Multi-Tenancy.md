---
tags: [saas, tenancy, security]
---

# Multi-Tenancy — the SaaS Core

This is the part that makes this "completely SaaS" rather than a custom build: many independent shops (tenants) run on one shared system.

## Tenant data isolation
**Shared PostgreSQL database, strict backend-enforced scoping.** Every row carries `organization_id`. A single Fastify middleware/plugin resolves the authenticated user's `organization_id` and injects it into every Prisma query at the data-access layer — not left to individual route handlers to remember. Paired with a dedicated automated test suite that specifically tries (and must fail) to access another tenant's data.

Chosen over per-tenant databases: standard, trust-appropriate SaaS pattern at this budget/scale. See [[Data-Model]] for the schema this scoping applies to.

**This is flagged in [[Open-Risks]] as the single most important correctness property in the whole system.**

## Onboarding
Self-service signup — anyone creates an org, adds branches, invites staff, starts a free trial with zero manual work from the founder. Referral code capture happens at signup (see [[Business-Model]] growth loop).

## Super-admin panel
Yes, from day one. Founder needs a global view: all organizations, trial/subscription status, usage, ability to disable non-payers. **Read-only** for MVP — no full "log in as tenant" impersonation (avoids the audit/consent complexity that needs to be trustworthy before it's safe to ship).

## Billing & trial
- **Trial**: 30 days, automated, in-app + WhatsApp reminders before expiry
- **Billing**: Paystack subscriptions (GHS), webhook-driven
- **Dunning**: 3 retries over ~5–7 days with reminder notifications on payment failure, then auto-lock to read-only
- **Cancellation**: immediate downgrade to read-only (same mechanism as failed-payment lock) → data retained ~30–90 days in case of resubscribe → self-service delete available anytime
- **Merchant billing history**: self-service page showing past charges/status (separate from customers' sales receipts)
- **Plan tiers**: single plan, one price, full feature set at MVP — add tiers later once real usage data shows what to gate
- **Staff seats**: unlimited on the single plan — no seat-cap logic at MVP

## Tenant URLs
Single shared app URL, login-based. No per-tenant subdomains (avoids DNS/wildcard-SSL complexity for no functional benefit at MVP).

## Data ownership & compliance
Merchant owns their data. Self-service CSV export + delete-account-and-data. Motivated by trust and Ghana's Data Protection Act (Act 843) — full DPC registration is a founder to-do outside this technical plan (see [[Business-Model]]).

## Support
WhatsApp/phone as primary channel — direct, familiar for a small Ghanaian pilot cohort. Plus a simple in-app Help page + short changelog to reduce repeat questions as tenant count grows.

## Shared-device safety
Hard reset (full reload + clear all local state/cache) on every logout or organization switch. Cheap Android tablets in Ghana are commonly reused/resold between shops or shifts — this eliminates the "saw the wrong shop's data" failure mode, which is a more realistic threat here than a hacker.

## Trial abuse
Not gated at MVP (small, known pilot cohort). Keep phone-verification infra in mind (needed anyway for receipts/MoMo — see [[Architecture]]) so phone-verified trial limits can be added quickly once signup goes public.

Related: [[Architecture]] for the technical implementation, [[Data-Model]] for the schema, [[Roadmap]] for build order.
