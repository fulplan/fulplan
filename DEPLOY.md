# Deployment Guide

## Architecture

```
Vercel (frontend)  ──https──►  Railway (backend API)
                                      │
                               Railway Postgres
```

---

## Railway — Backend API

### 1. Create project on railway.app
- New Project → Deploy from GitHub repo → select `ghpos`
- Root directory: `/` (railway.toml at root handles workspace)

### 2. Add Postgres plugin
- Inside the project: + New → Database → Add PostgreSQL
- Railway injects `DATABASE_URL` automatically — nothing to copy

### 3. Set environment variables

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(generate: `openssl rand -base64 48`)* |
| `CORS_ORIGIN` | `https://your-app.vercel.app` *(update after Vercel deploy)* |
| `PORT` | `3000` *(Railway sets this automatically)* |

### 4. Deploy
Railway auto-deploys on every push to `main`.
The start command in `railway.toml` runs `prisma migrate deploy` then starts the server.

### 5. Get your API URL
Settings → Networking → Generate Domain → copy `https://ghpos-api-xxx.up.railway.app`

---

## Vercel — Frontend

### 1. Import project on vercel.com
- New Project → Import from GitHub → select `ghpos`
- Framework: **Other** (vercel.json handles everything)
- Root directory: `/`

### 2. Set environment variables

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://ghpos-api-xxx.up.railway.app` *(from step above)* |

### 3. Deploy
Vercel auto-deploys on every push to `main`.
Production URL: `https://ghpos.vercel.app` (or your custom domain)

### 4. Update CORS on Railway
After Vercel gives you the URL, set `CORS_ORIGIN` in Railway to match it:
```
CORS_ORIGIN=https://ghpos.vercel.app
```
Then redeploy the backend (or trigger from Railway dashboard).

---

## Custom domain (when ready)
- Vercel: Settings → Domains → Add `www.ghpos.app` + apex redirect
- Railway: Settings → Networking → Custom Domain → `api.ghpos.app`
- Update `CORS_ORIGIN` to `https://www.ghpos.app` and `VITE_API_URL` to `https://api.ghpos.app`

---

## Secrets checklist before going live
- [ ] `JWT_SECRET` is a long random string (≥ 32 chars), not the dev default
- [ ] `CORS_ORIGIN` matches the exact Vercel URL (no trailing slash)
- [ ] `DATABASE_URL` is Railway's injected Postgres URL (not localhost)
- [ ] `.env` is in `.gitignore` and never pushed
