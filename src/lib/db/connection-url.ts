/**
 * Ensures database URL is suitable for the target (e.g. Supabase requires SSL).
 * Safe to call with any URL; only modifies Supabase hosts and when sslmode is not set.
 *
 * Supavisor transaction pooler (hostname `*.pooler.supabase.com` or port 6543) often
 * leaves `search_path` at `pg_catalog` only, so unqualified names in migrations fail.
 * Sets libpq `options=-c search_path=public` when missing.
 */
export function normalizeDatabaseUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  const isSupabase = url.includes('supabase.co');
  let result = url;
  const hasSslMode = /[?&]sslmode=/i.test(result);
  if (isSupabase && !hasSslMode) {
    const separator = result.includes('?') ? '&' : '?';
    result = `${result}${separator}sslmode=require`;
  }

  if (!isSupabase) {
    return result;
  }

  try {
    const u = new URL(result);
    const host = u.hostname;
    const port = u.port;
    const isPooler =
      host.includes('pooler.supabase.com') || (host.includes('supabase.co') && port === '6543');
    if (isPooler) {
      const existing = u.searchParams.get('options') || '';
      if (!/search_path/i.test(existing)) {
        const addition = '-c search_path=public';
        u.searchParams.set('options', existing.trim() ? `${existing.trim()} ${addition}` : addition);
      }
      result = u.toString();
    }
  } catch {
    /* keep string-built result */
  }

  return result;
}

/**
 * Value for postgres.js `prepare` (named server-side prepared statements).
 * PgBouncer transaction mode (e.g. Supabase `*.pooler.supabase.com`, port 6543) cannot
 * use them; return false so drivers use simple query protocol.
 *
 * Override: `DATABASE_PREPARE_STATEMENTS=true|false` (or `1`/`0`).
 */
export function postgresJsPrepareOption(connectionString: string): boolean {
  const v = process.env.DATABASE_PREPARE_STATEMENTS?.toLowerCase();
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  try {
    const u = new URL(normalizeDatabaseUrl(connectionString));
    if (u.hostname.includes('pooler.supabase.com')) return false;
    if (u.hostname.includes('supabase.co') && u.port === '6543') return false;
  } catch {
    /* ignore */
  }
  return true;
}
