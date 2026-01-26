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

### 4. JWT Authentication
- **Decision**: JWT tokens in HTTP-only cookies
- **Rationale**: Stateless, secure, scalable
- **Implementation**: Jose library, 7-day sessions

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
- **Public Routes**: No authentication required
- **Domain Filtering**: Query parameter-based filtering
- **Logging**: Automatic request logging for analytics

### Data Flow

#### Admin Creates Ad
1. Admin fills form (Client Component)
2. Form submits to `/api/ads` (POST)
3. API validates and inserts into database
4. Response returns to client
5. Client redirects or updates UI

#### Extension Fetches Ad
1. Extension calls `/api/ads?domain=example.com`
2. API queries database for active ads
3. API logs request to `request_logs` table
4. API returns JSON response
5. Extension displays content

## API Structure

### Admin API (Protected)
- `/api/platforms` - Platform CRUD
- `/api/ads` - Ad CRUD
- `/api/notifications` - Notification CRUD
- `/api/auth/login` - Authentication
- `/api/auth/logout` - Session termination

### Extension API (Public)
- `/api/ads?domain={domain}` - Get active ads
- `/api/notifications?domain={domain}` - Get active notifications
- `/api/extension/log` - Log request (analytics)

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
- **Extension Users → Request Logs**: One-to-many (visitor_id)

### Query Patterns
- Use Drizzle query builder
- Type-safe joins and filters
- Efficient queries with proper indexes

## Security Patterns

### Authentication
- JWT tokens in HTTP-only cookies
- Secure flag in production
- Session expiration validation
- Protected route middleware

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
- Redis for session data
- Database connection pooling
- Efficient queries with proper joins

### Optimization
- Server components for data fetching
- Static generation where possible
- Efficient database queries
- Lazy loading for charts
