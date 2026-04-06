import { describe, it, expect } from 'vitest';
import {
  redirectSourceMatchesVisit,
  redirectSourceToHostnameRegex,
} from '@/lib/domain-utils';

describe('redirectSourceToHostnameRegex', () => {
  function matchesRegex(visitHost: string, source: string, includeSubdomains: boolean) {
    const re = new RegExp(redirectSourceToHostnameRegex(source, includeSubdomains), 'i');
    return re.test(visitHost.trim().toLowerCase());
  }

  it('matches the same hostnames as redirectSourceMatchesVisit', () => {
    const cases: [string, string, boolean][] = [
      ['www.ndtv.com', 'https://www.ndtv.com', false],
      ['WWW.NDTV.COM', 'https://www.ndtv.com', false],
      ['sub.ndtv.com', 'ndtv.com', true],
      ['ndtv.com', 'ndtv.com', true],
      ['not.evildtv.com', 'ndtv.com', true],
      ['wrong.com', 'ndtv.com', false],
      ['sub.ndtv.com', 'ndtv.com', false],
    ];
    for (const [visit, source, sub] of cases) {
      expect(matchesRegex(visit, source, sub)).toBe(
        redirectSourceMatchesVisit(visit, source, sub)
      );
    }
  });
});
