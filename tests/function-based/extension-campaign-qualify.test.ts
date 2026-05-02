import { describe, it, expect } from 'vitest';
import {
  currentLocalMinutesSinceMidnight,
  filterQualifyingExtensionCampaigns,
  isCampaignScheduleActive,
  isExtensionUserNew,
  parseCampaignTimeToMinutes,
  type ExtensionCampaignRuleFields,
  type ExtensionCampaignQualifyContext,
} from '@/lib/extension-campaign-qualify';

function baseCampaign(overrides: Partial<ExtensionCampaignRuleFields> = {}): ExtensionCampaignRuleFields {
  return {
    id: 'camp-1',
    targetAudience: 'all_users',
    frequencyType: 'always',
    frequencyCount: null,
    timeStart: null,
    timeEnd: null,
    status: 'active',
    startDate: null,
    endDate: null,
    countryCodes: [],
    targetListId: null,
    ...overrides,
  };
}

function baseCtx(overrides: Partial<ExtensionCampaignQualifyContext> = {}): ExtensionCampaignQualifyContext {
  const now = new Date('2026-03-20T12:00:00.000Z');
  return {
    now,
    currentMinutes: currentLocalMinutesSinceMidnight(now),
    isNewUser: true,
    endUserGeoCountry: null,
    viewCountByCampaignId: new Map(),
    targetListMembership: new Set(),
    ...overrides,
  };
}

describe('extension-campaign-qualify', () => {
  describe('isCampaignScheduleActive', () => {
    it('requires active status', () => {
      const now = new Date('2026-06-01T12:00:00Z');
      expect(isCampaignScheduleActive('inactive', null, null, now)).toBe(false);
      expect(isCampaignScheduleActive('active', null, null, now)).toBe(true);
    });

    it('respects startDate and endDate window', () => {
      const now = new Date('2026-06-15T12:00:00Z');
      const start = new Date('2026-06-20T00:00:00Z');
      const end = new Date('2026-06-10T00:00:00Z');
      expect(isCampaignScheduleActive('active', start, null, now)).toBe(false);
      expect(isCampaignScheduleActive('active', null, end, now)).toBe(false);
      expect(isCampaignScheduleActive('active', new Date('2026-06-01'), new Date('2026-06-30'), now)).toBe(
        true
      );
    });
  });

  describe('isExtensionUserNew', () => {
    it('returns true when account start / first event is within 7 days', () => {
      const today = new Date();
      expect(isExtensionUserNew(today)).toBe(true);
      const eightDaysAgo = new Date();
      eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
      expect(isExtensionUserNew(eightDaysAgo)).toBe(false);
    });
  });

  describe('filterQualifyingExtensionCampaigns — audience', () => {
    it('excludes new_users when viewer is not new', () => {
      const c = baseCampaign({ id: 'a', targetAudience: 'new_users' });
      const q = filterQualifyingExtensionCampaigns([c], baseCtx({ isNewUser: false }));
      expect(q).toHaveLength(0);
    });

    it('includes new_users when viewer is new', () => {
      const c = baseCampaign({ id: 'a', targetAudience: 'new_users' });
      const q = filterQualifyingExtensionCampaigns([c], baseCtx({ isNewUser: true }));
      expect(q).toHaveLength(1);
    });

    it('includes all_users regardless of isNewUser', () => {
      const c = baseCampaign({ targetAudience: 'all_users' });
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ isNewUser: false }))).toHaveLength(1);
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ isNewUser: true }))).toHaveLength(1);
    });
  });

  describe('filterQualifyingExtensionCampaigns — frequency', () => {
    it('full_day and always ignore view counts', () => {
      const a = baseCampaign({ id: 'a', frequencyType: 'full_day' });
      const b = baseCampaign({ id: 'b', frequencyType: 'always' });
      const counts = new Map([
        ['a', 999],
        ['b', 999],
      ]);
      const q = filterQualifyingExtensionCampaigns([a, b], baseCtx({ viewCountByCampaignId: counts }));
      expect(q.map((x) => x.id).sort()).toEqual(['a', 'b']);
    });

    it('only_once excludes when count >= 1', () => {
      const c = baseCampaign({ id: 'o', frequencyType: 'only_once' });
      expect(
        filterQualifyingExtensionCampaigns([c], baseCtx({ viewCountByCampaignId: new Map([['o', 0]]) }))
      ).toHaveLength(1);
      expect(
        filterQualifyingExtensionCampaigns([c], baseCtx({ viewCountByCampaignId: new Map([['o', 1]]) }))
      ).toHaveLength(0);
    });

    it('specific_count excludes when count >= frequencyCount (e.g. cap 100)', () => {
      const c = baseCampaign({
        id: 's',
        frequencyType: 'specific_count',
        frequencyCount: 100,
      });
      expect(
        filterQualifyingExtensionCampaigns([c], baseCtx({ viewCountByCampaignId: new Map([['s', 99]]) }))
      ).toHaveLength(1);
      expect(
        filterQualifyingExtensionCampaigns([c], baseCtx({ viewCountByCampaignId: new Map([['s', 100]]) }))
      ).toHaveLength(0);
      expect(
        filterQualifyingExtensionCampaigns([c], baseCtx({ viewCountByCampaignId: new Map([['s', 101]]) }))
      ).toHaveLength(0);
    });

    it('specific_count with null frequencyCount does not cap', () => {
      const c = baseCampaign({
        id: 's',
        frequencyType: 'specific_count',
        frequencyCount: null,
      });
      expect(
        filterQualifyingExtensionCampaigns([c], baseCtx({ viewCountByCampaignId: new Map([['s', 500]]) }))
      ).toHaveLength(1);
    });
  });

  describe('filterQualifyingExtensionCampaigns — time_based', () => {
    it('includes when current minutes fall inside same-day window', () => {
      const c = baseCampaign({
        frequencyType: 'time_based',
        timeStart: '09:00:00',
        timeEnd: '17:00:00',
      });
      const noon = 12 * 60;
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ currentMinutes: noon }))).toHaveLength(1);
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ currentMinutes: 8 * 60 }))).toHaveLength(0);
    });

    it('overnight window: e.g. 22:00–06:00 includes 23:00 and 05:00', () => {
      const c = baseCampaign({
        frequencyType: 'time_based',
        timeStart: '22:00:00',
        timeEnd: '06:00:00',
      });
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ currentMinutes: 23 * 60 }))).toHaveLength(1);
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ currentMinutes: 5 * 60 }))).toHaveLength(1);
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ currentMinutes: 12 * 60 }))).toHaveLength(0);
    });
  });

  describe('filterQualifyingExtensionCampaigns — country', () => {
    it('empty countryCodes = worldwide', () => {
      const c = baseCampaign({ countryCodes: [] });
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ endUserGeoCountry: null }))).toHaveLength(1);
    });

    it('non-empty countryCodes requires matching geo', () => {
      const c = baseCampaign({ countryCodes: ['US'] });
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ endUserGeoCountry: null }))).toHaveLength(0);
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ endUserGeoCountry: 'US' }))).toHaveLength(1);
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ endUserGeoCountry: 'CA' }))).toHaveLength(0);
    });
  });

  describe('filterQualifyingExtensionCampaigns — target list', () => {
    it('excludes when targetListId set and user not in membership set', () => {
      const c = baseCampaign({ id: 'c1', targetListId: 'L1' });
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ targetListMembership: new Set() }))).toHaveLength(0);
    });

    it('includes when targetListId set and user is in membership set', () => {
      const c = baseCampaign({ id: 'c1', targetListId: 'L1' });
      expect(
        filterQualifyingExtensionCampaigns([c], baseCtx({ targetListMembership: new Set(['L1']) }))
      ).toHaveLength(1);
    });

    it('ignores target list gate when targetListId is null', () => {
      const c = baseCampaign({ id: 'c1', targetListId: null });
      expect(filterQualifyingExtensionCampaigns([c], baseCtx({ targetListMembership: new Set() }))).toHaveLength(1);
    });
  });

  describe('parseCampaignTimeToMinutes', () => {
    it('parses HH:MM from time column strings', () => {
      expect(parseCampaignTimeToMinutes('09:30:00')).toBe(9 * 60 + 30);
      expect(parseCampaignTimeToMinutes(null)).toBeNull();
    });
  });
});
