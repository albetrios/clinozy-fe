import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { CaptchaSlot } from '@/shared/auth/captcha/CaptchaSlot.tsx';
import { logout } from '@/shared/auth/service.ts';
import {
  FALLBACK_BUTTON_CLASS,
  FallbackState,
} from '@/shared/components/RouteErrorBoundary/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Lock } from '@/shared/icons/index.ts';

/**
 * The 403, on the public layout's canvas: the public emblem — the wordmark's "o"
 * with a lock inside — "Error 403", "This page isn’t open to your role", the
 * line, and two ways out.
 */
export function Component() {
  const { t } = useTranslation(ERRORS_NS);
  const [signingOut, setSigningOut] = useState(false);
  // `logout()` is single-flight underneath, but the button still owes the user
  // an answer: without this it looks inert on a slow revoke and invites the
  // second click (agent-os/rules/fe-resilient-interactions.mdc section 1).
  const signOutRef = useRef(false);

  const handleSignOut = () => {
    if (signOutRef.current) return;
    signOutRef.current = true;
    setSigningOut(true);
    void logout().finally(() => {
      signOutRef.current = false;
      setSigningOut(false);
    });
  };

  return (
    <div className="flex w-full flex-col items-center" data-testid="unauthorized-page">
      <FallbackState
        headingLevel={1}
        tone="stone"
        icon={<Lock />}
        emblem="locked"
        label={t(ERRORS_KEYS.public.status, { status: 403 })}
        title={t(ERRORS_KEYS.route.forbiddenTitle)}
        description={t(ERRORS_KEYS.route.forbidden)}
        // Two escapes so this page is never a dead-end: "Go Home" for the
        // common case, and a guaranteed "Sign out" for when the resolved home
        // would loop straight back here (e.g. a session whose active org
        // denies its own landing surface).
        actions={
          <>
            <Button asChild className={FALLBACK_BUTTON_CLASS}>
              <Link to="/">{t(ERRORS_KEYS.route.goHome)}</Link>
            </Button>
            <Button
              variant="outline"
              className={FALLBACK_BUTTON_CLASS}
              onClick={handleSignOut}
              disabled={signingOut}
              isLoading={signingOut}
              data-testid="unauthorized-sign-out"
            >
              {t(signingOut ? ERRORS_KEYS.route.signingOut : ERRORS_KEYS.route.signOut)}
            </Button>
          </>
        }
      />

      {/* An escalated background Turnstile challenge renders here, below the actions,
          instead of floating anywhere on its own. */}
      <CaptchaSlot testId="unauthorized-captcha-slot" />
    </div>
  );
}
