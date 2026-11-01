import type { AnyRouter } from '@tanstack/react-router';
import type * as PostHogModule from 'posthog-js';

import { platformConfig } from '@/core/config/env.ts';
import { scrubObjectUrls, scrubSensitiveUrl } from '@/lib/telemetry-scrub.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { hasAnalyticsConsent } from '@/shared/store/useConsentStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  ANALYTICS_EVENTS,
  ANALYTICS_ORG_GROUP_TYPE,
  ANALYTICS_SUPER_PROPERTIES,
  type AnalyticsEventName,
} from './analytics.constants.ts';

type PostHogClient = (typeof PostHogModule)['default'];
type PostHogBootstrap = (router?: AnyRouter) => void;

let postHogBootstrap: PostHogBootstrap | null = null;

/** Called once from `app/analytics/posthog.ts` — avoids shared → app imports. */
export function registerPostHogBootstrap(fn: PostHogBootstrap): void {
  postHogBootstrap = fn;
}

function ensurePostHogBootstrapped(): void {
  postHogBootstrap?.();
}

let postHogActive = false;

/** Marked once PostHog has actually initialized (called from app/analytics/posthog.ts). */
export function markPostHogActive(): void {
  postHogActive = true;
}

/** PostHog keeps its identifiers under `ph_…` in localStorage and in cookies. */
const POSTHOG_STORAGE_PREFIX = 'ph_';

/**
 * Remove PostHog's stored identifiers from this browser without loading PostHog — what an
 * earlier grant left behind, once Analytics is refused.
 */
function forgetStoredAnalyticsIdentifiers(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(POSTHOG_STORAGE_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* storage can be unavailable (private mode); nothing to forget then */
  }
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim() ?? '';
    if (name.startsWith(POSTHOG_STORAGE_PREFIX)) {
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  }
}

/**
 * Consent withdrawn, or the session ended → stop capture and purge PostHog's stored identifiers
 * (localStorage + cookie). Never loads the analytics chunk when PostHog did not start in this
 * tab, so a decline-from-start stays free of it.
 */
export function purgeAnalyticsOnConsentRevoked(): void {
  forgetStoredAnalyticsIdentifiers();
  // PostHog is `reset` below: a later grant must identify the user and the clinic again.
  forgetSyncedIdentity();
  if (!postHogActive) return;
  postHogActive = false;
  import('posthog-js')
    .then(({ default: posthog }) => {
      if (!posthog.__loaded) return;
      posthog.opt_out_capturing();
      posthog.reset(true);
    })
    .catch(() => {
      /* analytics must never throw */
    });
}

/**
 * Consent given again in a tab where it was withdrawn → PostHog, still loaded and opted out,
 * captures again. A tab where PostHog never started is left to the boot sequence, which starts
 * it on a grant.
 */
export function resumeAnalyticsOnConsentGranted(): void {
  if (postHogActive) return;
  import('posthog-js')
    .then(({ default: posthog }) => {
      if (!posthog.__loaded) return;
      posthog.opt_in_capturing();
      postHogActive = true;
    })
    .catch(() => {
      /* analytics must never throw */
    });
}

/** Shared context attached to every captured event (no PII). */
export function getAnalyticsContext(): Record<string, unknown> {
  const auth = useAuthStore.getState();
  const org = useOrganizationStore.getState();

  return {
    [ANALYTICS_SUPER_PROPERTIES.appVersion]: platformConfig.appVersion ?? null,
    [ANALYTICS_SUPER_PROPERTIES.appBuildId]: platformConfig.appBuildId ?? null,
    [ANALYTICS_SUPER_PROPERTIES.environment]: platformConfig.environment,
    is_authenticated: auth.isAuthenticated,
    organization_id: org.organizationId,
    organization_slug: org.organizationSlug,
    organization_type: org.organizationType,
    organization_status: org.organizationStatus,
  };
}

function scrubProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...properties };
  scrubObjectUrls(copy);
  return copy;
}

/**
 * Capture a product analytics event. Consent-gated; no-ops when PostHog is
 * not initialized. Never throws.
 */
export function captureAnalyticsEvent(
  event: AnalyticsEventName,
  properties?: Record<string, unknown>,
): void {
  if (!hasAnalyticsConsent()) return;
  ensurePostHogBootstrapped();

  import('posthog-js')
    .then(({ default: posthog }) => {
      if (!posthog.__loaded) return;
      posthog.capture(
        event,
        scrubProperties({ ...getAnalyticsContext(), ...properties }),
      );
    })
    .catch(() => {
      /* analytics must never throw */
    });
}

/** Register release/build super properties once PostHog is live. */
export function registerPostHogSuperProperties(ph: PostHogClient): void {
  ph.register({
    [ANALYTICS_SUPER_PROPERTIES.appVersion]: platformConfig.appVersion ?? null,
    [ANALYTICS_SUPER_PROPERTIES.appBuildId]: platformConfig.appBuildId ?? null,
    [ANALYTICS_SUPER_PROPERTIES.environment]: platformConfig.environment,
  });
}

/**
 * What PostHog was last told — the identity and the organization group, each as the exact values
 * sent — so a store change that does not change them sends nothing. `identify` and `group` are not
 * free: each one asks PostHog for the feature flags again, and the stores change on every
 * navigation (G-1).
 */
let syncedIdentity: string | null = null;
let syncedGroup: string | null = null;

/** Forget what PostHog was told, so the next sync tells it again (after a `reset`). */
function forgetSyncedIdentity(): void {
  syncedIdentity = null;
  syncedGroup = null;
}

/**
 * Identify the signed-in user (id only) and attach org group analytics — each only when it
 * differs from what PostHog was last told.
 */
function syncPostHogIdentity(ph: PostHogClient): void {
  const user = useAuthStore.getState().user;
  const org = useOrganizationStore.getState();

  if (user) {
    const traits = { role: user.role, has_organization: Boolean(org.organizationId) };
    const identity = JSON.stringify([user.id, traits]);
    if (identity !== syncedIdentity) {
      syncedIdentity = identity;
      ph.identify(user.id, traits);
    }
  }

  if (org.organizationId) {
    const traits = {
      slug: org.organizationSlug,
      type: org.organizationType,
      status: org.organizationStatus,
    };
    const group = JSON.stringify([org.organizationId, traits]);
    if (group !== syncedGroup) {
      syncedGroup = group;
      ph.group(ANALYTICS_ORG_GROUP_TYPE, org.organizationId, traits);
    }
  }
}

/**
 * Subscribe auth/org stores so identity + groups stay in sync.
 *
 * @returns A function that stops following them (tests).
 */
export function attachPostHogIdentitySync(ph: PostHogClient): () => void {
  forgetSyncedIdentity();
  syncPostHogIdentity(ph);
  const stopAuth = useAuthStore.subscribe(() => syncPostHogIdentity(ph));
  const stopOrganization = useOrganizationStore.subscribe(() => syncPostHogIdentity(ph));
  return () => {
    stopAuth();
    stopOrganization();
  };
}

/** Scrub pathname for SPA route analytics (no query string secrets). */
export function scrubAnalyticsPath(pathname: string): string {
  return scrubSensitiveUrl(pathname);
}

/** Emit `route_viewed` on TanStack Router navigations (pathname only). */
export function attachPostHogRouter(ph: PostHogClient, router: AnyRouter): void {
  let lastPath = scrubAnalyticsPath(router.state.location.pathname);

  const emit = (pathname: string) => {
    const path = scrubAnalyticsPath(pathname);
    if (path === lastPath) return;
    lastPath = path;
    if (!ph.__loaded) return;
    ph.capture(
      ANALYTICS_EVENTS.routeViewed,
      scrubProperties({
        ...getAnalyticsContext(),
        path,
        route_id: router.state.matches.at(-1)?.routeId ?? null,
      }),
    );
  };

  emit(router.state.location.pathname);
  router.subscribe('onResolved', () => {
    emit(router.state.location.pathname);
  });
}
