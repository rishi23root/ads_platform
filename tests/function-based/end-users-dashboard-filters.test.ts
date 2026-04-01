import { describe, it, expect, vi } from 'vitest';

vi.mock('@/db', () => ({
  database: {
    select: () => ({
      from: () => ({
        groupBy: () => ({
          as: () => ({}),
        }),
      }),
    }),
  },
}));

import { parseEndUsersDashboardFilters, usersFilterChips } from '@/lib/end-users-dashboard';

describe('end-users-dashboard filters (end_users schema)', () => {
  describe('parseEndUsersDashboardFilters', () => {
    it('maps endUserId to q when q is absent', () => {
      const sp = new URLSearchParams({ endUserId: ' abc ' });
      expect(parseEndUsersDashboardFilters(sp).q).toBe('abc');
    });

    it('prefers q over endUserId', () => {
      const sp = new URLSearchParams({ q: 'from-q', endUserId: 'from-end' });
      expect(parseEndUsersDashboardFilters(sp).q).toBe('from-q');
    });

    it('parses banned as true/false', () => {
      expect(parseEndUsersDashboardFilters(new URLSearchParams({ banned: 'true' })).banned).toBe(
        true
      );
      expect(parseEndUsersDashboardFilters(new URLSearchParams({ banned: '1' })).banned).toBe(true);
      expect(parseEndUsersDashboardFilters(new URLSearchParams({ banned: 'false' })).banned).toBe(
        false
      );
      expect(parseEndUsersDashboardFilters(new URLSearchParams({ banned: '0' })).banned).toBe(
        false
      );
      expect(
        parseEndUsersDashboardFilters(new URLSearchParams({ banned: 'maybe' })).banned
      ).toBeUndefined();
    });

    it('parses plan trial and paid; ignores unknown', () => {
      expect(parseEndUsersDashboardFilters(new URLSearchParams({ plan: 'trial' })).plan).toBe(
        'trial'
      );
      expect(parseEndUsersDashboardFilters(new URLSearchParams({ plan: 'PAID' })).plan).toBe(
        'paid'
      );
      expect(
        parseEndUsersDashboardFilters(new URLSearchParams({ plan: 'enterprise' })).plan
      ).toBeUndefined();
    });

    it('passes through joined / last-seen / country / email', () => {
      const sp = new URLSearchParams({
        email: 'a@b.co',
        joinedFrom: '2026-01-01',
        joinedTo: '2026-01-31',
        lastSeenFrom: '2026-02-01',
        lastSeenTo: '2026-02-28',
        country: 'us',
      });
      const f = parseEndUsersDashboardFilters(sp);
      expect(f.email).toBe('a@b.co');
      expect(f.joinedFrom).toBe('2026-01-01');
      expect(f.joinedTo).toBe('2026-01-31');
      expect(f.lastSeenFrom).toBe('2026-02-01');
      expect(f.lastSeenTo).toBe('2026-02-28');
      expect(f.country).toBe('us');
    });
  });

  describe('usersFilterChips', () => {
    it('shows Banned chip when banned filter is set', () => {
      const flags = { hasQParam: false, hasEndUserIdParam: false };
      const yes = usersFilterChips({ banned: true }, flags);
      expect(yes.some((c) => c.id === 'banned' && c.display === 'Yes')).toBe(true);
      const no = usersFilterChips({ banned: false }, flags);
      expect(no.some((c) => c.id === 'banned' && c.display === 'No')).toBe(true);
    });

    it('uses End user label when only endUserId is in the URL', () => {
      const chips = usersFilterChips({ q: 'uuid-fragment' }, {
        hasQParam: false,
        hasEndUserIdParam: true,
      });
      const search = chips.find((c) => c.id === 'search');
      expect(search?.label).toBe('End user');
    });

    it('uses Search label when q is in the URL', () => {
      const chips = usersFilterChips({ q: 'query' }, { hasQParam: true, hasEndUserIdParam: false });
      const search = chips.find((c) => c.id === 'search');
      expect(search?.label).toBe('Search');
    });
  });
});
