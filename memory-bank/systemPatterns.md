# System Patterns

## System Architecture

### High-Level Architecture
```
┌─────────────────┐
│ Browser Extension│
└────────┬─────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Extension API  │────▶│   PostgreSQL    │
│  (Public Routes)│     │    Database     │
└─────────────────┘     └─────────────────┘
                                ▲
                                │
┌─────────────────┐             │
│  Admin Dashboard│─────────────┘
│  (Protected)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Admin API      │────▶┌─────────────────┐
│  (Protected)    │     │      Redis      │
└─────────────────┘     │      Cache       │
                         └─────────────────┘
```

### Layer Separation
1. **Client Layer**: Browser extension, Admin UI
2. **API Layer**: Extension API, Admin API, Auth API
3. **Data Layer**: PostgreSQL (primary), Redis (cache)

## Key Technical Decisions

### 1. Next.js App Router
- **Decision**: Use App Router instead of Pages Router
- **Rationale**: Modern React patterns, better server components, improved routing
- **Impact**: Server components by default, better performance

### 2. Server-Only Boundaries
- **Decision**: Strict separation of server and client code
- **Rationale**: Security, performance, type safety
- **Implementation**: 'server-only' imports, explicit 'use client' markers

### 3. Drizzle ORM
- **Decision**: Use Drizzle instead of Prisma or raw SQL
- **Rationale**: Type-safe, lightweight, good TypeScript support
- **Impact**: Schema-driven types, type-safe queries

### 4. Authentication (staff + extension)
- **Decision**: **Better Auth** for dashboard staff (email/password, session cookies via `/api/auth`). Extension **end users** use **Bearer tokens** stored in `enduser_sessions` (see `src/lib/enduser-auth.ts`); `serve`, `live`, `events`, and `auth` routes validate `Authorization: Bearer …` where required.
- **Rationale**: Clear split between internal admins and anonymous/provisioned extension customers; Better Auth owns staff sessions and plugins (e.g. admin roles).
- **Implementation**: `better-auth` + Drizzle adapter; `bcryptjs` for end-user passwords; session lifetime configurable (`freshAge` in `src/lib/auth.ts`, end-user session days via `ENDUSER_SESSION_DAYS`). Cryptographic helpers used by Better Auth may pull `jose` transitively—no separate JWT stack in app code for staff.

### 5. Singleton Patterns
- **Decision**: Singleton for DB and Redis connections
- **Rationale**: Connection pooling, Next.js hot reload compatibility
- **Impact**: Efficient resource usage, dev-friendly

### 6. Auto-Expiration
- **Decision**: Automatic ad expiration based on end date
- **Rationale**: Reduces manual work, ensures accuracy
- **Implementation**: Server-side check on dashboard load

## Design Patterns

### Database Access Pattern
```typescript
// Singleton pattern with Next.js compatibility
let db: ReturnType<typeof drizzle> | null = null;

function getDatabase() {
  if (db) return db;
  // Initialize connection
  return db;
}
```

### Authentication Pattern
```typescript
// Server-side session verification
export async function verifySession() {
  const session = await getSession();
  if (!session) return null;
  // Validate expiration
  return session;
}
```

### API Route Pattern
```typescript
// Consistent error handling
export async function GET(request: NextRequest) {
  try {
    // Business logic
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Message' }, { status: 500 });
  }
}
```

### Component Pattern
```typescript
// Server Component (default)
export default async function Page() {
  const data = await fetchData();
  return <ClientComponent data={data} />;
}

// Client Component (explicit)
'use client';
export function ClientComponent({ data }) {
  // Interactive logic
}
```

## Component Relationships

### Admin Dashboard
- **Layout**: Protected layout with sidebar and header
- **Pages**: Dashboard, Platforms, Ads, Notifications, Analytics
- **Components**: Reusable UI components, forms, tables
- **API Routes**: CRUD operations for each entity

### Extension API
- **Routes** (under `/api/extension/`): `auth/register`, `auth/login`, `auth/logout`, `auth/me`, `live` (SSE), `serve`, `events` (Bearer required where enforced)
- **Campaign qualification** (schedule, audience, frequency, geo, target lists): shared helpers in `src/lib/extension-campaign-qualify.ts`, consumed by serve and live paths (not a separate HTTP surface).
- **Auth**: Registration/login returns a token; clients send `Authorization: Bearer <token>` for protected extension handlers
- **Redis**: Used for realtime fan-out and optional lease bookkeeping on `GET /api/extension/live` when `REDIS_URL` is set

### Data Flow

#### Admin Creates Ad
1. Admin fills form (Client Component)
2. Form submits to `/api/ads` (POST)
3. API validates and inserts into database
4. Response returns to client
5. Client redirects or updates UI

#### Extension fetches placements

1. Extension authenticates (`/api/extension/auth/login` or register) and receives Bearer token
2. Extension opens `GET /api/extension/live` (SSE) for `init` (`user`, `domains`, `redirects`) and incremental updates
3. For supported hosts, extension calls `POST /api/extension/serve` with `{ domain }` (optional `type`) for creatives; reports visits, redirects, and notification milestones via `POST /api/extension/events`
4. Server writes matching rows in `enduser_events` for analytics where applicable

## API Structure

### Admin API (Protected)
- `/api/platforms`, `/api/ads`, `/api/notifications`, `/api/campaigns`, `/api/end-users`, etc. — CRUD + exports (session required)
- `/api/auth/[...all]` — Better Auth handler (sign-in, sign-out, session)

### Extension API (end-user)
- `/api/extension/auth/*` - Register, login, logout, session (`me`)
- `GET /api/extension/live` (SSE) - First event `init`: `{ user, domains, redirects }`. Follow-ups: `platforms_updated { domains }`, `redirects_updated { type, redirects }`, `ads_updated`, `notifications_updated`, `campaign_updated`.
- `POST /api/extension/serve` - Per-domain creatives: inline ads, popups, notifications (Bearer). JSON body: `domain` and optional `type` only (strict). Real UA on `User-Agent` header, not in JSON. Response `{ ads, popups, notifications }` (arrays per kind). Inserts `ad` / `popup` / `notification` rows in `enduser_events` for each creative returned.
- `POST /api/extension/events` - Batch event reporting: `visit`, `redirect`, `notification` (Bearer, max 100 items).
- ~~`/api/extension/domains`~~ - **Removed.** Use `init.domains` from SSE.
- ~~`POST /api/extension/ad-block`~~ - **Removed.** Use v2 endpoints above.

### Response Patterns
- **Success**: 200/201 with JSON data
- **Error**: 400/404/500 with error message
- **Validation**: Zod schemas for type safety

## Database Patterns

### Schema Organization
- One file per entity in `src/db/schema/`
- Exported from `index.ts` for convenience
- Type inference from schemas

### Relationships
- **Platforms → Ads**: One-to-many (platform_id FK)
- **Platforms ↔ Notifications**: Many-to-many (notification_platforms join table)
- **Extension end users → event log**: One-to-many (`enduser_id` on `enduser_events`)

### Query Patterns
- Use Drizzle query builder
- Type-safe joins and filters
- Efficient queries with proper indexes

## Security Patterns

### Authentication
- **Staff**: Better Auth session cookies; `src/app/(protected)/layout.tsx` redirects unauthenticated users
- **Extension users**: Opaque Bearer token + DB session row; banned users rejected in resolver
- Secure cookies / HTTPS in production (hosting-dependent)
- Next.js **proxy** (`src/proxy.ts`) sets baseline security headers (not Express middleware)

### Data Validation
- Zod schemas for environment variables
- Input validation in API routes
- Type-safe database queries

### Error Handling
- Consistent error responses
- No sensitive data in error messages
- Proper HTTP status codes

## Performance Patterns

### Caching Strategy
- Redis for realtime connection counts / optional rate limits (not primary session store for Better Auth)
- Database connection pooling
- Efficient queries with proper joins

### Optimization
- Server components for data fetching
- Static generation where possible
- Efficient database queries
- Lazy loading for charts
