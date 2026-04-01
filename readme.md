# Admin Dashboard - Ad Replacement Platform

Production-grade Admin Dashboard for managing advertisements and notifications for a browser extension. Built with Next.js 16, TypeScript, Drizzle ORM, and PostgreSQL.

## Overview

This admin dashboard provides a complete solution for managing:
- **Platforms**: Configure domains where ads and notifications will be displayed
- **Ads**: Create, manage, and schedule advertisements with images and target URLs
- **Notifications**: Create time-bound notifications for specific platforms
- **Events**: Track extension activity (`enduser_events`: one row per serve; **Events** dashboard at `/events`; legacy path `/analytics` redirects there). The **Users** page aggregates extension customers by `enduser_id`.
- **Extension API**: RESTful API endpoints for browser extensions to fetch ads and notifications

## Architecture at a glance

- **Staff (admin UI)**: Routes under `src/app/(protected)/` use Better Auth session cookies. [`src/lib/dal.ts`](./src/lib/dal.ts) exposes `getSessionWithRole`; API routes use the same pattern for `/api/*` CRUD.
- **Extension customers**: Public routes under `src/app/api/extension/` (`ad-block`, `domains`, `auth/*`). Authenticated calls use a **Bearer** token (see [`src/lib/enduser-auth.ts`](./src/lib/enduser-auth.ts)), not the staff cookie session.
- **Realtime in the dashboard**: The home dashboard uses **staff-authenticated** [`/api/realtime/stream`](./src/app/api/realtime/stream/route.ts) (SSE). Do not point admin UI clients at extension-only endpoints for “live” counts.
- **`end-user` libraries** (easy to mix up):
  - [`src/lib/end-user-dashboard.ts`](./src/lib/end-user-dashboard.ts) — KPIs and snapshot for **one** extension user (detail pages).
  - [`src/lib/end-users-dashboard.ts`](./src/lib/end-users-dashboard.ts) — list query, filters, and pagination for `/api/end-users` and the Users table.
- **Ops / deploy**: Environment and hosting checklist: **[docs/DEPLOY.md](./docs/DEPLOY.md)**.
- **Edge proxy (security headers)**: [`src/proxy.ts`](./src/proxy.ts) runs before routes (Next.js 16+ `proxy` convention). Do not add `middleware.ts`; Next rejects both files at once.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm
- **Database**: PostgreSQL (via Docker Compose)
- **ORM**: Drizzle ORM + Drizzle Kit
- **UI**: Tailwind CSS 4 + shadcn/ui components
- **Authentication**: Better Auth (email/password, session cookies)
- **Icons**: Tabler Icons
- **Charts**: Recharts

## Prerequisites

- Node.js 20+
- pnpm
- Docker and Docker Compose

## Getting Started

### 1. Start Infrastructure Services

Start PostgreSQL using Docker Compose:

```bash
docker compose up -d
```

### 2. Environment Setup

Create `.env.local` file with the following required variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Application
NODE_ENV=development

# Better Auth (required for login)
BETTER_AUTH_SECRET=your-super-secret-at-least-32-characters-long
BETTER_AUTH_BASE_URL=http://localhost:3000

# Redis (optional, for realtime features)
REDIS_URL=redis://localhost:6379

# Optional
DATABASE_POOL_MAX=10

# Optional: seed default admin when no users exist (run: pnpm db:seed-admin)
# ADMIN_EMAIL=admin@example.com
# ADMIN_PASSWORD=your-secure-password
```

**Required environment variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment mode (development/production)
- `BETTER_AUTH_SECRET` - Secret for Better Auth (minimum 32 characters)
- `BETTER_AUTH_BASE_URL` - Base URL of your app (e.g. http://localhost:3000)

**Optional variables:**
- `DATABASE_POOL_MAX` - Database connection pool size (default: 10)
- `REDIS_URL` - Redis URL for realtime features (`/api/realtime/*`) and optional per-IP rate limiting on `POST /api/extension/ad-block` (requests still work without Redis; limits are skipped)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` - For seeding first admin user
- `EXTENSION_INTEGRATION=1` - With `pnpm test:integration`, enables HTTP tests against a running app + DB (see [.env.example](./.env.example))

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Database Migrations

Generate migrations from schema changes:

```bash
pnpm db:generate
```

Apply migrations:

```bash
pnpm db:migrate
```

For development, you can push schema directly (not recommended for production):

```bash
pnpm db:push
```

### 5. Run Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Production deployment (Vercel)

Deploy by connecting this repo to [Vercel](https://vercel.com) and setting environment variables in the project settings. See **[docs/DEPLOY.md](./docs/DEPLOY.md)** for the full checklist (`DATABASE_URL`, `BETTER_AUTH_BASE_URL`, `BETTER_AUTH_SECRET`, optional `REDIS_URL`, etc.). Docker and manual standalone builds are documented there as alternatives.

## Authentication

The dashboard uses Better Auth with email/password and secure session cookies.

- **Login**: Navigate to `/login` and sign in with your email and password
- **Sign up**: New users can create an account at `/sign-up` (first user becomes admin)
- **Session**: Sessions are managed by Better Auth
- **Protected Routes**: All dashboard routes under `/(protected)` require authentication
- **Logout**: Available from the user menu in the sidebar

## Features

### Dashboard
- Overview statistics (campaigns, extension users, request logs)
- Interactive charts for analytics
- Recent campaigns table with quick actions

### Platform Management
- Create, edit, and delete platforms
- Configure domain names for ad targeting
- Activate/deactivate platforms

### Campaign Management
- Create and manage campaigns (ads, popup, or notification type)
- Target platforms, countries, and audience (new users vs all)
- Frequency controls (always, time-based, only once, specific count)
- Status and date range per campaign

### Ad Management
- Content library for ads (name, image, target URL, HTML)
- Ads are linked to campaigns (one ad per campaign for ad/popup types)

### Notification Management
- Create time-bound notifications
- Multi-platform support (link notifications to multiple platforms)
- Date range filtering (only active notifications within date range are returned)
- Read/unread status tracking

### Analytics
- Extension user tracking
- Request log viewing (last 100 requests)
- Statistics for ads served and notifications sent
- User activity metrics

### Extension API
- RESTful endpoints for browser extensions
- Domain-based filtering for ads and notifications
- Request logging for analytics
- See [EXTENSION_API_DOCS.md](./EXTENSION_API_DOCS.md) for complete API documentation

## Project Structure

```
admin_dashboard/
├── src/
│   ├── app/
│   │   ├── (protected)/        # Protected dashboard routes
│   │   │   ├── ads/            # Ad management pages
│   │   │   ├── analytics/      # Analytics dashboard
│   │   │   ├── notifications/  # Notification management
│   │   │   ├── platforms/      # Platform management
│   │   │   ├── layout.tsx      # Protected layout with sidebar
│   │   │   └── page.tsx        # Main dashboard
│   │   ├── api/                # API routes
│   │   │   ├── ads/            # Ad API endpoints
│   │   │   ├── auth/           # Authentication endpoints
│   │   │   ├── extension/      # Extension API endpoints
│   │   │   ├── notifications/  # Notification API endpoints
│   │   │   └── platforms/     # Platform API endpoints
│   │   ├── login/              # Login page
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # Global styles
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── app-sidebar.tsx     # Main sidebar navigation
│   │   ├── chart-area-interactive.tsx
│   │   └── ...                 # Other components
│   ├── db/
│   │   ├── schema.ts           # Database schema (campaigns, ads, platforms, etc.)
│   │   └── index.ts            # Database connection
│   ├── lib/
│   │   ├── auth.ts             # Authentication utilities
│   │   ├── config/              # Configuration
│   │   └── dal.ts               # Data access layer
│   └── types/                   # TypeScript types
├── drizzle/                     # Database migrations
├── docs/                        # Technical documentation
├── docs/                        # All documentation (see docs/README.md)
├── public/                      # Static assets
├── docker-compose.yml           # Infrastructure services
└── docs/                        # All documentation (see docs/README.md)
```

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Apply database migrations
- `pnpm db:push` - Push schema directly (dev only)
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm test` - Vitest unit tests (extension HTTP integration tests are skipped unless `EXTENSION_INTEGRATION=1`)
- `pnpm test:integration` - Extension register/login/domains/ad-block against a **running** app + DB (`EXTENSION_INTEGRATION=1` is set by the script)
- `pnpm test:extension-log` - Run test script to simulate extension requests
- `pnpm load-test:extension` - Load test extension API (10 users × 10 req/min × 10 min)

## Testing

Layout (function-based / task-based / user-flow) and commands: [tests/README.md](./tests/README.md).

`pnpm test` runs the full Vitest suite **without** requiring `next dev`. Extension flow integration specs are opt-in: the script `pnpm test:integration` exports `EXTENSION_INTEGRATION=1` and expects `.env.local` (or CI secrets) to point `BETTER_AUTH_BASE_URL` at the live stack.

### Extension API Testing

Use the included test script to simulate extension ad-block requests:

```bash
pnpm test:extension-log
```

Or run directly:

```bash
./docs/test-extension-log.sh
```

See [docs/TEST_EXTENSION_LOG.md](./docs/TEST_EXTENSION_LOG.md) for details.

The script will:
- Fetch real platforms from your database
- Call the ad-block endpoint to get ads and notifications
- Automatically log visits (no separate log calls needed)
- Display results and provide links to view in the Analytics dashboard

See [docs/TEST_EXTENSION_LOG.md](./docs/TEST_EXTENSION_LOG.md) for detailed documentation.

### Extension Load Testing

Use the load test script to simulate extension traffic at scale:

```bash
pnpm load-test:extension
```

With a custom base URL:

```bash
BASE_URL=https://your-server.com pnpm load-test:extension
```

The script simulates **10 users**, each making **10 requests per minute** for **10 minutes** (~1000 total requests) to `POST /api/extension/ad-block`. It reports progress every minute and a final summary of successes and failures.

## Architecture Notes

### Server-Only Boundaries

- Database access (`src/db/*`) is server-only
- Server config (`src/lib/config/server.ts`) is server-only
- Authentication (`src/lib/auth.ts`) is server-only
- Client components must NOT import these modules

### Environment Validation

Environment variables are validated at application startup using Zod. The application will fail fast if required variables are missing or invalid.

### Database Connection

The database connection uses a singleton pattern compatible with Next.js dev mode hot reloading. Connection pooling is configured via `DATABASE_POOL_MAX`.

### Authentication

- Better Auth handles sessions and cookies
- Secure cookies in production (HTTPS required)
- Session validation on protected routes

## Development Guidelines

- Use TypeScript strict mode
- All database access must be server-side only
- Use Server Components by default (App Router)
- Client components must be explicitly marked with `'use client'`
- Follow the established folder structure and naming conventions
- Use shadcn/ui components for consistent UI
- Follow the existing patterns for API routes and data fetching

## API Endpoints

### Admin API (Protected)
- `GET /api/campaigns` - List campaigns (`?page=&pageSize=`). Response: `{ data, page, pageSize, totalCount, totalPages }`. Non-admins only see campaigns they created.
- `POST /api/campaigns` - Create campaign (admin only)
- `GET /api/campaigns/[id]` - Get campaign
- `PUT /api/campaigns/[id]` - Update campaign (admin only)
- `DELETE /api/campaigns/[id]` - Delete campaign (admin only)
- `GET /api/platforms` - List all platforms
- `POST /api/platforms` - Create platform
- `GET /api/platforms/[id]` - Get platform
- `PUT /api/platforms/[id]` - Update platform
- `DELETE /api/platforms/[id]` - Delete platform

- `GET /api/ads` - List all ads (or filter by domain). Each row includes `linkedCampaignCount` (campaigns referencing `ad_id`).
- `POST /api/ads` - Create ad
- `GET /api/ads/[id]` - Get ad
- `PUT /api/ads/[id]` - Update ad
- `DELETE /api/ads/[id]` - Delete ad

- `GET /api/notifications` - List notifications (`?page=&pageSize=`). Response: `{ data, page, pageSize, totalCount, totalPages }`. Each item in `data` includes `linkedCampaignCount`.
- `POST /api/notifications` - Create notification
- `GET /api/notifications/[id]` - Get notification
- `PUT /api/notifications/[id]` - Update notification
- `DELETE /api/notifications/[id]` - Delete notification

- `GET /api/redirects` - List redirects. Each row includes `linkedCampaignCount`.
- `POST /api/redirects` - Create redirect
- `GET /api/redirects/[id]` - Get redirect
- `PUT /api/redirects/[id]` - Update redirect
- `DELETE /api/redirects/[id]` - Delete redirect

### Extension API (Public)
- `POST /api/extension/ad-block` - Get ads and/or notifications for domain and automatically log visit(s). Body: `{endUserId, domain, requestType?}`. Returns `{ads: [...], notifications: [...]}`.

### Authentication API (Better Auth)
- `GET/POST /api/auth/*` - Better Auth catch-all (sign-in, sign-up, sign-out, session, etc.)

See [docs/EXTENSION_AD_BLOCK_API.md](./docs/EXTENSION_AD_BLOCK_API.md) and [docs/EXTENSION_API_DOCS.md](./docs/EXTENSION_API_DOCS.md) for detailed extension API documentation.

## Continuous integration

GitHub Actions ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)) runs `pnpm lint`, `pnpm build`, and `pnpm test` on pushes and PRs to `main` and `dev`. Build and test jobs set minimal `DATABASE_URL` and `BETTER_AUTH_*` values so CI does not rely on committed secrets.

Optional dead-code pass: `pnpm dlx knip` (no Knip config in-repo; add ignores if you adopt it).

## Documentation

All documentation is in the [`docs/`](./docs/) directory. See [docs/README.md](./docs/README.md) for an overview.

Key documents:
- [Extension Ad Block API](./docs/EXTENSION_AD_BLOCK_API.md) - Complete API reference for browser extensions
- [Extension API Examples](./docs/EXTENSION_API_DOCS.md) - Code examples and usage patterns
- [Architecture](./docs/ARCHITECTURE.md) - System architecture and design patterns
- [Database Schema](./docs/DATABASE.md) - Database schema and relationships
- [Extension & Dashboard Overview](./docs/EXTENSION_AND_DASHBOARD_OVERVIEW.md) - How everything works together

## Production Deployment

- Ensure all environment variables are set in production (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_BASE_URL`)
- Use strong `BETTER_AUTH_SECRET` (minimum 32 characters)
- **Migrations run automatically** on app startup (via `instrumentation.ts`) — no manual `pnpm db:migrate` needed
- The single migration `0000_initial.sql` is idempotent and safe to run on fresh or existing databases
- Database connection handles graceful shutdown
- Use production-ready connection pooling settings
- Enable HTTPS for secure cookie transmission
- Configure CORS appropriately for extension API endpoints

## License

Private project - All rights reserved
