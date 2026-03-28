import { describe, it, expect, vi, beforeEach } from 'vitest';
import { endEventsOwnedCampaignJoin, endEventsRequiresCampaignOwnerJoin } from '@/lib/events-dashboard';

const dbMocks = vi.hoisted(() => ({
  limit: vi.fn(),
}));

vi.mock('@/db', () => ({
  database: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: dbMocks.limit,
        })),
      })),
    })),
  },
}));

import { getAccessibleCampaignById } from '@/lib/campaign-access';

describe('end events campaign owner access', () => {
  it('does not require campaign join for admin', () => {
    expect(endEventsRequiresCampaignOwnerJoin('admin')).toBe(false);
  });

  it('requires campaign join for non-admin', () => {
    expect(endEventsRequiresCampaignOwnerJoin('user')).toBe(true);
  });

  it('exposes INNER JOIN condition for non-admin queries', () => {
    expect(endEventsOwnedCampaignJoin('user-1')).toBeDefined();
  });
});

describe('getAccessibleCampaignById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the row when the DB returns a match (non-admin)', async () => {
    const row = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      createdBy: 'user-a',
    } as Awaited<ReturnType<typeof getAccessibleCampaignById>> & object;

    dbMocks.limit.mockResolvedValue([row]);

    const session = {
      user: { id: 'user-a' },
      role: 'user' as const,
    };

    const result = await getAccessibleCampaignById(session, row.id);
    expect(result).toEqual(row);
  });

  it('returns null when the DB returns no row (non-admin / wrong owner)', async () => {
    dbMocks.limit.mockResolvedValue([]);

    const session = {
      user: { id: 'user-a' },
      role: 'user' as const,
    };

    const result = await getAccessibleCampaignById(
      session,
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(result).toBeNull();
  });

  it('returns the row for admin when the DB returns a match', async () => {
    const row = {
      id: '550e8400-e29b-41d4-a716-446655440099',
      createdBy: 'someone-else',
    } as Awaited<ReturnType<typeof getAccessibleCampaignById>> & object;

    dbMocks.limit.mockResolvedValue([row]);

    const session = {
      user: { id: 'admin-user' },
      role: 'admin' as const,
    };

    const result = await getAccessibleCampaignById(session, row.id);
    expect(result).toEqual(row);
  });
});
