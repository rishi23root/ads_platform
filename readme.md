# Admin Dashboard

Production-grade Admin Dashboard + Backend foundation built with Next.js 16, TypeScript, Drizzle ORM, and Redis.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm
- **Database**: PostgreSQL (via Docker Compose)
- **ORM**: Drizzle ORM + Drizzle Kit
- **Cache**: Redis (via Docker Compose)
- **UI**: Tailwind CSS 4
- **Future UI**: shadcn/ui (to be initialized)

## Prerequisites

- Node.js 20+
- pnpm
- Docker and Docker Compose

## Getting Started

### 1. Start Infrastructure Services

Start PostgreSQL and Redis using Docker Compose:

```bash
docker compose up -d
```

### 2. Environment Setup

Copy `.env.example` to `.env.local` and configure the required variables:

```bash
cp .env.example .env.local
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `NODE_ENV` - Environment mode (development/production)

Optional variables:
- `DATABASE_POOL_MAX` - Database connection pool size (default: 10)
- `REDIS_TTL_DEFAULT` - Default Redis TTL in seconds (default: 3600)

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

## Project Structure

```
admin_dashboard/
├── src/
│   ├── app/              # Next.js App Router pages and layouts
│   ├── components/       # React components (future)
│   │   └── ui/          # shadcn/ui components (future)
│   ├── db/              # Database layer
│   │   ├── index.ts     # Database connection
│   │   ├── schema/      # Drizzle schema definitions
│   │   └── utils.ts     # Database utilities
│   ├── lib/             # Shared libraries
│   │   ├── config/      # Configuration files
│   │   ├── redis.ts     # Redis client
│   │   └── utils.ts     # General utilities
│   └── types/           # TypeScript type definitions
├── drizzle/             # Drizzle migrations
│   └── migrations/      # Generated migration files
├── public/              # Static assets
└── docker-compose.yml   # Infrastructure services
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

## Architecture Notes

### Server-Only Boundaries

- Database access (`src/db/*`) is server-only
- Redis access (`src/lib/redis.ts`) is server-only
- Server config (`src/lib/config/server.ts`) is server-only
- Client components must NOT import these modules

### Environment Validation

Environment variables are validated at application startup using Zod. The application will fail fast if required variables are missing or invalid.

### Database Connection

The database connection uses a singleton pattern compatible with Next.js dev mode hot reloading. Connection pooling is configured via `DATABASE_POOL_MAX`.

### Redis Connection

Redis client uses a singleton pattern with automatic reconnection handling. The client is lazy-initialized on first use.

## Development Guidelines

- Use TypeScript strict mode
- All database access must be server-side only
- Use Server Components by default (App Router)
- Client components must be explicitly marked with `'use client'`
- Follow the established folder structure and naming conventions

## Production Deployment

- Ensure all environment variables are set in production
- Run migrations before deploying: `pnpm db:migrate`
- Database and Redis connections handle graceful shutdown
- Use production-ready connection pooling settings
