import { describe, it, expect } from 'vitest';
import {
  resolveCampaignTargetAudienceForInsert,
  resolveCampaignTargetAudienceForUpdate,
} from '@/lib/campaign-api-target-payload';

describe('campaign-api-target-payload', () => {
  it('insert: list forces all_users', () => {
    expect(resolveCampaignTargetAudienceForInsert('new_users', true)).toBe('all_users');
    expect(resolveCampaignTargetAudienceForInsert(undefined, true)).toBe('all_users');
  });

  it('insert: no list respects new_users', () => {
    expect(resolveCampaignTargetAudienceForInsert('new_users', false)).toBe('new_users');
    expect(resolveCampaignTargetAudienceForInsert(undefined, false)).toBe('all_users');
  });

  it('update: effective list forces all_users', () => {
    expect(resolveCampaignTargetAudienceForUpdate('L1', undefined, 'new_users')).toBe('all_users');
    expect(resolveCampaignTargetAudienceForUpdate(null, 'L1', undefined)).toBe('all_users');
  });

  it('update: no list uses body or omits', () => {
    expect(resolveCampaignTargetAudienceForUpdate(null, null, 'new_users')).toBe('new_users');
    expect(resolveCampaignTargetAudienceForUpdate(null, undefined, undefined)).toBeUndefined();
  });
});
