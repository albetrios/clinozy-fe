import type * as SentryReact from '@sentry/react';
import type { AnyRouter } from '@tanstack/react-router';

import { platformConfig } from '@/core/config/env.ts';
import { scrubEventUrls } from '@/lib/telemetry-scrub.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import {
  currentAnalyticsConsent,
  hasAnalyticsConsent,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

type SentryModule = typeof SentryReact;

function syncUserContext(Sentry: SentryModule): void {
  const user = useAuthStore.getState().user;
  if (user) {
    Sentry.setUser({ id: user.id });
  } else {
    Sentry.setUser(null);
  }
}

function syncOrganizationTags(Sentry: SentryModule): void {
  const org = useOrganizationStore.getState();
  if (org.organizationId) {
    Sentry.setTag('organization_id', org.organizationId);
    Sentry.setTag('organization_slug', org.organizationSlug ?? 'unknown');
  } else {
    Sentry.setTag('organization_id', undefined);
    Sentry.setTag('organization_slug', undefined);
  }
}

/** Session recording, masked: no text, no media. */
function sessionReplayIntegration(Sentry: SentryModule) {
  return Sentry.replayIntegration({
    maskAllText: true,
    blockAllMedia: true,
  });
}

function buildIntegrations(
  Sentry: SentryModule,
  router: AnyRouter,
  options: { recording: boolean },
) {
  const integrations = [
    Sentry.tanstackRouterBrowserTracingIntegration(router),
    Sentry.httpClientIntegration(),
    Sentry.captureConsoleIntegration({ levels: ['error', 'warn'] }),
    Sentry.reportingObserverIntegration(),
    Sentry.extraErrorDataIntegration({ depth: 5 }),
    Sentry.consoleLoggingIntegration({ levels: ['warn', 'error'] }),
    Sentry.feedbackIntegration({
      colorScheme: 'system',
      showBranding: false,
      autoInject: true,
    }),
  ];

  // Session recording and profiling only with the analytics consent (D161); error reports,
  // logs and feedback run whenever a DSN is configured — including local `pnpm dev`.
  if (options.recording) {
    integrations.push(
      sessionReplayIntegration(Sentry),
      Sentry.browserProfilingIntegration(),
    );
  }

  return integrations;
}

/**
 * Follow the analytics consent after init: a grant adds session recording (sampled as
 * configured), a withdrawal stops it at once.
 *
 * @remarks Profiling is decided at init only — the SDK cannot add or stop it mid-session — so a
 * changed answer reaches it at the next page load. A recording stopped by a withdrawal is not
 * restarted by a later grant in the same page (the SDK's restart would skip the sampling); it
 * resumes at the next load.
 */
let stopFollowingRecordingConsent: (() => void) | null = null;

function followRecordingConsent(Sentry: SentryModule, recordingAtInit: boolean): void {
  let replayAdded = recordingAtInit;
  // One follower per page, even if init runs again.
  stopFollowingRecordingConsent?.();
  stopFollowingRecordingConsent = useConsentStore.subscribe((state, previous) => {
    const granted = currentAnalyticsConsent(state) === 'granted';
    if (granted === (currentAnalyticsConsent(previous) === 'granted')) return;
    if (granted && !replayAdded) {
      Sentry.addIntegration(sessionReplayIntegration(Sentry));
      replayAdded = true;
    }
    if (!granted)
      Sentry.getReplay()
        ?.stop()
        .catch(() => undefined);
  });
}

/**
 * Initialize Sentry off the critical path.
 *
 * The module is dynamically imported from `main.tsx` during idle time.
 * Active whenever `VITE_SENTRY_DSN` is set (development **and** production).
 * See `docs/integrations/sentry-frontend.md` for the full data catalog.
 *
 * @param router - TanStack Router instance for route-aware tracing.
 */
export async function initSentry(router: AnyRouter): Promise<void> {
  if (!platformConfig.sentryDsn) return;

  const Sentry = await import('@sentry/react');
  const recording = hasAnalyticsConsent();

  Sentry.init({
    dsn: platformConfig.sentryDsn,
    environment: platformConfig.environment,
    release: platformConfig.appVersion,
    enabled: true,
    integrations: buildIntegrations(Sentry, router, { recording }),

    // Sentry v11 replaced `sendDefaultPii: false` with `dataCollection`, whose
    // defaults collect everything. Keep the old posture: no IP inference
    // (`userInfo`), cookies, headers, bodies or query params, no GraphQL / gen-AI
    // payloads and no local variables. Source context lines are code, not user
    // data, so `frameContextLines` keeps its default.
    dataCollection: {
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
    },
    attachStacktrace: true,
    maxBreadcrumbs: 100,
    normalizeDepth: 6,

    // v11 captures logs whenever a logging integration is present
    // (consoleLoggingIntegration above); the old `enableLogs` option is gone.

    // v11 streams spans by default, and streamed spans skip `beforeSendTransaction`
    // (the URL scrubbing below) and carry no scope tags. Keep transaction events
    // until that scrubbing moves to `beforeSendSpan`.
    traceLifecycle: 'static',
    tracesSampleRate: platformConfig.sentryTracesSampleRate,
    // v11 dropped per-transaction `profilesSampleRate`: sample profiling per session
    // and profile while a trace is active — the closest match to the old behaviour.
    // (browserProfilingIntegration defaults to 'manual', which never profiles on its own.)
    profileSessionSampleRate: platformConfig.sentryProfilesSampleRate,
    profileLifecycle: 'trace',
    tracePropagationTargets: ['localhost', /^https:\/\/api\./, /^\/api\//],

    replaysSessionSampleRate: platformConfig.sentryReplaysSessionSampleRate,
    replaysOnErrorSampleRate: platformConfig.sentryReplaysOnErrorSampleRate,

    ignoreErrors: [
      /Object \[object Object\] has no method 'updateFrom'/,
      // Console-captured duplicates of errors already reported through their
      // real paths (HttpError capture, retry logic) — and dev-server HMR noise.
      /^\[Query Error\]/,
      /^\[Mutation Error\]/,
      /^\[HTTP\] Retry attempt/,
      /^\[vite\]/,
    ],

    beforeSend(event, hint) {
      // Expected client outcomes (validation 400/422, auth 401/403, missing
      // 404/409/429) are handled UX states, not defects — only transport
      // failures and 5xx responses are signal.
      const cause = hint?.originalException;
      if (cause instanceof HttpError && cause.status < 500) return null;
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.category === 'ui.input') {
            return { ...breadcrumb, message: '[Filtered]' };
          }
          return breadcrumb;
        });
      }
      return scrubEventUrls(event);
    },

    // Transactions skip beforeSend; pageload spans carry the full URL.
    beforeSendTransaction(event) {
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.category === 'ui.input') {
            return { ...breadcrumb, message: '[Filtered]' };
          }
          return breadcrumb;
        });
      }
      return scrubEventUrls(event);
    },
  });

  if (platformConfig.appBuildId) {
    Sentry.setTag('app.build_id', platformConfig.appBuildId);
  }

  syncUserContext(Sentry);
  syncOrganizationTags(Sentry);

  useAuthStore.subscribe(() => syncUserContext(Sentry));
  useOrganizationStore.subscribe(() => syncOrganizationTags(Sentry));
  followRecordingConsent(Sentry, recording);
}

/**
 * Report a React error boundary failure with component stack linkage.
 * Lazy-imports Sentry to keep the entry preload graph lean.
 */
export function reportReactError(
  error: unknown,
  errorInfo: { componentStack?: string | null },
): void {
  if (!platformConfig.sentryDsn) return;

  import('@sentry/react')
    .then((Sentry) => {
      const user = useAuthStore.getState().user;
      const org = useOrganizationStore.getState();

      Sentry.withScope((scope) => {
        if (user) scope.setUser({ id: user.id });
        if (org.organizationId) {
          scope.setTag('organization_id', org.organizationId);
          scope.setTag('organization_slug', org.organizationSlug ?? 'unknown');
        }
        Sentry.captureReactException(error, {
          componentStack: errorInfo.componentStack ?? '',
        });
      });
    })
    .catch(() => {
      /* error reporting must never throw */
    });
}
