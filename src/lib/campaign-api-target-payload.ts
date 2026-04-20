/**
 * When a campaign uses a target list, audience must be `all_users` (lists carry their own rules).
 * Aligns API with the dashboard form and {@link filterQualifyingExtensionCampaigns} semantics.
 */
export function resolveCampaignTargetAudienceForInsert(
  targetAudience: unknown,
  hasTargetList: boolean
): 'new_users' | 'all_users' {
  if (hasTargetList) return 'all_users';
  return targetAudience === 'new_users' ? 'new_users' : 'all_users';
}

/** PUT: when a list is attached, audience must be `all_users`; omit return when field unchanged. */
export function resolveCampaignTargetAudienceForUpdate(
  existingTargetListId: string | null,
  nextTargetListId: string | null | undefined,
  targetAudienceFromBody: unknown
): 'new_users' | 'all_users' | undefined {
  const effectiveListId =
    nextTargetListId !== undefined ? nextTargetListId : existingTargetListId;
  if (effectiveListId) return 'all_users';
  if (targetAudienceFromBody === undefined) return undefined;
  return targetAudienceFromBody === 'new_users' ? 'new_users' : 'all_users';
}
