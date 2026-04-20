import { describe, it, expect } from 'vitest';
import {
  endUserInTargetList,
  isTargetListFilterEmpty,
  targetListFilterMatchesEndUser,
} from '@/lib/target-list-filter';
import { DEFAULT_TARGET_LIST_PRESETS } from '@/lib/seed-default-target-lists';
import type { EndUserRow } from '@/db/schema';

function baseUser(overrides: Partial<EndUserRow> = {}): EndUserRow {
  const now = new Date('2026-01-15T12:00:00.000Z');
  return {
    id: 'u1',
    email: 'a@b.com',
    passwordHash: null,
    identifier: 'id1',
    name: 'Test',
    plan: 'trial',
    banned: false,
    country: 'US',
    startDate: now,
    endDate: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('target-list-filter', () => {
  it('isTargetListFilterEmpty is true for null and empty shapes', () => {
    expect(isTargetListFilterEmpty(null)).toBe(true);
    expect(isTargetListFilterEmpty({})).toBe(true);
    expect(isTargetListFilterEmpty({ plans: [] })).toBe(true);
  });

  it('targetListFilterMatchesEndUser returns false when filter empty', () => {
    expect(targetListFilterMatchesEndUser(null, baseUser())).toBe(false);
  });

  it('default seed presets: All users matches trial and paid; split lists are exclusive', () => {
    const all = DEFAULT_TARGET_LIST_PRESETS.find((p) => p.name === 'All users')!.filterJson;
    const paid = DEFAULT_TARGET_LIST_PRESETS.find((p) => p.name === 'Paid users')!.filterJson;
    const trial = DEFAULT_TARGET_LIST_PRESETS.find((p) => p.name === 'Trial users')!.filterJson;
    expect(targetListFilterMatchesEndUser(all, baseUser({ plan: 'trial' }))).toBe(true);
    expect(targetListFilterMatchesEndUser(all, baseUser({ plan: 'paid' }))).toBe(true);
    expect(targetListFilterMatchesEndUser(paid, baseUser({ plan: 'paid' }))).toBe(true);
    expect(targetListFilterMatchesEndUser(paid, baseUser({ plan: 'trial' }))).toBe(false);
    expect(targetListFilterMatchesEndUser(trial, baseUser({ plan: 'trial' }))).toBe(true);
    expect(targetListFilterMatchesEndUser(trial, baseUser({ plan: 'paid' }))).toBe(false);
  });

  it('matches plan and country', () => {
    const u = baseUser({ plan: 'paid', country: 'de' });
    expect(
      targetListFilterMatchesEndUser({ plans: ['paid'], countries: ['DE'] }, u)
    ).toBe(true);
    expect(
      targetListFilterMatchesEndUser({ plans: ['trial'] }, u)
    ).toBe(false);
  });

  it('rejects when countries require value but user.country null', () => {
    const u = baseUser({ country: null });
    expect(targetListFilterMatchesEndUser({ countries: ['US'] }, u)).toBe(false);
  });

  it('endUserInTargetList: explicit member wins without filter', () => {
    const u = baseUser({ id: 'uuid-1' });
    expect(
      endUserInTargetList(
        { id: 'L1', memberIds: ['uuid-1'], filterJson: null },
        u
      )
    ).toBe(true);
  });

  it('endUserInTargetList: filter matches with empty members', () => {
    const u = baseUser({ plan: 'paid' });
    expect(
      endUserInTargetList(
        { id: 'L1', memberIds: [], filterJson: { plans: ['paid'] } },
        u
      )
    ).toBe(true);
  });

  it('endUserInTargetList: excluded overrides explicit membership', () => {
    const u = baseUser({ id: 'uuid-1' });
    expect(
      endUserInTargetList(
        { id: 'L1', memberIds: ['uuid-1'], excludedIds: ['uuid-1'], filterJson: null },
        u
      )
    ).toBe(false);
  });

  it('endUserInTargetList: excluded overrides filter match', () => {
    const u = baseUser({ id: 'uuid-1', plan: 'paid' });
    expect(
      endUserInTargetList(
        {
          id: 'L1',
          memberIds: [],
          excludedIds: ['uuid-1'],
          filterJson: { plans: ['paid'] },
        },
        u
      )
    ).toBe(false);
  });

  it('endUserInTargetList: not excluded, not member, no filter match', () => {
    const u = baseUser({ id: 'uuid-1', plan: 'trial' });
    expect(
      endUserInTargetList(
        { id: 'L1', memberIds: [], excludedIds: [], filterJson: { plans: ['paid'] } },
        u
      )
    ).toBe(false);
  });
});
