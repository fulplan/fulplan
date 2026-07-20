---
tags: [business]
---

# Business Model

## What
Multi-tenant retail POS SaaS — not a custom one-off build. Any shop signs up, runs their business, pays a subscription. One system serves all tenants.

## Who (MVP)
Provision/general stores in Ghana. Expand later to pharmacy, restaurant, boutique/electronics — see [[Roadmap]] Phase 3.

## Pricing
Self-service subscription, **GHS 99–150/month** (recalibrated from an initial 50-100 estimate — see [[Research-Notes]], real Ghana POS competitors cluster at GHS 99-300/month, so the original target was underpriced, not aggressively cheap), single plan (no tiers) at MVP. Unlimited staff seats on the plan.

## Wedge
Being meaningfully cheaper than incumbents (omniPOS, Bsale, MoMo agent terminals). The deeper "why switch beyond price" is **still unproven** — see [[Open-Risks]]. Validate in parallel with building, not before.

## Team & constraints
- Solo founder, MERN experience (React/Express/MongoDB/Node)
- Small budget — free-tier-first infra
- Timeline: paying pilot customers within ~1–2 months
- Working style: Claude builds fast and explains along the way; founder reviews/steers and drives the business side

## Growth loop
Referral code built into signup from day one — referring shop and new shop both get a discount. Matches how trust actually spreads among Ghanaian shop owners (word of mouth over ads). Cheap to build now, expensive to retrofit once billing logic is more complex.

## Legal
Business registration, ToS/Privacy Policy, Ghana Data Protection Commission registration — founder is handling these separately, outside the technical build. Flagged in [[Open-Risks]] as things to close before charging real money at scale.

## Unresolved / dismissed questions (revisit later)
- Product name — not yet decided
- Customer acquisition channel beyond existing contacts — not yet decided
- Ghana VAT/NHIL receipt compliance depth — not yet decided
- Named competitor pricing deep-dive — GHS 50-100 target is an estimate, not verified against real competitor numbers

See [[Multi-Tenancy]] for the SaaS mechanics (billing, trial, cancellation) that operationalize this model.
