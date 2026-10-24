import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';

import { ANALYTICS_EVENTS } from '@/shared/analytics/analytics.constants.ts';
import { captureAnalyticsEvent } from '@/shared/analytics/capture.ts';
import { MfaRequiredError } from '@/shared/api/auth-api.ts';
import { AUTH_KEYS } from '@/shared/auth/auth-shell.constants.ts';
import { skipAutoGoogleSignIn } from '@/shared/auth/auto-google-sign-in.ts';
import { stashMfaHandoff } from '@/shared/auth/mfa-handoff.ts';
import {
  completeOAuthSignIn,
  readOAuthCallbackParams,
  takeOAuthCallbackSignIn,
} from '@/shared/auth/oauth-callback-sign-in.ts';
import { popReturnTo } from '@/shared/auth/redirect-safety.ts';
import { silentRefresh } from '@/shared/auth/service.ts';
import { hasSessionHint } from '@/shared/auth/session-lifetime.ts';
import { FullPageSpinner } from '@/shared/components/FullPageSpinner/index.ts';
import { UnauthorizedError } from '@/shared/errors/AppError.ts';
import { mapFrontendError } from '@/shared/errors/map-frontend-error.ts';
import { notify } from '@/shared/notify/index.ts';

import { CALLBACK_TEST_IDS } from './callback.constants.ts';

/**
 * The no-code fallback: restore a session this browser may still hold.
 *
 * With no session hint the browser has never signed in, or has signed out, so
 * there is nothing on the server to restore — the refresh could only answer 401,
 * which the browser logs as a console error on every direct visit and every
 * provider denial. It fails the way that 401 would, without the round trip: the
 * call `startAuthBootstrap` makes. The hint never authorizes — when it is present
 * the refresh still decides.
 *
 * @throws {UnauthorizedError} with no session hint; whatever `silentRefresh()`
 *   throws otherwise.
 */
async function restoreExistingSession(): Promise<void> {
  if (!hasSessionHint()) {
    throw new UnauthorizedError(AUTH_KEYS.auth.errors.oauthFailed);
  }
  await silentRefresh();
}

/**
 * Provider-specific OAuth landing page (`/callback/$provider`, e.g.
 * `/callback/google`). Each provider registers its own URL, so the path itself
 * names the provider that is returning — the route guard has already validated
 * the slug. The page forwards `code`+`state` to clinozy-be's callback route, which
 * consumes the CSRF state, exchanges the code, and sets the refresh-session
 * cookie on that XHR response. Without `code`+`state` (direct visit, provider
 * denial) it falls back to `silentRefresh()` so an already-signed-in visitor
 * still lands in the app — when this browser has signed in at all (the session
 * hint); otherwise it goes straight back to `/login` without asking the server.
 */
export function CallbackPage() {
  const navigate = useNavigate();
  const { provider: rawProvider } = useParams({ strict: false });
  const started = useRef(false);
  /**
   * Whether this page is still the one on screen. Deliberately re-armed at the
   * TOP of every effect run, before the `started` bail: StrictMode's
   * mount → cleanup → mount would otherwise leave it false from the first run's
   * cleanup while the second run bails early, and the exchange already in
   * flight would resolve into a page that thinks it is gone.
   */
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    if (!started.current) {
      started.current = true;
      void runCallback();
    }

    async function runCallback() {
      const { code, state, provider } = readOAuthCallbackParams(rawProvider);

      const finishSignIn = () => {
        // The user may have left while the exchange was in flight (a back
        // gesture is enough). The session is established either way — that part
        // is not ours to undo — but yanking them off the page they just opened,
        // and logging a completion for a screen nobody is looking at, is (CB-2).
        if (!aliveRef.current) return;
        captureAnalyticsEvent(ANALYTICS_EVENTS.authOauthCompleted);
        captureAnalyticsEvent(ANALYTICS_EVENTS.sessionStarted, { method: 'oauth' });
        const returnTo = popReturnTo();
        void navigate({ to: returnTo ?? '/', replace: true });
      };
      /**
       * The ONLY exit for a failed sign-in, so it is the one place that has to
       * say so. This used to be a bare redirect out of an empty catch: the user
       * watched a spinner, landed back on a plain login form with no toast, no
       * banner and no hint that Google/GitHub had failed — and retried the same
       * broken flow. Nothing was recorded either, so the funnel showed only the
       * two success events and the drop-off was invisible (CB-1).
       */
      const failToLogin = (error: unknown) => {
        if (!aliveRef.current) return;
        skipAutoGoogleSignIn();
        captureAnalyticsEvent(ANALYTICS_EVENTS.authOauthFailed, {
          provider: provider ?? 'unknown',
        });
        notify.error(mapFrontendError(error));
        // A code, not a message: this text would otherwise come from a provider
        // redirect. /login maps it to its own translated banner copy.
        void navigate({ to: '/login', search: { error: 'oauth_failed' }, replace: true });
      };

      if (code && state && provider) {
        try {
          // Usually already under way: main.tsx starts the exchange at boot, beside the
          // app's own download (`oauth-callback-sign-in.ts`). The code is single-use, so
          // the page exchanges it only when the boot did not.
          await (takeOAuthCallbackSignIn(provider, state) ??
            completeOAuthSignIn(provider, { code, state }));
        } catch (error) {
          if (error instanceof MfaRequiredError) {
            // Stash regardless — the hand-off token is worth keeping even if we
            // no longer own the screen — but only navigate if we still do.
            stashMfaHandoff(error.mfaSessionToken, popReturnTo() ?? '/');
            if (!aliveRef.current) return;
            void navigate({ to: '/mfa', replace: true });
            return;
          }
          failToLogin(error);
          return;
        }
        finishSignIn();
        return;
      }

      try {
        await restoreExistingSession();
      } catch (error) {
        failToLogin(error);
        return;
      }
      finishSignIn();
    }

    return () => {
      aliveRef.current = false;
    };
  }, [navigate, rawProvider]);

  return (
    <div data-testid={CALLBACK_TEST_IDS.page}>
      <FullPageSpinner />
    </div>
  );
}
