---
tags: [risks]
---

# Open Risks — things to watch, not yet resolved

- **Tenant data isolation** is the single most important correctness property in the system — gets its own dedicated test suite, not just code review, from week 1. See [[Multi-Tenancy]].
- **Differentiation beyond price** is unproven. The wedge so far is "cheaper than incumbents" (GHS 50-100/month target), but the deeper "why switch" hasn't been validated with real shop owners beyond informal conversations already started. Keep validating in parallel with building.
- **Online-only** connectivity means a network outage = zero sales for pilot shops. This was a deliberate speed trade-off, confirmed **three times** by the founder — most recently after external research explicitly called offline-first "non-negotiable" for Ghana. This is now the single biggest disagreement between this plan and outside market research. Watch closely during the pilot — treat any pilot feedback about lost sales as a serious signal to revisit, not noise. See [[Research-Notes]].
- **GRA E-VAT compliance** — deferred (schema fields only, no real GRA API integration) since the MVP target isn't VAT-registered. Revisit seriously before expanding to supermarkets/pharmacies in Phase 3. See [[Research-Notes]].
- **Ghana Data Protection Act (Act 843)** compliance — export/delete covers the basics, but full DPC registration is a real external step the founder still needs to do before scaling past the pilot.
- **Competitor pricing** — resolved: research showed real named competitors (SellarPro, CliqPOS) at GHS 99-300/month; price recalibrated to GHS 99-150/month accordingly. Still worth validating directly with pilot shop owners. See [[Research-Notes]].
- **Business registration, ToS/Privacy Policy, product name, customer acquisition channel** — these came up but were explicitly deferred/dismissed by the founder; worth revisiting before charging real money at any scale.

Related: [[Business-Model]], [[Multi-Tenancy]], [[Roadmap]]
