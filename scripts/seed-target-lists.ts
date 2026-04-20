/**
 * Ensure default filter-only target lists exist (idempotent).
 *
 * Creates three presets if missing: All users, Paid users, Trial users.
 * Run: `pnpm db:seed-target-lists`
 *
 * Loads `.env` / `.env.local` via {@link ../src/lib/db/load-cli-env}.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { normalizeDatabaseUrl, postgresJsPrepareOption } from '../src/lib/db/connection-url';
import { loadCliEnv } from '../src/lib/db/load-cli-env';
import { ensureDefaultTargetLists } from '../src/lib/seed-default-target-lists';

async function runSeedTargetLists(): Promise<void> {
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
    const created = await ensureDefaultTargetLists(db);
    for (const name of created) {
      console.log(`[seed-target-lists] Created: ${name}`);
    }
    if (created.length === 0) {
      console.log('[seed-target-lists] All default lists already present');
    }
    console.log('[seed-target-lists] Done');
  } finally {
    await sql.end({ timeout: 10 });
  }
}

const isSeedTargetListsCli =
  process.argv[1]?.includes('seed-target-lists') ?? false;

if (isSeedTargetListsCli) {
  if (!process.env.NODE_ENV) {
    Reflect.set(process.env, 'NODE_ENV', 'development');
  }
  runSeedTargetLists()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
