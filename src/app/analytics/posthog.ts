import type { AnyRouter } from '@tanstack/react-router';
import posthog, { type PostHogConfig } from 'posthog-js';

import { platformConfig } from '@/core/config/env.ts';
import { scrubPostHogEvent } from '@/lib/telemetry-scrub.ts';
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
 * PostHog's init options. Every capture PostHog can switch on from its own dashboard (remote
 * config) is pinned off here, so the project's settings can never start reading screen text,
 * clicks or exceptions from a clinic screen: no autocapture, heatmaps, dead or rage clicks,
 * exception capture or session recording; no surveys, conversations, product tours or web
 * experiments; and no script loaded from PostHog's CDN (`disable_external_dependency_loading`
 * — the extensions those features need). Text and attributes are masked should anything still
 * read an element, and `before_send` drops element text, heatmap data and the query of every URL
 * (`scrubPostHogEvent`). What is left: page views, page leaves and the app's own named events.
 */
export const postHogInitOptions = (host: string | undefined) =>
  ({
    api_host: host?.length ? host : 'https://us.i.posthog.com',
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
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
    before_send: scrubPostHogEvent,
  }) satisfies Partial<PostHogConfig>;

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
    posthog.init(key, postHogInitOptions(host));
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
