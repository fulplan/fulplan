<div align="center">

# Mutasim Abubakar

**Builder · Full-Stack Engineer · Product-Minded Developer**

*Building software that works in the real world — offline-first, sunlight-readable, and designed for the people actually using it.*

[![Twitter](https://img.shields.io/badge/@fulplan-%231DA1F2.svg?style=flat&logo=twitter&logoColor=white)](https://twitter.com/fulplan)
[![Medium](https://img.shields.io/badge/fulplan.medium.com-black?style=flat&logo=medium&logoColor=white)](https://fulplan.medium.com)
[![GitHub](https://img.shields.io/badge/github.com/fulplan-%23181717.svg?style=flat&logo=github&logoColor=white)](https://github.com/fulplan)

</div>

---

## What I'm Building

### GhPOS — Multi-tenant Retail POS SaaS for Ghana
> *The point-of-sale system built for the Ghanaian shop counter: offline-first PWA, works on cheap phones in direct sunlight, with MoMo payment splits, multi-branch management, and strict per-tenant data isolation.*

**Stack:** React 19 · TypeScript · Vite PWA · tRPC · Fastify · PostgreSQL · Prisma · Tailwind v4

**Key design decisions:**
- Money stored as **integer pesewas** — never a float, never a rounding error
- **Row-level security** in Postgres + tRPC middleware — one shop literally cannot see another's data
- **Stock is event-sourced** — `stock_movements` is the source of truth, levels are a rebuildable cache
- **Offline queue** — sales sync when the internet comes back, nothing lost at the counter
- 56–64 px touch targets — fingers, not styluses, sometimes wet, sometimes holding a product

---

## Stack & Tools

| | |
|---|---|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **Backend** | Node.js, Fastify, tRPC, Prisma |
| **Database** | PostgreSQL (row-level security, event sourcing) |
| **Deployment** | Railway, Render, Vercel |
| **Testing** | Vitest — tenant isolation is a release blocker, not a flaky test |

---

## Principles I Build By

- **Offline-first** — assume the network will fail; design for it from the start
- **Real users, real constraints** — cheap phones, slow connections, direct sunlight, one hand free
- **Money is sacred** — integers only, explicit currency, no silent precision loss
- **Security by design** — multi-tenancy enforced at two layers, secrets never in the repo
- **Minimal UI, maximum clarity** — no rounded corners, no mascots, no soft pastels; high contrast for people who work

---

## GitHub Stats

<div align="center">

![Mutasim's GitHub stats](https://github-readme-stats.vercel.app/api?username=fulplan&show_icons=true&theme=default&hide_border=true&count_private=true)

![Top Languages](https://github-readme-stats.vercel.app/api/top-langs/?username=fulplan&layout=compact&hide_border=true&theme=default)

</div>

---

## Find Me

- **Twitter / X** — [@fulplan](https://twitter.com/fulplan)
- **Medium** — [fulplan.medium.com](https://fulplan.medium.com)
- **Email** — eserwaah57@gmail.com

---

<div align="center">
<sub>Available for hire · <a href="https://github.com/fulplan?tab=repositories">See all repositories →</a></sub>
</div>
