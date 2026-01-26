# Technical Context

## Technologies Used

### Core Framework
- **Next.js 16**: React framework with App Router
- **React 19**: UI library
- **TypeScript**: Type-safe JavaScript with strict mode

### Database & ORM
- **PostgreSQL**: Primary database
- **Drizzle ORM**: Type-safe ORM for database operations
- **Drizzle Kit**: Migration and schema management tools

### Caching
- **Redis**: In-memory data store for caching

### UI & Styling
- **Tailwind CSS 4**: Utility-first CSS framework
- **shadcn/ui**: High-quality React components built on Radix UI
- **Tabler Icons**: Icon library
- **Recharts**: Chart library for analytics

### Authentication
- **Jose**: JWT implementation for authentication
- **HTTP-only Cookies**: Secure session storage

### Development Tools
- **pnpm**: Fast, disk space efficient package manager
- **ESLint**: Code linting
- **Docker Compose**: Infrastructure orchestration

## Development Setup

### Prerequisites
- Node.js 20+
- pnpm installed globally
- Docker and Docker Compose
- PostgreSQL and Redis (via Docker)

### Environment Configuration
All configuration via environment variables in `.env.local`:
- Database connection string
- Redis connection string
- Admin credentials
- JWT secret
- Optional pool/TTL settings

### Project Structure
```
src/
├── app/              # Next.js App Router (pages, layouts, API routes)
├── components/       # React components
├── db/              # Database layer (schema, connection)
├── lib/             # Shared utilities (auth, config, redis)
└── types/           # TypeScript type definitions
```

## Dependencies Overview

### Production Dependencies
- **Next.js ecosystem**: Framework, routing, server components
- **Database**: Drizzle ORM, postgres driver
- **UI**: Radix UI primitives, shadcn/ui, Tailwind
- **Charts**: Recharts for analytics visualization
- **Auth**: Jose for JWT handling
- **Icons**: Tabler Icons
- **Utilities**: clsx, tailwind-merge, zod (validation)

### Development Dependencies
- **TypeScript**: Type checking
- **ESLint**: Code quality
- **Tailwind**: CSS processing
- **Type definitions**: Node, React types

## Tool Usage Patterns

### Database
- **Schema Definition**: Drizzle schema files in `src/db/schema/`
- **Migrations**: Generated with `pnpm db:generate`
- **Migration Application**: `pnpm db:migrate`
- **Development**: `pnpm db:push` for quick schema updates
- **Studio**: `pnpm db:studio` for database inspection

### Development Workflow
1. Start infrastructure: `docker compose up -d`
2. Install dependencies: `pnpm install`
3. Run migrations: `pnpm db:migrate`
4. Start dev server: `pnpm dev`
5. Test extension API: `pnpm test:extension-log`

### Code Organization
- **Server Components**: Default (no 'use client' needed)
- **Client Components**: Explicitly marked with 'use client'
- **API Routes**: Next.js route handlers in `app/api/`
- **Server-only Code**: Marked with 'server-only' import
- **Type Safety**: Strict TypeScript, inferred types from schemas

## Technical Constraints

### Server-Only Boundaries
- Database access must be server-side only
- Redis access must be server-side only
- Authentication logic server-side only
- Client components cannot import server-only modules

### Environment Requirements
- All environment variables validated at startup
- Application fails fast if required vars missing
- Zod schema validation for type safety

### Database Patterns
- Singleton pattern for database connection (Next.js hot reload compatible)
- Connection pooling configured via environment
- Graceful shutdown handling

### Redis Patterns
- Singleton pattern for Redis client
- Lazy initialization
- Automatic reconnection handling

## Build & Deployment

### Development
- Hot reload enabled
- Type checking in watch mode
- Fast refresh for React components

### Production
- Static optimization where possible
- Server-side rendering for admin pages
- API routes for dynamic content
- Environment variable validation
- Migration execution before deployment

## Testing

### Test Scripts
- `test-extension-log.sh`: Simulates extension API requests
- Uses real database data
- Creates test log entries
- Verifies API functionality

### Manual Testing
- Admin authentication flow
- CRUD operations for all entities
- Extension API endpoints
- Analytics dashboard
