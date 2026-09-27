import type { AnyRouter } from '@tanstack/react-router';
import posthog from 'posthog-js';

import { platformConfig } from '@/core/config/env.ts';
import { scrubObjectUrls } from '@/lib/telemetry-scrub.ts';
import {
  attachPostHogIdentitySync,
  attachPostHogRouter,
  markPostHogActive,
  registerPostHogBootstrap,
  registerPostHogSuperProperties,
} from '@/shared/analytics/capture.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { hasAnalyticsConsent } from '@/shared/store/useConsentStore/index.ts';

let initialized = false;
let routerAttached = false;

/**
 * Initialize PostHog analytics.
 *
 * Gracefully handles missing key or init failure — analytics
 * is never a hard dependency and must not block the app.
 *
 * @param router - Optional TanStack Router for SPA `route_viewed` events.
 */
export function initPostHog(router?: AnyRouter): void {
  if (initialized) {
    if (router && !routerAttached) {
      attachPostHogRouter(posthog, router);
      routerAttached = true;
    }
    return;
  }

  if (!hasAnalyticsConsent()) {
    if (platformConfig.debugLogging) {
      console.info('[PostHog] Analytics consent not granted — not initializing');
    }
    return;
  }

  const key = platformConfig.posthogKey;
  const host = platformConfig.posthogHost;

  if (!key) {
    if (platformConfig.debugLogging) {
      console.info('[PostHog] No API key — analytics disabled');
    }
    return;
  }

  try {
    posthog.init(key, {
      api_host: host?.length ? host : 'https://us.i.posthog.com',
      capture_pageview: true,
      capture_pageleave: true,
      persistence: 'localStorage+cookie',
      autocapture: false,
      disable_session_recording: true,
      before_send: (event) => {
        if (event?.properties) scrubObjectUrls(event.properties);
        return event;
      },
    });
    initialized = true;
    markPostHogActive();

    registerPostHogSuperProperties(posthog);
    attachPostHogIdentitySync(posthog);
    if (router) {
      attachPostHogRouter(posthog, router);
      routerAttached = true;
    }

    let hadUser = useAuthStore.getState().user !== null;
    useAuthStore.subscribe((state) => {
      const hasUser = state.user !== null;
      if (hadUser && !hasUser) posthog.reset();
      hadUser = hasUser;
    });
  } catch (error) {
    if (platformConfig.debugLogging) {
      console.warn('[PostHog] Initialization failed:', error);
    }
  }
}

registerPostHogBootstrap(initPostHog);

export { posthog };
