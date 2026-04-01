import 'server-only';

/** Coerce DB time / campaign schedule scalars for JSON and qualify rules. */
export function formatExtensionCampaignScalar(t: unknown): string | null {
  if (t == null) return null;
  return String(t);
}
