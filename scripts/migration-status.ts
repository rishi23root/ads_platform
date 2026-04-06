/**
 * Shows which DB `DATABASE_URL` points at and what Drizzle has recorded vs public tables.
 * Usage: pnpm db:migration-status
 */
import { loadCliEnv } from '../src/lib/db/load-cli-env';
import { normalizeDatabaseUrl, postgresJsPrepareOption } from '../src/lib/db/connection-url';
import postgres from 'postgres';

async function main(): Promise<void> {
  loadCliEnv({ verbose: true });

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.error('\nDATABASE_URL is missing. Add it to .env or .env.local in:', process.cwd());
    process.exit(1);
  }

  const url = normalizeDatabaseUrl(rawUrl);
  let host = '';
  let dbName = '';
  try {
    const u = new URL(url);
    host = u.hostname + (u.port ? `:${u.port}` : '');
    dbName = u.pathname.replace(/^\//, '') || '(unknown)';
  } catch {
    host = '(could not parse URL)';
  }

  console.log('\n--- Migration status ---');
  console.log('Host:', host);
  console.log('Database name:', dbName);
  console.log('DATABASE_URL set: yes (password hidden)\n');

  const sql = postgres(url, { max: 1, prepare: postgresJsPrepareOption(url) });

  try {
    let applied: { id: number; hash: string; created_at: string | bigint }[] = [];
    try {
      applied = await sql`
        SELECT id, hash, created_at
        FROM drizzle.__drizzle_migrations
        ORDER BY created_at
      `;
    } catch {
      console.log(
        'drizzle.__drizzle_migrations: not readable (drizzle schema missing or empty). Run: pnpm db:migrate\n'
      );
    }

    if (applied.length > 0) {
      console.log(`drizzle.__drizzle_migrations: ${applied.length} row(s)`);
      for (const row of applied) {
        console.log(`  id=${row.id} hash=${String(row.hash).slice(0, 12)}…`);
      }
      console.log('');
    }

    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('end_users', 'enduser_sessions', 'enduser_events', 'user', 'campaigns')
      ORDER BY table_name
    `;
    const names = new Set(tables.map((t) => t.table_name));
    console.log('Core tables present:');
    for (const want of ['end_users', 'enduser_sessions', 'enduser_events', 'user', 'campaigns']) {
      console.log(`  ${want}: ${names.has(want) ? 'yes' : 'NO'}`);
    }

    if (names.has('enduser_events')) {
      const cols = await sql<{ column_name: string }[]>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'enduser_events'
        ORDER BY ordinal_position
      `;
      const hasUserIdent = cols.some((c) => c.column_name === 'user_identifier');
      const hasLegacy = cols.some((c) => c.column_name === 'enduser_id');
      console.log('\nenduser_events columns:');
      console.log(`  user_identifier: ${hasUserIdent ? 'yes' : 'NO'}`);
      console.log(`  enduser_id (legacy): ${hasLegacy ? 'yes' : 'no'}`);
    }

    console.log(
      '\nTip: If this shows migrations but tables are NO, you migrated a different database than',
      'the app uses. Use the same DATABASE_URL for `pnpm dev` and `pnpm db:migrate`.'
    );
  } catch (e) {
    const err = e as Error;
    console.error('\nQuery failed:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
