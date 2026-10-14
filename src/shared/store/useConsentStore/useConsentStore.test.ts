import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PRODUCT_NAMESPACE } from '@/lib/product-identity.ts';
import {
  answerConsentForTests,
  resetConsentForTests,
  setGlobalPrivacyControlForTests,
  writeConsentCookieForTests,
} from '@/tests/utils/consent-cookie.ts';

import {
  ACCEPT_ALL_CONSENT_PREFERENCES,
  CONSENT_POLICY_VERSION,
  hasAnalyticsConsent,
  REJECT_ALL_CONSENT_PREFERENCES,
  selectConsentCardOpen,
  selectShouldAsk,
  startConsentFollow,
  useConsentStore,
} from './useConsentStore.ts';

describe('useConsentStore', () => {
  beforeEach(() => {
    setGlobalPrivacyControlForTests(false);
    resetConsentForTests();
    localStorage.clear();
  });

  afterEach(() => {
    setGlobalPrivacyControlForTests(false);
  });

  it('starts undecided: the card asks and analytics stays off', () => {
    const state = useConsentStore.getState();
    expect(state.preferences).toBeNull();
    expect(selectShouldAsk(state)).toBe(true);
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('a standing Accept all allows analytics and stops asking', () => {
    answerConsentForTests(ACCEPT_ALL_CONSENT_PREFERENCES);
    expect(hasAnalyticsConsent()).toBe(true);
    expect(selectShouldAsk(useConsentStore.getState())).toBe(false);
  });

  it('a standing Reject all keeps analytics off and stops asking', () => {
    answerConsentForTests(REJECT_ALL_CONSENT_PREFERENCES);
    expect(hasAnalyticsConsent()).toBe(false);
    expect(selectShouldAsk(useConsentStore.getState())).toBe(false);
  });

  it('reads a standing answer back from the cookie (a reload, another tab)', () => {
    writeConsentCookieForTests({
      analytics: true,
      version: CONSENT_POLICY_VERSION,
      decidedAt: '2026-10-01T09:00:00.000Z',
    });
    useConsentStore.getState().reloadFromCookie();
    expect(useConsentStore.getState()).toMatchObject({
      preferences: { analytics: true },
      decidedAt: '2026-10-01T09:00:00.000Z',
    });
  });

  it('asks again for an answer to another policy version', () => {
    writeConsentCookieForTests({
      analytics: true,
      version: 1,
      decidedAt: '2026-10-01T09:00:00.000Z',
    });
    useConsentStore.getState().reloadFromCookie();
    expect(useConsentStore.getState().preferences).toBeNull();
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it('asks again when the cookie cannot be read', () => {
    writeConsentCookieForTests('{not json');
    useConsentStore.getState().reloadFromCookie();
    expect(useConsentStore.getState().preferences).toBeNull();
    writeConsentCookieForTests({
      analytics: 'yes',
      version: CONSENT_POLICY_VERSION,
      decidedAt: 'x',
    });
    useConsentStore.getState().reloadFromCookie();
    expect(useConsentStore.getState().preferences).toBeNull();
  });

  it('Global Privacy Control turns analytics off and answers for the card', () => {
    answerConsentForTests(ACCEPT_ALL_CONSENT_PREFERENCES);
    setGlobalPrivacyControlForTests(true);
    expect(hasAnalyticsConsent()).toBe(false);
    resetConsentForTests();
    expect(selectShouldAsk(useConsentStore.getState())).toBe(false);
  });

  it('Privacy choices reopens the card over a standing answer', () => {
    answerConsentForTests(REJECT_ALL_CONSENT_PREFERENCES);
    expect(selectConsentCardOpen(useConsentStore.getState())).toBe(false);
    useConsentStore.getState().openPreferences();
    expect(selectConsentCardOpen(useConsentStore.getState())).toBe(true);
  });

  it('startConsentFollow drops the launch answer and re-reads the cookie when the tab is shown', () => {
    localStorage.setItem(`${PRODUCT_NAMESPACE}-consent`, '{"state":{}}');
    const stop = startConsentFollow();
    expect(localStorage.getItem(`${PRODUCT_NAMESPACE}-consent`)).toBeNull();

    writeConsentCookieForTests({
      analytics: false,
      version: CONSENT_POLICY_VERSION,
      decidedAt: '2026-10-02T09:00:00.000Z',
    });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(useConsentStore.getState().preferences).toEqual({ analytics: false });
    stop();
  });
});
