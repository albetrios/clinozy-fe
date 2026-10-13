import './index.css';
import '@/lib/i18n/i18n.ts';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { initSentry } from '@/app/observability/sentry.ts';
import {
  preloadBootRoutes,
  preloadSignedInShell,
  router,
} from '@/app/routes/routeTree.tsx';
import { showCriticalUpdate } from '@/app/version/show-critical-update.ts';
import { showUpdateAvailableToast } from '@/app/version/show-update-available-toast.ts';
import { platformConfig } from '@/core/config/env.ts';
import { bootstrapResources } from '@/core/resources/index.ts';
import { startVersionCheck } from '@/core/version/check.ts';
import { startStaleChunkRecovery } from '@/core/version/stale-chunk-recovery.ts';
import {
  afterPaint,
  dismissAppSplash,
  markAppContentPending,
  markAppContentSettled,
  onAppSplashDismissed,
} from '@/lib/app-splash.ts';
import { IDLE_PREFETCH_TIMEOUT_MS } from '@/lib/chunk-prefetch.ts';
import { registerSignedInShellWarmup } from '@/lib/signed-in-shell-warmup.ts';
import {
  purgeAnalyticsOnConsentRevoked,
  resumeAnalyticsOnConsentGranted,
} from '@/shared/analytics/capture.ts';
import { subscribeToAuthBroadcast } from '@/shared/auth/auth-channel.ts';
import { peekTurnstileToken } from '@/shared/auth/captcha/turnstile-token-store.ts';
import {
  establishSession,
  handleCrossTabLogout,
  startAuthBootstrap,
} from '@/shared/auth/service.ts';
import { hasSessionHint } from '@/shared/auth/session-lifetime.ts';
import {
  currentAnalyticsConsent,
  hasAnalyticsConsent,
  useConsentStore,
} from '@/shared/store/useConsentStore/index.ts';
import { resolveOrganizationFromSubdomain } from '@/shared/tenancy/tenancy-service.ts';

import App from './App.tsx';

/**
 * Start cookie-setting analytics (PostHog + web-vitals → PostHog). Idempotent
 * and gated by consent — only ever runs after the user has granted it (boot
 * for returning users, or the moment they Accept the ConsentBanner). Sentry's
 * error reports are NOT here — they run under legitimate interest (no tracking
 * cookies); its session recording and profiling follow the same consent from
 * `app/observability/sentry.ts` (D161).
 */
let analyticsStarted = false;
function startAnalytics(): void {
  if (analyticsStarted || !hasAnalyticsConsent()) return;
  analyticsStarted = true;
  import('@/app/analytics/posthog.ts')
    .then((m) => m.initPostHog(router))
    .catch(() => undefined);
  import('@/app/observability/performance.ts')
    .then((m) => m.initPerformanceMonitoring())
    .catch(() => undefined);
}

/**
 * Initialize observability lazily after splash dismiss + idle. Sentry always;
 * analytics only with consent. Keeps auth funnels off the critical path.
 */
function initObservabilityWhenIdle(): void {
  // Follow the standing decision, from whichever source it changes — the card, Settings, the
  // account's answer at sign-in, another tab, a session's end (D161).
  useConsentStore.subscribe((state, previous) => {
    const granted = currentAnalyticsConsent(state) === 'granted';
    const wasGranted = currentAnalyticsConsent(previous) === 'granted';
    if (granted && !wasGranted) {
      startAnalytics();
      resumeAnalyticsOnConsentGranted();
    }
    if (!granted && wasGranted) purgeAnalyticsOnConsentRevoked();
  });

  const run = () => {
    // sentry.ts is already entry-resident (App.tsx imports reportReactError);
    // the heavy @sentry/react SDK stays lazy behind an import() inside initSentry.
    initSentry(router).catch(() => undefined);
    startAnalytics();
  };

  const scheduleAfterSplash = () => {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(run, { timeout: IDLE_PREFETCH_TIMEOUT_MS });
    } else {
      globalThis.setTimeout(run, 2000);
    }
  };

  afterPaint(() => {
    onAppSplashDismissed(scheduleAfterSplash);
  });
}

// ── 1. Bootstrap: resolve organization → mount React immediately → silent auth in background ──
const root = createRoot(document.getElementById('root')!);

// Resolve organization from subdomain (SYNC — just parses hostname). Seeds the
// derived organization store before anything renders; the URL/guards take over
// once routing starts.
resolveOrganizationFromSubdomain();
bootstrapResources();

// Playwright E2E hooks (`navigateInApp`, `establishSession`, Turnstile readiness).
// Env-gated (VITE_E2E_HOOKS) — on locally, off in every deployed build.
if (platformConfig.e2eHooks) {
  // service.ts and turnstile-token-store.ts are already entry-resident (imported
  // statically by fetch-client / InvisibleTurnstile), so assign directly — no
  // dynamic import() needed (they emitted INEFFECTIVE_DYNAMIC_IMPORT warnings).
  Object.assign(
    globalThis as typeof globalThis & {
      __clinozyFeRouter?: typeof router;
      __clinozyFeEstablishSession?: (accessToken: string) => Promise<void>;
      __clinozyFePeekTurnstileToken?: () => string | undefined;
    },
    {
      __clinozyFeRouter: router,
      __clinozyFeEstablishSession: establishSession,
      __clinozyFePeekTurnstileToken: peekTurnstileToken,
    },
  );
}

// Mount React immediately so user sees app (spinner or login) instead of blank screen.
// Silent refresh runs in background; when it fails, clearAuth() updates store and router reacts.
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Ease out the HTML boot splash once React has painted underneath (no hard cut).
afterPaint(() => dismissAppSplash());

// …and let it go the moment the router has settled on a destination, instead of
// sitting out a fixed grace window over a page that is already rendered. While a
// navigation is in flight (a redirect, the OAuth handoff) the conservative
// window still applies. Both subscriptions end with the splash.
const stopSettled = router.subscribe('onResolved', markAppContentSettled);
const stopPending = router.subscribe('onBeforeNavigate', markAppContentPending);
onAppSplashDismissed(() => {
  stopSettled();
  stopPending();
});

// Attempt silent refresh in background (no backend = fast fail → login screen).
void startAuthBootstrap();

// Warm the destination's chunks WHILE that refresh is in flight — every entry
// route awaits it before the router will load a single component.
// The auth screens know WHEN a visitor commits to signing in; only the route tree
// knows WHICH chunks that lands on. Registered before the form can be interacted
// with, so the first submit already has somewhere to send the warm-up.
registerSignedInShellWarmup(() => void preloadSignedInShell());

preloadBootRoutes({ likelySignedIn: hasSessionHint() });

// Initialize observability/analytics after splash dismiss + idle (auth funnels stay lean).
initObservabilityWhenIdle();

// The analytics consent follows the person: settled at sign-in, saved to the account, forgotten
// when the session ends (D161). Lazy — the sign-in screen's first paint does not wait for it; a
// session restored before it loads is settled when it starts.
import('@/shared/analytics/consent-account-sync.ts')
  .then((m) => m.startConsentAccountSync())
  .catch(() => undefined);

// Recover from a lazy chunk that a newer deploy has already renamed away: one
// reload onto the current build per buildId, never over a field being typed in.
startStaleChunkRecovery();

// Start version check — notify + deferred reload when a new deployment ships (prod only);
// a critical one counts down from the "Update required" notice instead.
startVersionCheck({
  onUpdateAvailable: ({ buildId, reloadNow, snooze }) =>
    showUpdateAvailableToast({ buildId, reloadNow, snooze }),
  onCriticalUpdate: showCriticalUpdate,
});

// Cross-tab logout: when any tab's session dies (admin-suspend, logout-all,
// expiry), every open tab clears its in-memory token and returns to login.
subscribeToAuthBroadcast(handleCrossTabLogout);
