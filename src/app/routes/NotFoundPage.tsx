import { Link, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { composePageTitle } from '@/lib/routes/page-head.ts';
import { CaptchaSlot } from '@/shared/auth/captcha/CaptchaSlot.tsx';
import { PublicFrame } from '@/shared/components/PublicFrame/index.ts';
import {
  FALLBACK_BUTTON_CLASS,
  FallbackState,
} from '@/shared/components/RouteErrorBoundary/index.ts';
import { ThemeModeToggle } from '@/shared/components/ThemeModeToggle/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Compass } from '@/shared/icons/index.ts';

/** True when this tab has a page to go back to (a link opened in a new tab has none). */
function canGoBack(): boolean {
  return typeof window !== 'undefined' && window.history.length > 1;
}

/**
 * The 404 (the `$` splat and every `notFound()`): the signed-out canvas with the
 * public emblem on it — the wordmark's "o" with its dot gone astray — "Error 404",
 * "We can’t find that page", the line, "Go home" and, when this tab has a page
 * to return to, "Go back".
 */
export function Component() {
  const { t } = useTranslation(ERRORS_NS);
  const router = useRouter();
  // Set the title here, not only on the `$` route's head: notFound() thrown
  // from a beforeLoad guard renders via rootRoute.notFoundComponent, where
  // no route head applies — without this the previous page's title sticks
  // (and the RouteAnnouncer would announce that stale title).
  useEffect(() => {
    document.title = composePageTitle('Page not found');
  }, []);

  return (
    <PublicFrame
      testId="not-found-page"
      mainId="not-found-main"
      controls={<ThemeModeToggle surface="frame" />}
    >
      <FallbackState
        headingLevel={1}
        tone="stone"
        icon={<Compass />}
        emblem="missing"
        label={t(ERRORS_KEYS.public.status, { status: 404 })}
        title={t(ERRORS_KEYS.public.missingTitle)}
        description={t(ERRORS_KEYS.route.notFound)}
        actions={
          <>
            <Button asChild className={FALLBACK_BUTTON_CLASS}>
              <Link to="/">{t(ERRORS_KEYS.route.goHome)}</Link>
            </Button>
            {canGoBack() ? (
              <Button
                type="button"
                variant="outline"
                className={FALLBACK_BUTTON_CLASS}
                onClick={() => router.history.back()}
                data-testid="not-found-back"
              >
                {t(ERRORS_KEYS.public.goBack)}
              </Button>
            ) : null}
          </>
        }
      />

      {/* An escalated background Turnstile challenge renders here, below the action,
          instead of floating anywhere on its own. */}
      <CaptchaSlot testId="not-found-captcha-slot" />
    </PublicFrame>
  );
}
