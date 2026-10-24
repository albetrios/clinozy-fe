import * as Sentry from '@sentry/react';
import type { AnyRouter } from '@tanstack/react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { platformConfig } from '@/core/config/env.ts';
import type { AuthUser } from '@/shared/auth/types.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import {
  ACCEPT_ALL_CONSENT_PREFERENCES,
  REJECT_ALL_CONSENT_PREFERENCES,
} from '@/shared/store/useConsentStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import {
  answerConsentForTests,
  resetConsentForTests,
} from '@/tests/utils/consent-cookie.ts';

import { initSentry } from './sentry.ts';

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  tanstackRouterBrowserTracingIntegration: vi.fn(() => ({ name: 'router' })),
  httpClientIntegration: vi.fn(() => ({ name: 'http' })),
  captureConsoleIntegration: vi.fn(() => ({ name: 'console' })),
  reportingObserverIntegration: vi.fn(() => ({ name: 'reporting' })),
  extraErrorDataIntegration: vi.fn(() => ({ name: 'extra' })),
  replayIntegration: vi.fn(() => ({ name: 'replay' })),
  browserProfilingIntegration: vi.fn(() => ({ name: 'profiling' })),
  consoleLoggingIntegration: vi.fn(() => ({ name: 'logs' })),
  feedbackIntegration: vi.fn(() => ({ name: 'feedback' })),
  addIntegration: vi.fn(),
  getReplay: vi.fn(),
}));

type MutableConfig = { sentryDsn: string | undefined };
const config = platformConfig as unknown as MutableConfig;
const ROUTER = {} as AnyRouter;

function initConfig() {
  return vi.mocked(Sentry.init).mock.calls[0]?.[0] as Parameters<
    typeof Sentry.init
  >[0] & {
    beforeSend: (event: unknown, hint?: unknown) => unknown;
    beforeSendTransaction: (event: unknown) => unknown;
  };
}

describe('initSentry', () => {
  const originalDsn = config.sentryDsn;

  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({ user: null });
    useOrganizationStore.getState().clearOrganization();
    resetConsentForTests();
  });

  afterEach(() => {
    config.sentryDsn = originalDsn;
  });

  it('is a no-op without a DSN', async () => {
    config.sentryDsn = undefined;
    await initSentry(ROUTER);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initializes with the full integration set when a DSN is configured', async () => {
    config.sentryDsn = 'https://key@sentry.example/1';
    answerConsentForTests(ACCEPT_ALL_CONSENT_PREFERENCES);
    await initSentry(ROUTER);

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const cfg = initConfig();
    expect(cfg.dsn).toBe('https://key@sentry.example/1');
    // v11's dataCollection defaults collect everything — every category stays off.
    expect(cfg.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    });
    // Streamed spans would skip the beforeSendTransaction URL scrubbing.
    expect(cfg.traceLifecycle).toBe('static');
    // Without 'trace', browserProfilingIntegration stays 'manual' and never profiles.
    expect(cfg.profileLifecycle).toBe('trace');
    expect(Sentry.replayIntegration).toHaveBeenCalledWith({
      maskAllText: true,
      blockAllMedia: true,
    });
    // Signed-out boot: user context cleared, org tags cleared.
    expect(Sentry.setUser).toHaveBeenCalledWith(null);
    expect(Sentry.setTag).toHaveBeenCalledWith('organization_id', undefined);
  });

  it('keeps session recording and profiling off without the analytics consent', async () => {
    config.sentryDsn = 'https://key@sentry.example/1';
    await initSentry(ROUTER);

    const names = (initConfig().integrations as { name: string }[]).map((i) => i.name);
    expect(names).not.toContain('replay');
    expect(names).not.toContain('profiling');
    // Error reports and logs still run.
    expect(names).toEqual(expect.arrayContaining(['router', 'logs']));
  });

  it('never injects Sentry\'s own feedback widget — "Report a bug" is ours (feat-bug-report D3)', async () => {
    config.sentryDsn = 'https://key@sentry.example/1';
    await initSentry(ROUTER);

    const names = (initConfig().integrations as { name: string }[]).map((i) => i.name);
    expect(names).not.toContain('feedback');
    expect(Sentry.feedbackIntegration).not.toHaveBeenCalled();
  });

  it('adds session recording on a later grant and stops it on a withdrawal', async () => {
    config.sentryDsn = 'https://key@sentry.example/1';
    const stop = vi.fn(() => Promise.resolve());
    vi.mocked(Sentry.getReplay).mockReturnValue({ stop } as unknown as ReturnType<
      typeof Sentry.getReplay
    >);
    await initSentry(ROUTER);

    answerConsentForTests(ACCEPT_ALL_CONSENT_PREFERENCES);
    expect(Sentry.addIntegration).toHaveBeenCalledWith({ name: 'replay' });

    answerConsentForTests(REJECT_ALL_CONSENT_PREFERENCES);
    expect(stop).toHaveBeenCalledTimes(1);
    // Granted again in the same page: not re-added (the SDK allows one replay integration).
    answerConsentForTests(ACCEPT_ALL_CONSENT_PREFERENCES);
    expect(Sentry.addIntegration).toHaveBeenCalledTimes(1);
  });

  it('beforeSend drops expected 4xx outcomes and keeps 5xx + filters input breadcrumbs', async () => {
    config.sentryDsn = 'https://key@sentry.example/1';
    await initSentry(ROUTER);
    const { beforeSend } = initConfig();

    const fourOhFour = {
      originalException: new HttpError('missing', 404, '/api/v1/x', 'GET'),
    };
    expect(beforeSend({ breadcrumbs: [] }, fourOhFour)).toBeNull();

    const fiveHundred = {
      originalException: new HttpError('boom', 500, '/api/v1/x', 'GET'),
    };
    const sent = beforeSend(
      {
        breadcrumbs: [
          { category: 'ui.input', message: 'secret text' },
          { category: 'navigation', message: '/dashboard' },
        ],
      },
      fiveHundred,
    ) as { breadcrumbs: Array<{ category: string; message: string }> };

    expect(sent).not.toBeNull();
    expect(sent.breadcrumbs[0]?.message).toBe('[Filtered]');
    expect(sent.breadcrumbs[1]?.message).toBe('/dashboard');
  });

  it('beforeSend strips the query from an httpClient 5xx event and its breadcrumbs (SEC-01)', async () => {
    config.sentryDsn = 'https://key@sentry.example/1';
    await initSentry(ROUTER);
    const { beforeSend } = initConfig();

    // httpClientIntegration sets request.url itself, so dataCollection.urlQueryParams never sees it.
    const sent = beforeSend({
      message: 'HTTP Client Error with status code: 503',
      request: {
        url: 'https://api.x.dev/api/v1/app/patients?limit=50&q=Priya',
        method: 'GET',
      },
      breadcrumbs: [
        {
          category: 'fetch',
          data: { url: '/api/v1/app/patients?q=Priya', method: 'GET' },
        },
        {
          category: 'navigation',
          data: { from: '/a', to: '/organization/acme/patients?q=Priya' },
        },
      ],
    }) as { request: { url: string } };

    expect(JSON.stringify(sent)).not.toContain('Priya');
    expect(sent.request.url).toBe('https://api.x.dev/api/v1/app/patients');
  });

  it('beforeSendTransaction strips the query from span data — long-animation-frame spans carry the page URL (SEC-01)', async () => {
    config.sentryDsn = 'https://key@sentry.example/1';
    await initSentry(ROUTER);
    const { beforeSendTransaction } = initConfig();

    const sent = beforeSendTransaction({
      spans: [
        {
          op: 'ui.long_animation_frame',
          data: {
            'browser.script.invoker':
              'https://app.x.dev/organization/acme/patients?q=Priya',
            'code.file.path': 'https://app.x.dev/organization/acme/patients?q=Priya',
          },
        },
      ],
      contexts: {
        trace: {
          data: { 'url.full': 'https://app.x.dev/organization/acme/patients?q=Priya' },
        },
      },
    });

    expect(JSON.stringify(sent)).not.toContain('Priya');
  });

  it('beforeSendTransaction filters typed input from breadcrumbs too', async () => {
    config.sentryDsn = 'https://key@sentry.example/1';
    await initSentry(ROUTER);
    const { beforeSendTransaction } = initConfig();

    const sent = beforeSendTransaction({
      breadcrumbs: [{ category: 'ui.input', message: 'typed password' }],
    }) as { breadcrumbs: Array<{ message: string }> };

    expect(sent.breadcrumbs[0]?.message).toBe('[Filtered]');
  });

  it('keeps user and organization tags in sync with the stores', async () => {
    config.sentryDsn = 'https://key@sentry.example/1';
    await initSentry(ROUTER);
    vi.mocked(Sentry.setUser).mockClear();
    vi.mocked(Sentry.setTag).mockClear();

    useAuthStore.setState({ user: { id: 'usr_9' } as AuthUser });
    expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'usr_9' });

    useOrganizationStore.setState({
      organizationId: 'org_1',
      organizationSlug: 'acme',
    });
    expect(Sentry.setTag).toHaveBeenCalledWith('organization_id', 'org_1');
    expect(Sentry.setTag).toHaveBeenCalledWith('organization_slug', 'acme');
  });
});
