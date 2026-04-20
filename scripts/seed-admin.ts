/**
 * Create the first dashboard admin when the auth `user` table is empty.
 *
 * Run only via: `pnpm db:seed-admin` (or `npm run db:seed-admin`).
 * Loads `.env` / `.env.local` via {@link ../src/lib/db/load-cli-env}.
 *
 * Override credentials with ADMIN_EMAIL / ADMIN_PASSWORD in `.env.local`.
 *
 * Also ensures default target lists (All users, Paid users, Trial users) exist;
 * this step is idempotent and runs even when an admin already exists.
 *
 * This script uses its own Postgres connection and {@link ../src/lib/better-auth-factory}
 * so it never imports `server-only` modules (`@/db`, `@/lib/auth`).
 */
import { count } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { user } from '../src/db/schema';
import { createBetterAuth } from '../src/lib/better-auth-factory';
import { normalizeDatabaseUrl, postgresJsPrepareOption } from '../src/lib/db/connection-url';
import { loadCliEnv } from '../src/lib/db/load-cli-env';
import { ensureDefaultTargetLists } from '../src/lib/seed-default-target-lists';

const DEFAULT_ADMIN_EMAIL = 'admin@admin.com';
const DEFAULT_ADMIN_PASSWORD = 'admin@admin.com';

async function runSeedAdmin(): Promise<void> {
  loadCliEnv({ verbose: true });

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required');
  }

  const sql = postgres(normalizeDatabaseUrl(DATABASE_URL), {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: postgresJsPrepareOption(DATABASE_URL),
  });

  try {
    const db = drizzle(sql, { schema });

    const listsCreated = await ensureDefaultTargetLists(db);
    for (const name of listsCreated) {
      console.log(`[seed-admin] Default target list created: ${name}`);
    }
    if (listsCreated.length === 0) {
      console.log('[seed-admin] Default target lists already present');
    }

    const [row] = await db.select({ n: count() }).from(user);
    if (row && row.n > 0) {
      console.log('[seed-admin] Users already exist; nothing to do');
      return;
    }

    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('BETTER_AUTH_SECRET must be at least 32 characters (required to create the first admin)');
    }

    const email = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

    console.log('[seed-admin] No users yet; creating initial admin');
    console.log('[seed-admin] ADMIN_EMAIL', email);

    const auth = createBetterAuth({
      db,
      secret,
      baseURL: process.env.BETTER_AUTH_BASE_URL ?? process.env.BETTER_AUTH_URL,
    });

    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: 'Admin',
      },
    });

    if ('error' in result && result.error) {
      const err = result.error as { message?: string };
      throw new Error(err.message ?? String(err));
    }

    if ('user' in result && result.user) {
      console.log(`[seed-admin] Admin user created: ${email}`);
    }
  } finally {
    await sql.end({ timeout: 10 });
  }
}

const isSeedAdminCli =
  process.argv[1]?.includes('seed-admin') ?? false;

if (isSeedAdminCli) {
  if (!process.env.NODE_ENV) {
    Reflect.set(process.env, 'NODE_ENV', 'development');
  }
  runSeedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
