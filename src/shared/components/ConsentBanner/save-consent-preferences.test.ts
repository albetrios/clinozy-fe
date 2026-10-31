import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import {
  ACCEPT_ALL_CONSENT_PREFERENCES,
  CONSENT_POLICY_VERSION,
  hasAnalyticsConsent,
  REJECT_ALL_CONSENT_PREFERENCES,
  selectConsentCardOpen,
  selectShouldAsk,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';
import {
  readConsentCookieForTests,
  resetConsentForTests,
  setGlobalPrivacyControlForTests,
} from '@/tests/utils/consent-cookie.ts';

import { saveConsentPreferences } from './save-consent-preferences.ts';

const recordConsentDecision = vi.fn(async () => undefined);
vi.mock('@/shared/analytics/record-consent-decision.ts', () => ({
  recordConsentDecision: (...args: unknown[]) => recordConsentDecision(...args),
}));

describe('saveConsentPreferences', () => {
  beforeEach(() => {
    setGlobalPrivacyControlForTests(false);
    useAuthStore.setState({ user: null });
    resetConsentForTests();
    recordConsentDecision.mockClear();
  });

  it('records who answered — the signed-in member, or nobody signed out (F-4)', () => {
    useAuthStore.setState({
      user: {
        id: 'usr_asha',
        email: 'a@clinic.test',
        role: 'user',
        name: 'Asha',
      } as AuthUser,
    });
    saveConsentPreferences(ACCEPT_ALL_CONSENT_PREFERENCES, 'consent_banner');
    expect(readConsentCookieForTests()).toMatchObject({ decidedBy: 'usr_asha' });
    expect(useConsentStore.getState().decidedBy).toBe('usr_asha');
    expect(hasAnalyticsConsent()).toBe(true);

    useAuthStore.setState({ user: null });
    saveConsentPreferences(REJECT_ALL_CONSENT_PREFERENCES, 'consent_banner');
    expect(readConsentCookieForTests()).toMatchObject({ decidedBy: null });
  });

  it('Accept all keeps the answer in the cookie, with the policy version and the time', () => {
    saveConsentPreferences(ACCEPT_ALL_CONSENT_PREFERENCES, 'consent_banner');
    const stored = readConsentCookieForTests();
    expect(stored).toMatchObject({ analytics: true, version: CONSENT_POLICY_VERSION });
    expect(Date.now() - Date.parse(String(stored?.decidedAt))).toBeLessThan(5000);
    expect(useConsentStore.getState().decidedAt).toBe(stored?.decidedAt);
    expect(hasAnalyticsConsent()).toBe(true);
    expect(selectShouldAsk(useConsentStore.getState())).toBe(false);
  });

  it('Reject all keeps analytics off and stops asking', () => {
    saveConsentPreferences(REJECT_ALL_CONSENT_PREFERENCES, 'consent_banner');
    expect(readConsentCookieForTests()).toMatchObject({ analytics: false });
    expect(hasAnalyticsConsent()).toBe(false);
    expect(selectShouldAsk(useConsentStore.getState())).toBe(false);
  });

  it('closes a card reopened from Privacy choices', () => {
    saveConsentPreferences(REJECT_ALL_CONSENT_PREFERENCES, 'consent_banner');
    useConsentStore.getState().openPreferences();
    expect(selectConsentCardOpen(useConsentStore.getState())).toBe(true);
    saveConsentPreferences(ACCEPT_ALL_CONSENT_PREFERENCES, 'settings');
    expect(selectConsentCardOpen(useConsentStore.getState())).toBe(false);
  });

  it('records the decision off the critical path, with where it was given', async () => {
    saveConsentPreferences(REJECT_ALL_CONSENT_PREFERENCES, 'settings');
    // The answer stands before the recorder has even loaded.
    expect(recordConsentDecision).not.toHaveBeenCalled();
    expect(readConsentCookieForTests()).toMatchObject({ analytics: false });
    await vi.waitFor(() =>
      expect(recordConsentDecision).toHaveBeenCalledWith(
        REJECT_ALL_CONSENT_PREFERENCES,
        'settings',
      ),
    );
  });

  it('a failing recorder never undoes the answer', async () => {
    recordConsentDecision.mockRejectedValueOnce(new Error('offline'));
    saveConsentPreferences(ACCEPT_ALL_CONSENT_PREFERENCES, 'consent_banner');
    await vi.waitFor(() => expect(recordConsentDecision).toHaveBeenCalledTimes(1));
    expect(hasAnalyticsConsent()).toBe(true);
    expect(readConsentCookieForTests()).toMatchObject({ analytics: true });
  });
});
