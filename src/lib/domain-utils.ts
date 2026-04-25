/**
 * Normalize domain for storage/display: extract hostname from URL if needed.
 */
export function normalizeDomain(domain: string): string {
  const trimmed = domain.trim();
  if (!trimmed) return trimmed;

  try {
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    return new URL(url).hostname;
  } catch {
    return trimmed;
  }
}

/**
 * Normalize domain for matching (lowercase, hostname only).
 */
export function normalizeDomainForMatch(domain: string): string {
  const trimmed = domain.trim().toLowerCase();
  try {
    const url = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    return new URL(url).hostname;
  } catch {
    return trimmed;
  }
}

/**
 * Normalize `sourceDomain` for redirect storage / regex: hostname only; strip `www.`
 * when `includeSubdomains` is true so the pattern anchors to the root (e.g. `ndtv.com`
 * instead of `www.ndtv.com`).
 */
export function normalizeDomainForRedirectStorage(
  sourceDomain: string,
  includeSubdomains: boolean
): string {
  const host = normalizeDomainForMatch(sourceDomain);
  return includeSubdomains && host.startsWith('www.') ? host.slice(4) : host;
}

/**
 * Get canonical display form (strip www. prefix for cleaner display).
 */
export function getCanonicalDisplayDomain(hostname: string): string {
  const h = hostname.trim().toLowerCase();
  if (h.startsWith('www.')) {
    return h.slice(4);
  }
  return h;
}

/**
 * Extract root domain (e.g. example.com from sub.example.com).
 */
export function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

/**
 * Check if two domains match (exact or same root domain).
 */
export function domainsMatch(domain1: string, domain2: string): boolean {
  const host1 = normalizeDomainForMatch(domain1);
  const host2 = normalizeDomainForMatch(domain2);
  if (host1 === host2) return true;
  const root1 = extractRootDomain(host1);
  const root2 = extractRootDomain(host2);
  return root1 === root2 && root1.length > 0;
}

/**
 * Whether a visited host matches a redirect rule's source domain.
 */
export function redirectSourceMatchesVisit(
  visitDomain: string,
  sourceDomain: string,
  includeSubdomains: boolean
): boolean {
  const host = normalizeDomainForMatch(visitDomain);
  let source = normalizeDomainForMatch(sourceDomain);
  if (includeSubdomains && source.startsWith('www.')) {
    source = source.slice(4);
  }
  if (host === source) return true;
  if (!includeSubdomains) return false;
  return host.endsWith(`.${source}`);
}

/** Escape a string for use inside a `RegExp` pattern. */
export function escapeRegExpChars(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Hostname-oriented pattern aligned with {@link redirectSourceMatchesVisit}: match normalized
 * visit hostnames with `new RegExp(pattern, 'i')` (case-insensitive ASCII host).
 *
 * - `includeSubdomains: false` → exact host only.
 * - `includeSubdomains: true` → host is either exactly `source` or `*.source` (one or more labels).
 */
export function redirectSourceToHostnameRegex(
  sourceDomain: string,
  includeSubdomains: boolean
): string {
  let source = normalizeDomainForMatch(sourceDomain);
  if (includeSubdomains && source.startsWith('www.')) {
    source = source.slice(4);
  }
  const esc = escapeRegExpChars(source);
  if (!includeSubdomains) return `^${esc}$`;
  return `^(?:.+\\.)?${esc}$`;
}

/** Platform ids whose stored domain matches `normalizedVisitDomain` (from {@link normalizeDomainForMatch}). */
export function platformIdSetForNormalizedDomain(
  normalizedVisitDomain: string,
  platformRows: { id: string; domain: string | null }[]
): Set<string> {
  const out = new Set<string>();
  if (!normalizedVisitDomain) return out;
  for (const p of platformRows) {
    const d = (p.domain ?? '').trim();
    if (d && domainsMatch(normalizedVisitDomain, d)) {
      out.add(p.id);
    }
  }
  return out;
}
