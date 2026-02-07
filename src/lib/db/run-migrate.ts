/**
 * Runs Drizzle migrations programmatically. Used on app startup and in Docker.
 * Does not import server-only so it can run in instrumentation and standalone.
 */
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[migrate] DATABASE_URL not set, skipping migrations');
    return;
  }

  const migrationsFolder =
    process.env.DRIZZLE_MIGRATIONS_DIR ??
    path.join(process.cwd(), 'drizzle', 'migrations');

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder });
    console.log('[migrate] Migrations completed');
  } finally {
    await client.end();
  }
}
