/**
 * Ensures database URL is suitable for the target (e.g. Supabase requires SSL).
 * Safe to call with any URL; only modifies Supabase hosts and when sslmode is not set.
 */
export function normalizeDatabaseUrl(url: string): string {
  if (!url || typeof url !== 'string') return url;
  const isSupabase = url.includes('supabase.co');
  const hasSslMode = /[?&]sslmode=/i.test(url);
  if (isSupabase && !hasSslMode) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sslmode=require`;
  }
  return url;
}
