# Deploying the Admin Dashboard

Production hosting is expected on **Vercel**. Docker and manual standalone builds remain optional for self-hosting.

The app uses Next.js `output: "standalone"` for Docker / `node server.js` deployments. Vercel runs the standard Next.js build (`next build`); you do not need to ship the standalone folder yourself.

---

## Option 1: Vercel (recommended)

### 1. Connect the repo

1. Import the Git repository in the [Vercel dashboard](https://vercel.com/new).
2. Framework preset: **Next.js**. Build command: `pnpm build` (or `npm run build`). Install command: `pnpm install` (or `npm install`).

### 2. Environment variables

In **Project → Settings → Environment Variables**, add (Production / Preview as needed):

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Postgres URL (e.g. Supabase, Neon, RDS). Use a **pooler** URL if your provider recommends it for serverless. |
| `BETTER_AUTH_SECRET` | Yes | Min 32 characters. |
| `BETTER_AUTH_BASE_URL` | Yes (prod) | Your live URL, e.g. `https://your-app.vercel.app` or custom domain — **no trailing slash**. |
| `REDIS_URL` | No | e.g. Upstash `rediss://...` for realtime (SSE) and rate limiting. **Recommended in production:** without Redis, rate limits fall back to an in-memory counter (per-Lambda instance, not shared across regions), and SSE fan-out degrades to single-instance broadcast. |
| `ENDUSER_SESSION_DAYS` | No | Extension `Bearer` token lifetime in days. Defaults to `30`. Must be a positive integer. |
| `REALTIME_LIVE_HEARTBEAT_MS` | No | SSE keep-alive interval in ms for `GET /api/extension/live`. Defaults to `60000` (1 min). Lower (e.g. `15000`) if your proxy/CDN idle-closes the stream sooner. |
| `REALTIME_LEASE_MAX_STALE_MS` | No | Milliseconds without a heartbeat before Redis drops the live SSE lease (live counts / Delivery Live table). Defaults to `300000` (5 min). Range `30000`–`3600000`. |
| `DOMAIN` | No | If you use it in `next.config` / CORS; set to your production host if applicable. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No | Only for seeding the first admin (`pnpm db:seed-admin` run locally against prod DB, or a one-off job). |

Match `BETTER_AUTH_BASE_URL` to the exact URL users use (custom domain vs `*.vercel.app`).

### 3. Deploy

Push to your connected branch; Vercel builds and deploys. Migrations run on cold start via `instrumentation.ts` when the serverless runtime boots — ensure `DATABASE_URL` is reachable from Vercel’s regions.

### 4. Optional checks

- [ ] `src/proxy.ts` adds baseline security headers (frame deny, nosniff, HSTS in production)
- [ ] `BETTER_AUTH_BASE_URL` matches the production domain (no trailing slash)
- [ ] Postgres allows connections from Vercel (IP allowlists / pooler docs from your DB provider)
- [ ] Redis (if used) allows TLS and serverless-friendly connection limits

---

## Option 2: Docker

### 1. Create `.env.local` on the server

Create `.env.local` in the project root with production values:

```bash
# Postgres (use Docker service name when using docker-compose)
DATABASE_URL=postgresql://ads_admin:YOUR_PASSWORD@postgres:5432/ads_platform

# Redis
REDIS_URL=redis://redis:6379

# Better Auth (required)
BETTER_AUTH_SECRET=your-super-secret-at-least-32-characters-long
BETTER_AUTH_BASE_URL=https://your-dashboard-domain.com

# Optional: seed default admin when no users exist
# ADMIN_EMAIL=admin@example.com
# ADMIN_PASSWORD=your-secure-password
```

**Important:** Replace `YOUR_PASSWORD`, `your-super-secret-at-least-32-characters-long`, and `https://your-dashboard-domain.com` with real values.

### 2. Build and run

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The app will be available on port 3000. Migrations run automatically on startup.

---

## Option 3: Manual build → copy to server

### 1. Build locally

```bash
pnpm build
```

This produces `.next/standalone/`, `.next/static/`, and `public/`.

### 2. Create deployment package

```bash
# From project root
mkdir -p deploy
cp -r .next/standalone/* deploy/
cp -r .next/static deploy/.next/
cp -r public deploy/
cp -r drizzle deploy/
```

### 3. Create `.env.local` on the server

Same contents as the Docker section above, but use your server’s Postgres/Redis hostnames:

```bash
# If Postgres/Redis are on the same host:
DATABASE_URL=postgresql://ads_admin:PASSWORD@localhost:5432/ads_platform
REDIS_URL=redis://localhost:6379

# Better Auth
BETTER_AUTH_SECRET=your-super-secret-at-least-32-characters-long
BETTER_AUTH_BASE_URL=https://your-dashboard-domain.com
```

### 4. Run on server

```bash
cd deploy
NODE_ENV=production node server.js
```

Or use a process manager (e.g. systemd, PM2) and load env from `.env.local`.

---

## Required environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | Yes | Min 32 characters |
| `BETTER_AUTH_BASE_URL` | Yes (prod) | e.g. `https://dashboard.example.com` |
| `REDIS_URL` | No | Realtime (SSE) + rate limiting. In-memory fallback per instance if missing. |
| `ENDUSER_SESSION_DAYS` | No | Extension Bearer token lifetime in days (default `30`). |
| `REALTIME_LIVE_HEARTBEAT_MS` | No | SSE heartbeat interval in ms (default `60000` = 1 min). |
| `REALTIME_LEASE_MAX_STALE_MS` | No | Lease TTL without heartbeat in ms (default `300000` = 5 min). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No | For seeding first admin user |

---

## Redis extension caches

With `REDIS_URL` set, the app caches extension hot-path JSON in Redis (`extension:campaigns:*`, `extension:platforms:list`, `extension:campaigns:domains`; see [`src/lib/redis.ts`](../src/lib/redis.ts)). Keys use a **12-hour TTL** as a safety net; admin mutations **invalidate** (`DEL`) them on change. **Manual SQL or external DB edits** can still serve stale reads until TTL expiry or `DEL`.

---

## Checklist before deploy

- [ ] `BETTER_AUTH_BASE_URL` matches your production domain (no trailing slash)
- [ ] `BETTER_AUTH_SECRET` is at least 32 characters and kept secret
- [ ] Postgres and Redis are reachable from the app
- [ ] Migrations run on first start (via `instrumentation.ts`)
