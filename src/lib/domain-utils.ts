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
