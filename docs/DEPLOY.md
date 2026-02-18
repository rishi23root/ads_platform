# Deploying the Admin Dashboard (Standalone Build)

The app uses Next.js `output: "standalone"` — a minimal, self-contained build that runs with `node server.js`.

## Option 1: Docker (recommended)

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

## Option 2: Manual build → copy to server

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

Same contents as Option 1, but use your server’s Postgres/Redis hostnames:

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
| `REDIS_URL` | No | Realtime features degrade gracefully if missing |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | No | For seeding first admin user |

---

## Checklist before deploy

- [ ] `BETTER_AUTH_BASE_URL` matches your production domain (no trailing slash)
- [ ] `BETTER_AUTH_SECRET` is at least 32 characters and kept secret
- [ ] Postgres and Redis are reachable from the app
- [ ] Migrations run on first start (via `instrumentation.ts`)
