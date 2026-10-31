import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthUser } from '@/shared/auth/types.ts';

const TEST_USER: AuthUser = {
  id: 'user-1',
  email: 'test@example.com',
  role: 'admin',
  organizationId: 'org_1',
  name: 'Test User',
};

type PostHogWorld = {
  /** Overrides for the env config; a key set to `undefined` stays unset. */
  config?: { posthogKey?: string; posthogHost?: string };
  /** Analytics consent: granted unless the test says otherwise. */
  consent?: boolean;
  /** What `posthog.init` does when it is called. */
  init?: () => void;
};

/**
 * Self-contained fresh world. vi.doMock persists across tests and across
 * resetModules, and resetModules splits module instances — so every test here
 * declares its whole world through this (env, consent and posthog-js together)
 * and asserts on the instances imported from the same fresh registry. A test
 * that skips any of it inherits whatever the previous test happened to mock.
 */
async function loadFreshPostHog({
  config = {},
  consent = true,
  init = () => undefined,
}: PostHogWorld = {}) {
  vi.resetModules();
  vi.doMock('@/core/config/env.ts', () => ({
    platformConfig: { posthogKey: 'phc_test', posthogHost: undefined, ...config },
  }));
  vi.doMock('@/shared/store/useConsentStore/index.ts', () => ({
    hasAnalyticsConsent: () => consent,
  }));
  vi.doMock('posthog-js', () => ({
    default: {
      init: vi.fn(init),
      reset: vi.fn(),
      register: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
      capture: vi.fn(),
      __loaded: false,
    },
  }));
  const { initPostHog } = await import('./posthog.ts');
  const phMock = (await import('posthog-js')).default;
  const { useAuthStore } = await import('@/shared/store/useAuthStore/index.ts');
  return { initPostHog, phMock, useAuthStore };
}

describe('initPostHog', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('calls posthog.init when key is provided', async () => {
    const { initPostHog, phMock } = await loadFreshPostHog({
      config: { posthogKey: 'phc_test_key', posthogHost: 'https://us.i.posthog.com' },
    });
    initPostHog();
    expect(phMock.init).toHaveBeenCalledWith(
      'phc_test_key',
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        capture_pageview: true,
      }),
    );
  });

  it('pins off every capture PostHog could switch on remotely, and masks what is left (F-3)', async () => {
    const { initPostHog, phMock } = await loadFreshPostHog();
    initPostHog();
    expect(phMock.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        autocapture: false,
        capture_heatmaps: false,
        capture_dead_clicks: false,
        capture_exceptions: false,
        rageclick: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_conversations: true,
        disable_product_tours: true,
        disable_web_experiments: true,
        disable_external_dependency_loading: true,
        mask_all_text: true,
        mask_all_element_attributes: true,
      }),
    );
  });

  it('before_send drops screen-reporting events and element text (F-3)', async () => {
    const { initPostHog, phMock } = await loadFreshPostHog();
    initPostHog();
    const options = vi.mocked(phMock.init).mock.calls[0]?.[1] as unknown as {
      before_send: (event: unknown) => unknown;
    };
    for (const name of [
      '$autocapture',
      '$rageclick',
      '$dead_click',
      '$$heatmap',
      '$exception',
    ]) {
      expect(options.before_send({ event: name, properties: {} })).toBeNull();
    }
    const out = options.before_send({
      event: 'route_viewed',
      properties: {
        $el_text: 'Priya Shah · 98765 43210',
        $elements: [{ $el_text: 'Priya Shah' }],
        $elements_chain: 'a:text="Priya Shah"',
        $heatmap_data: { '/patients': [{ x: 1, y: 2 }] },
        route_id: '/organization/$organizationSlug/patients',
      },
    }) as { properties: Record<string, unknown> };
    expect(JSON.stringify(out)).not.toMatch(/Priya|98765/);
    expect(out.properties).toEqual({
      route_id: '/organization/$organizationSlug/patients',
    });
  });

  it('does NOT initialize without analytics consent', async () => {
    const { initPostHog, phMock } = await loadFreshPostHog({ consent: false });
    initPostHog();

    expect(phMock.init).not.toHaveBeenCalled();
  });

  it('does not call init when key is missing', async () => {
    // Consent is granted, so the missing key is the only reason not to init.
    const { initPostHog, phMock } = await loadFreshPostHog({
      config: { posthogKey: undefined },
    });
    initPostHog();
    expect(phMock.init).not.toHaveBeenCalled();
  });

  it('before_send scrubs token URLs from event properties (incl. $set_once)', async () => {
    const { initPostHog, phMock } = await loadFreshPostHog();
    initPostHog();

    const options = vi.mocked(phMock.init).mock.calls[0]?.[1] as unknown as {
      before_send: (event: unknown) => unknown;
    };
    const event = {
      properties: {
        $current_url: 'https://x.dev/reset-password?token=sec-1',
        $set_once: { $initial_current_url: 'https://x.dev/verify-email?token=sec-2' },
      },
    };

    const out = options.before_send(event) as typeof event;

    expect(out.properties.$current_url).toBe('https://x.dev/reset-password');
    expect(out.properties.$set_once.$initial_current_url).toBe(
      'https://x.dev/verify-email',
    );
    expect(options.before_send(null)).toBeNull(); // pass-through, no crash
  });

  it('before_send scrubs URL props in properties, $set and $set_once — the posthog-js CaptureResult shape (SEC-01)', async () => {
    const { initPostHog, phMock } = await loadFreshPostHog();
    initPostHog();

    const options = vi.mocked(phMock.init).mock.calls[0]?.[1] as unknown as {
      before_send: (event: unknown) => unknown;
    };
    // posthog-js 1.438: `$set` / `$set_once` are siblings of `properties`, not inside it.
    const event = {
      uuid: 'u-1',
      event: '$pageview',
      properties: {
        $current_url: 'https://x.dev/organization/acme/patients?q=Priya%20Sharma',
        $session_entry_url:
          'https://x.dev/login?redirect=%2Forganization%2Facme%2Fpatients%3Fq%3DPriya',
        $pathname: '/organization/acme/patients',
      },
      $set: { $current_url: 'https://x.dev/organization/acme/patients?q=Priya' },
      $set_once: { $initial_current_url: 'https://x.dev/accept-invite?token=sec-3' },
    };

    const out = options.before_send(event) as typeof event;

    expect(JSON.stringify(out)).not.toMatch(/Priya|sec-3/);
    expect(out.properties.$current_url).toBe('https://x.dev/organization/acme/patients');
    expect(out.properties.$pathname).toBe('/organization/acme/patients');
    expect(out.$set_once.$initial_current_url).toBe('https://x.dev/accept-invite');
  });

  it('resets the anonymous identity when the session ends', async () => {
    const { initPostHog, phMock, useAuthStore } = await loadFreshPostHog();
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false });
    initPostHog();

    useAuthStore.getState().setUser(TEST_USER); // login: no reset
    expect(phMock.reset).not.toHaveBeenCalled();

    useAuthStore.getState().clearAuth(); // logout: reset once
    expect(phMock.reset).toHaveBeenCalledTimes(1);

    useAuthStore.setState({ user: null }); // staying logged out: still once
    expect(phMock.reset).toHaveBeenCalledTimes(1);
  });

  it('does not crash when init throws', async () => {
    const { initPostHog, phMock } = await loadFreshPostHog({
      init: () => {
        throw new Error('PostHog init failed');
      },
    });
    expect(() => initPostHog()).not.toThrow();
    // Proves init was reached: a test that never calls it would pass too.
    expect(phMock.init).toHaveBeenCalled();
  });
});
