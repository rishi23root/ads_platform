import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  computeExtensionDaysLeft,
  computePaidSubscriptionEndFromNow,
  computePaidSubscriptionEndFromStart,
  defaultPaidSubscriptionDays,
} from '@/lib/extension-user-subscription';

describe('extension-user-subscription', () => {
  it('infers trial end from start when endDate is null', () => {
    const startDate = new Date('2026-03-20T12:00:00.000Z');
    const now = new Date('2026-03-21T12:00:00.000Z');
    const days = computeExtensionDaysLeft({
      endDate: null,
      plan: 'trial',
      startDate,
      now,
    });
    expect(days).toBe(6);
  });

  it('returns null for paid users with no endDate', () => {
    const startDate = new Date('2026-03-20T12:00:00.000Z');
    const now = new Date('2026-03-21T12:00:00.000Z');
    expect(
      computeExtensionDaysLeft({
        endDate: null,
        plan: 'paid',
        startDate,
        now,
      })
    ).toBeNull();
  });

  it('uses explicit endDate when set', () => {
    const startDate = new Date('2026-03-20T12:00:00.000Z');
    const endDate = new Date('2026-03-22T12:00:00.000Z');
    const now = new Date('2026-03-21T12:00:00.000Z');
    expect(
      computeExtensionDaysLeft({
        endDate,
        plan: 'trial',
        startDate,
        now,
      })
    ).toBe(1);
  });

  it('computePaidSubscriptionEndFromStart adds default paid calendar days', () => {
    const start = new Date('2026-01-01T12:00:00.000Z');
    const end = computePaidSubscriptionEndFromStart(start);
    expect(end).not.toBeNull();
    const msPerDay = 86_400_000;
    expect(Math.round((end!.getTime() - start.getTime()) / msPerDay)).toBe(defaultPaidSubscriptionDays());
  });

  it('computePaidSubscriptionEndFromNow matches from-start for the same instant', () => {
    const now = new Date('2026-06-15T09:30:00.000Z');
    expect(computePaidSubscriptionEndFromNow(now).getTime()).toBe(
      computePaidSubscriptionEndFromStart(now)!.getTime()
    );
  });

  it('respects DEFAULT_PAID_SUBSCRIPTION_DAYS when set', () => {
    vi.stubEnv('DEFAULT_PAID_SUBSCRIPTION_DAYS', '30');
    const start = new Date('2026-01-10T00:00:00.000Z');
    const end = computePaidSubscriptionEndFromStart(start);
    const msPerDay = 86_400_000;
    expect(Math.round((end!.getTime() - start.getTime()) / msPerDay)).toBe(30);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});
