/**
 * Runs Drizzle migrations programmatically. Used on app startup and in Docker.
 * Does not import server-only so it can run in instrumentation and standalone.
 */
import { existsSync } from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { normalizeDatabaseUrl, postgresJsPrepareOption } from './connection-url';

export function resolveMigrationsFolder(): string {
  const envDir = process.env.DRIZZLE_MIGRATIONS_DIR;
  if (envDir) {
    const resolved = path.resolve(envDir);
    if (existsSync(resolved)) {
      return resolved;
    }
    console.warn('[migrate] DRIZZLE_MIGRATIONS_DIR is set but not found:', resolved);
  }

  const candidates = [
    path.join(process.cwd(), 'drizzle', 'migrations'),
    path.join(process.cwd(), 'admin_dashboard', 'drizzle', 'migrations'),
  ];

  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'meta', '_journal.json'))) {
      return dir;
    }
  }

  const fallback = path.join(process.cwd(), 'drizzle', 'migrations');
  if (!existsSync(fallback)) {
    console.warn(
      '[migrate] No migrations folder found. Tried:',
      candidates.join(', '),
      '- using',
      fallback
    );
  }
  return fallback;
}

async function tableExists(client: postgres.Sql, name: string): Promise<boolean> {
  const rows = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function campaignStatusEnumExists(client: postgres.Sql): Promise<boolean> {
  const rows = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = 'campaign_status'
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function campaignStatusHasDeletedLabel(client: postgres.Sql): Promise<boolean> {
  const rows = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
        AND t.typname = 'campaign_status'
        AND e.enumlabel = 'deleted'
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

/** Idempotent: `campaign_status` must include `deleted` for soft-delete (legacy DBs). */
async function addCampaignStatusDeletedIfMissing(client: postgres.Sql): Promise<void> {
  if (!(await campaignStatusEnumExists(client))) {
    return;
  }
  if (await campaignStatusHasDeletedLabel(client)) {
    return;
  }
  await client.unsafe(`
    DO $$ BEGIN
      ALTER TYPE "campaign_status" ADD VALUE 'deleted';
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log('[migrate] campaign_status enum: added value deleted (idempotent)');
}

let campaignDeletedEnumReadyPromise: Promise<void> | null = null;

/**
 * Ensures `campaign_status` includes `deleted` (soft-delete). Safe to call from API routes;
 * cheap when the enum is already up to date.
 */
export function ensureCampaignStatusDeletedEnumReady(): Promise<void> {
  campaignDeletedEnumReadyPromise ??= (async () => {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) {
      return;
    }
    const url = normalizeDatabaseUrl(rawUrl);
    const client = postgres(url, { max: 1, prepare: postgresJsPrepareOption(url) });
    try {
      await addCampaignStatusDeletedIfMissing(client);
    } finally {
      await client.end();
    }
  })().catch((err) => {
    campaignDeletedEnumReadyPromise = null;
    throw err;
  });
  return campaignDeletedEnumReadyPromise;
}

/** Warn if migrations were not applied (no bundled repair SQL in MVP). */
export async function ensureRedirectsTables(client: postgres.Sql): Promise<void> {
  if (await tableExists(client, 'redirects')) {
    return;
  }
  console.warn(
    '[migrate] Table public.redirects is missing. Run pnpm db:migrate or pnpm db:migrate:app.'
  );
}

let redirectsSchemaEnsurePromise: Promise<void> | null = null;

/**
 * Best-effort check after login that core schema exists (migrations normally run in instrumentation).
 */
export function ensureRedirectsSchemaOnce(): Promise<void> {
  if (redirectsSchemaEnsurePromise) {
    return redirectsSchemaEnsurePromise;
  }
  redirectsSchemaEnsurePromise = (async () => {
    try {
      const rawUrl = process.env.DATABASE_URL;
      if (!rawUrl) {
        return;
      }
      const url = normalizeDatabaseUrl(rawUrl);
      const client = postgres(url, { max: 1, prepare: postgresJsPrepareOption(url) });
      try {
        await ensureRedirectsTables(client);
      } finally {
        await client.end();
      }
    } catch (err) {
      redirectsSchemaEnsurePromise = null;
      throw err;
    }
  })();
  return redirectsSchemaEnsurePromise;
}

export async function runMigrations(): Promise<void> {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.warn('[migrate] DATABASE_URL not set, skipping migrations');
    return;
  }
  const url = normalizeDatabaseUrl(rawUrl);

  const migrationsFolder = resolveMigrationsFolder();
  console.log('[migrate] Using migrations folder:', migrationsFolder);

  const client = postgres(url, { max: 1, prepare: postgresJsPrepareOption(url) });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder });
    console.log('[migrate] Drizzle migrate() finished');
    await addCampaignStatusDeletedIfMissing(client);
  } finally {
    await client.end();
  }
}
