# Admin Dashboard - Ad Replacement Platform

Production-grade Admin Dashboard for managing advertisements and notifications for a browser extension. Built with Next.js 16, TypeScript, Drizzle ORM, and PostgreSQL.

## Overview

This admin dashboard provides a complete solution for managing:
- **Platforms**: Configure domains where ads and notifications will be displayed
- **Ads**: Create, manage, and schedule advertisements with images and target URLs
- **Notifications**: Create time-bound notifications for specific platforms
- **Analytics**: Track extension user activity and request logs
- **Extension API**: RESTful API endpoints for browser extensions to fetch ads and notifications

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Package Manager**: pnpm
- **Database**: PostgreSQL (via Docker Compose)
- **ORM**: Drizzle ORM + Drizzle Kit
- **UI**: Tailwind CSS 4 + shadcn/ui components
- **Authentication**: JWT-based session management
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
POSTGRES_DB=ads_platform
POSTGRES_USER=ads_admin
POSTGRES_PASSWORD=your_password

# Application
NODE_ENV=development

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters

# Optional
DATABASE_POOL_MAX=10
```

**Required environment variables:**
- `DATABASE_URL` - PostgreSQL connection string
- `NODE_ENV` - Environment mode (development/production)
- `ADMIN_USERNAME` - Admin login username
- `ADMIN_PASSWORD` - Admin login password
- `JWT_SECRET` - Secret key for JWT tokens (minimum 32 characters)

**Optional variables:**
- `DATABASE_POOL_MAX` - Database connection pool size (default: 10)

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

## Authentication

The dashboard uses JWT-based authentication with secure HTTP-only cookies.

- **Login**: Navigate to `/login` and use your `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- **Session**: Sessions last 7 days
- **Protected Routes**: All dashboard routes under `/(protected)` require authentication
- **Logout**: Available from the user menu in the sidebar

## Features

### Dashboard
- Overview statistics (ads, platforms, notifications, extension users)
- Interactive charts for analytics
- Recent ads table with quick actions

### Platform Management
- Create, edit, and delete platforms
- Configure domain names for ad targeting
- Activate/deactivate platforms

### Ad Management
- Full CRUD operations for advertisements
- Image and target URL configuration
- Status management (active, inactive, scheduled, expired)
- Date range scheduling (start/end dates)
- Automatic expiration when end date passes
- Platform association

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
│   │   ├── dashboard-ads-table.tsx
│   │   ├── chart-area-interactive.tsx
│   │   └── ...                 # Other components
│   ├── db/
│   │   ├── schema/             # Database schemas
│   │   │   ├── ads.ts
│   │   │   ├── extension-users.ts
│   │   │   ├── notifications.ts
│   │   │   ├── platforms.ts
│   │   │   └── request-logs.ts
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
- `pnpm test:extension-log` - Run test script to simulate extension requests

## Testing

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

- JWT tokens stored in HTTP-only cookies
- 7-day session expiration
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
- `GET /api/platforms` - List all platforms
- `POST /api/platforms` - Create platform
- `GET /api/platforms/[id]` - Get platform
- `PUT /api/platforms/[id]` - Update platform
- `DELETE /api/platforms/[id]` - Delete platform

- `GET /api/ads` - List all ads (or filter by domain)
- `POST /api/ads` - Create ad
- `GET /api/ads/[id]` - Get ad
- `PUT /api/ads/[id]` - Update ad
- `DELETE /api/ads/[id]` - Delete ad

- `GET /api/notifications` - List all notifications (or filter by domain)
- `POST /api/notifications` - Create notification
- `GET /api/notifications/[id]` - Get notification
- `PUT /api/notifications/[id]` - Update notification
- `DELETE /api/notifications/[id]` - Delete notification

### Extension API (Public)
- `POST /api/extension/ad-block` - Get ads and/or notifications for domain and automatically log visit(s). Body: `{visitorId, domain, requestType?}`. Returns `{ads: [...], notifications: [...]}`.

### Authentication API
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout

See [docs/EXTENSION_AD_BLOCK_API.md](./docs/EXTENSION_AD_BLOCK_API.md) and [docs/EXTENSION_API_DOCS.md](./docs/EXTENSION_API_DOCS.md) for detailed extension API documentation.

## Documentation

All documentation is in the [`docs/`](./docs/) directory. See [docs/README.md](./docs/README.md) for an overview.

Key documents:
- [Extension Ad Block API](./docs/EXTENSION_AD_BLOCK_API.md) - Complete API reference for browser extensions
- [Extension API Examples](./docs/EXTENSION_API_DOCS.md) - Code examples and usage patterns
- [Architecture](./docs/ARCHITECTURE.md) - System architecture and design patterns
- [Database Schema](./docs/DATABASE.md) - Database schema and relationships
- [Extension & Dashboard Overview](./docs/EXTENSION_AND_DASHBOARD_OVERVIEW.md) - How everything works together

## Production Deployment

- Ensure all environment variables are set in production
- Use strong `JWT_SECRET` (minimum 32 characters)
- Use secure `ADMIN_PASSWORD`
- Run migrations before deploying: `pnpm db:migrate`
- Database connection handles graceful shutdown
- Use production-ready connection pooling settings
- Enable HTTPS for secure cookie transmission
- Configure CORS appropriately for extension API endpoints

## License

Private project - All rights reserved
