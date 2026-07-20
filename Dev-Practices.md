---
tags: [dev, tooling, ops]
---

# Dev Practices

## Repo & workflow
- **Monorepo**: `/frontend`, `/backend`
- **Git**: feature branches + PRs into `main`
- **CI/CD**: GitHub Actions runs tests + lint on every PR; auto-deploys `main` to Vercel (frontend) + Railway (backend)
- **Environments**: staging + production, both on Railway/Vercel
- **Secrets**: platform environment variables only, never in the repo

## Code quality
- **Linting/formatting**: ESLint + Prettier, enforced in CI
- **Migrations**: Prisma Migrate, applied automatically in CI before each deploy
- **Testing**: comprehensive coverage, written alongside each feature (not bolted on after) — the only way this stays feasible given the aggressive timeline. Priority order for coverage: tenant isolation → sale/stock/credit transactions → billing/trial logic → discount PIN override → everything else

## Observability
- **Error monitoring**: Sentry (free tier), frontend + backend
- **Logging**: Fastify's `pino` for technical logs
- **Audit trail**: dedicated `audit_log` table (see [[Data-Model]]) for business-sensitive actions — this is what resolves owner/staff disputes, not a debug tool

## Reliability & resilience
- **Rate limiting**: basic per-IP/per-user limiting from day one, especially login/signup
- **PWA updates**: service worker auto-updates in background with a non-blocking "refresh to update" banner — never force-reloads a cashier mid-sale
- **Checkout sync failure**: optimistic UI; a failed background save queues the sale locally, auto-retries, shows a persistent "N unsynced sales" badge until resolved
- **Zero-connectivity**: PWA app shell loads from cache even with no signal; checkout itself is disabled with a clear "offline — can't process sales" message
- **Account recovery**: email-based password reset (the email collected at signup is the recovery anchor)
- **Backup/DR**: Railway's automatic daily Postgres backups for MVP; revisit point-in-time recovery once real paying customers depend on it

## Third-party services
- **Images**: Cloudinary free tier
- **Transactional email**: Resend or SendGrid free tier (password reset, trial-ending, payment-failed)
- **Payments**: Paystack (customer MoMo collection + merchant subscription billing)

Related: [[Architecture]] for the stack these practices apply to, [[Multi-Tenancy]] for the isolation tests specifically.
