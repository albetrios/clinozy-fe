import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('posthog-js', () => ({
  default: {
    capture: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
    __loaded: true,
  },
}));

vi.mock('@/core/config/env.ts', () => ({
  platformConfig: {
    posthogKey: 'phc_test_key',
    posthogHost: 'https://us.i.posthog.com',
  },
}));

const patch = vi.fn(async (..._args: unknown[]) => ({ data: {} }));
vi.mock('@/core/http/api.ts', () => ({
  api: { patch: (...args: unknown[]) => patch(...args) },
}));

vi.mock('@/shared/store/useConsentStore/index.ts', () => ({
  CONSENT_POLICY_VERSION: 2,
  hasAnalyticsConsent: vi.fn(() => true),
}));

import posthog from 'posthog-js';

import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';

import { markPostHogActive } from './capture.ts';
import { recordConsentDecision } from './record-consent-decision.ts';

function signIn(): void {
  useAuthStore.setState({
    user: { id: 'usr_1' } as never,
    isAuthenticated: true,
  });
}

describe('recordConsentDecision', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('captures one PostHog event when analytics is allowed', async () => {
    await recordConsentDecision({ analytics: true });
    await vi.waitFor(() => {
      expect(posthog.capture).toHaveBeenCalledWith(
        ANALYTICS_EVENTS.consentDecision,
        expect.objectContaining({ decision: 'granted', source: 'consent_banner' }),
      );
    });
  });

  it('captures nothing when analytics is refused', async () => {
    await recordConsentDecision({ analytics: false });
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('purges PostHog state when analytics is refused after it ran', async () => {
    markPostHogActive();
    await recordConsentDecision({ analytics: false });
    await vi.waitFor(() => {
      expect(posthog.opt_out_capturing).toHaveBeenCalled();
      expect(posthog.reset).toHaveBeenCalledWith(true);
    });
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('sends nothing to the server while signed out', async () => {
    await recordConsentDecision({ analytics: true });
    await recordConsentDecision({ analytics: false });
    expect(patch).not.toHaveBeenCalled();
  });

  it('sends a receipt with the policy version while signed in', async () => {
    signIn();
    await recordConsentDecision({ analytics: false }, 'settings');
    expect(patch).toHaveBeenCalledWith('/users/me/settings', {
      body: { analytics_consent: 'denied', analytics_consent_version: 2 },
    });
  });

  it('never throws when the receipt fails', async () => {
    signIn();
    patch.mockRejectedValueOnce(new Error('offline'));
    await expect(recordConsentDecision({ analytics: true })).resolves.toBeUndefined();
  });
});
