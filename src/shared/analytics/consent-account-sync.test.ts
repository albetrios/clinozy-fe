import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/shared/auth/types.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import {
  CONSENT_POLICY_VERSION,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';

import {
  reconcileConsentWithAccount,
  startConsentAccountSync,
} from './consent-account-sync.ts';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(async (): Promise<{ data: unknown }> => ({ data: {} })),
  patch: vi.fn(async (): Promise<{ data: unknown }> => ({ data: {} })),
}));
vi.mock('@/core/http/api.ts', () => ({ api: apiMock }));

const purge = vi.hoisted(() => vi.fn());
vi.mock('./capture.ts', () => ({ purgeAnalyticsOnConsentRevoked: purge }));

const USER = { id: 'usr_aaaaaaaaaaaaaaaaaaaaa', email: 'a@example.com' } as AuthUser;

function accountAnswer(decision: 'granted' | 'denied', decidedAt: string) {
  return {
    data: {
      analytics_consent: decision,
      analytics_consent_version: CONSENT_POLICY_VERSION,
      analytics_consent_at: decidedAt,
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('consent account sync (D161)', () => {
  let stop: (() => void) | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    apiMock.get.mockResolvedValue({ data: {} });
    apiMock.patch.mockResolvedValue({ data: {} });
    useAuthStore.setState({ user: null });
    useConsentStore.getState().resetAnalyticsConsent();
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  it("applies the account's answer when it is later than this browser's", async () => {
    useConsentStore.getState().setAnalyticsConsent('granted', {
      decidedAt: '2026-10-01T00:00:00.000Z',
      policyVersion: 1,
    });
    apiMock.get.mockResolvedValue(accountAnswer('denied', new Date().toISOString()));

    await reconcileConsentWithAccount();

    expect(useConsentStore.getState().analyticsConsent).toBe('denied');
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it("saves this browser's answer when it is the later one — given before signing in", async () => {
    apiMock.get.mockResolvedValue(accountAnswer('granted', '2026-10-01T00:00:00.000Z'));
    useConsentStore.getState().setAnalyticsConsent('denied');

    await reconcileConsentWithAccount();

    expect(useConsentStore.getState().analyticsConsent).toBe('denied');
    expect(apiMock.patch).toHaveBeenCalledWith('/users/me/settings', {
      body: {
        analytics_consent: 'denied',
        analytics_consent_version: CONSENT_POLICY_VERSION,
      },
    });
  });

  it('leaves both alone when neither has answered — the card asks', async () => {
    await reconcileConsentWithAccount();
    expect(useConsentStore.getState().analyticsConsent).toBeNull();
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it('never throws when the account cannot be read', async () => {
    apiMock.get.mockRejectedValue(new Error('offline'));
    await expect(reconcileConsentWithAccount()).resolves.toBeUndefined();
  });

  it('saves a new answer while signed in, but not the account answer it applied', async () => {
    useAuthStore.setState({ user: USER });
    apiMock.get.mockResolvedValue(accountAnswer('granted', new Date().toISOString()));
    stop = startConsentAccountSync();
    await flush();
    // The sign-in applied the account's answer — nothing to save back.
    expect(useConsentStore.getState().analyticsConsent).toBe('granted');
    expect(apiMock.patch).not.toHaveBeenCalled();

    useConsentStore.getState().setAnalyticsConsent('denied');

    expect(apiMock.patch).toHaveBeenCalledWith('/users/me/settings', {
      body: {
        analytics_consent: 'denied',
        analytics_consent_version: CONSENT_POLICY_VERSION,
      },
    });
  });

  it('settles the answer when a person signs in after it starts', async () => {
    stop = startConsentAccountSync();
    apiMock.get.mockResolvedValue(accountAnswer('granted', new Date().toISOString()));

    useAuthStore.setState({ user: USER });
    await flush();

    expect(apiMock.get).toHaveBeenCalledWith('/users/me/settings');
    expect(useConsentStore.getState().analyticsConsent).toBe('granted');
  });

  it("forgets this browser's answer and PostHog's identifiers when the session ends", async () => {
    useAuthStore.setState({ user: USER });
    stop = startConsentAccountSync();
    await flush();
    useConsentStore.getState().setAnalyticsConsent('granted');
    apiMock.patch.mockClear();

    useAuthStore.setState({ user: null });

    expect(useConsentStore.getState().analyticsConsent).toBeNull();
    expect(purge).toHaveBeenCalled();
    // Forgetting is not an answer — nothing is saved.
    expect(apiMock.patch).not.toHaveBeenCalled();
  });

  it('does not save an answer given while signed out — sign-in settles it', () => {
    stop = startConsentAccountSync();
    useConsentStore.getState().setAnalyticsConsent('granted');
    expect(apiMock.patch).not.toHaveBeenCalled();
  });
});
