---
tags: [design, frontend, ux]
---

# Design Language

## Direction
Clean, minimal, **no rounded corners anywhere** — sharp rectangles throughout (buttons, tiles, panels, inputs).

## System
- **Components**: shadcn/ui + Tailwind, zero border-radius configured
- **Visual separation**: thin 1px borders/dividing lines between sections instead of cards/shadows
- **Typography**: system font stack (native per device — San Francisco/Roboto/Segoe), zero load cost. **Prices use tabular numerals** so digits align in columns and don't jitter as they change during entry
- **Color**: a real sunlight-readable, high-contrast palette (refined via [[Research-Notes]]) — near-black ink on pure white rather than soft/pastel SaaS tones, a confident green for primary actions/confirmed states, amber for offline/pending/low-stock, red for destructive/variance. The real user stands at a shop counter, often in direct sunlight, on a cheap low-contrast screen — soft dashboard colors fail there
- **Touch targets**: 56px minimum, 64px on the checkout path — fingers, not styluses, sometimes wet or holding a product
- **Buttons**: sharp rectangles, solid fill for primary actions (e.g. "Complete Sale"), outline-only for secondary
- **Empty/loading states**: plain text + one clear call-to-action, no illustrations or mascots
- **Checkout content**: text-first — product name + price is the primary label; icons only for navigation/actions, not decoration; product images optional/secondary

## Key screen layouts

### Checkout
Grid of text-first product tiles (name + price) with a running cart sidebar on desktop/tablet. On narrow phone widths, the cart collapses to a slim bottom-anchored summary bar (item count + total) that expands to full view on tap — no separate cart screen/context-switch mid-sale.

### Owner dashboard (landing page)
Today's snapshot at the top (sales total, transaction count, cash/MoMo split, any shift-discrepancy alert), plain-text drill-down links below (Inventory, Reports, Staff, Credit). No charts on the first screen — low information density by design.

### Multi-branch view
Combined "all branches" view by default, with a simple switcher to drill into one branch.

### Navigation
Role-specific:
- **Cashiers**: stripped-down bottom nav — Checkout, Shift, Done
- **Owners/managers**: fuller nav — Dashboard, Inventory, Staff, Reports, Settings

Related: [[Product-Features]] for what these screens do, [[Architecture]] for the frontend stack these are built with, [[Research-Notes]] for the reasoning behind the sunlight-readable palette and touch-target sizing.
