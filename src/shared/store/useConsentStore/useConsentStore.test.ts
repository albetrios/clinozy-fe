import { beforeEach, describe, expect, it } from 'vitest';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';

import {
  CONSENT_MAX_AGE_DAYS,
  CONSENT_POLICY_VERSION,
  currentAnalyticsConsent,
  hasAnalyticsConsent,
  useConsentStore,
} from './useConsentStore.ts';

const DAY_MS = 86_400_000;

describe('useConsentStore', () => {
  beforeEach(() => {
    useConsentStore.getState().resetAnalyticsConsent();
    localStorage.clear();
  });

  it('starts undecided (banner should show, analytics off)', () => {
    expect(useConsentStore.getState().analyticsConsent).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('grants consent, stamped with the time and the policy version', () => {
    useConsentStore.getState().setAnalyticsConsent('granted');
    const state = useConsentStore.getState();
    expect(state.analyticsConsent).toBe('granted');
    expect(state.policyVersion).toBe(CONSENT_POLICY_VERSION);
    expect(Date.now() - Date.parse(state.decidedAt ?? '')).toBeLessThan(5000);
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it('denies consent (stays off)', () => {
    useConsentStore.getState().setAnalyticsConsent('denied');
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("takes the account's saved answer with its own time and version", () => {
    useConsentStore.getState().setAnalyticsConsent('granted', {
      decidedAt: '2026-09-01T10:00:00.000Z',
      policyVersion: 1,
    });
    expect(useConsentStore.getState().decidedAt).toBe('2026-09-01T10:00:00.000Z');
  });

  it('persists the decision to localStorage', () => {
    useConsentStore.getState().setAnalyticsConsent('granted');
    expect(localStorage.getItem(`${PRODUCT_NAMESPACE}-consent`)).toContain('granted');
  });

  it('reset returns to undecided', () => {
    useConsentStore.getState().setAnalyticsConsent('denied');
    useConsentStore.getState().resetAnalyticsConsent();
    expect(useConsentStore.getState()).toMatchObject({
      analyticsConsent: null,
      decidedAt: null,
      policyVersion: null,
    });
  });
});

describe('currentAnalyticsConsent', () => {
  const now = Date.parse('2026-10-10T12:00:00.000Z');
  const answered = (
    daysAgo: number,
    policyVersion: number | null = CONSENT_POLICY_VERSION,
  ) => ({
    analyticsConsent: 'granted' as const,
    decidedAt: new Date(now - daysAgo * DAY_MS).toISOString(),
    policyVersion,
  });

  it('keeps an answer to this policy for six months', () => {
    expect(currentAnalyticsConsent(answered(CONSENT_MAX_AGE_DAYS - 1), now)).toBe(
      'granted',
    );
  });

  it('asks again once the answer is older than six months', () => {
    expect(currentAnalyticsConsent(answered(CONSENT_MAX_AGE_DAYS + 1), now)).toBeNull();
  });

  it('asks again when the policy version moved', () => {
    expect(
      currentAnalyticsConsent(answered(1, CONSENT_POLICY_VERSION - 1), now),
    ).toBeNull();
  });

  it('treats an answer stored before the time and version were kept as not answered', () => {
    expect(
      currentAnalyticsConsent(
        { analyticsConsent: 'granted', decidedAt: null, policyVersion: null },
        now,
      ),
    ).toBeNull();
  });
});
