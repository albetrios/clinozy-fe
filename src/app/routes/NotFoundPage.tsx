import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { composePageTitle } from '@/lib/routes/page-head.ts';
import { CaptchaSlot } from '@/shared/auth/captcha/CaptchaSlot.tsx';
import { TonePill } from '@/shared/components/Cells/TonePill/index.ts';
import { PublicFrame } from '@/shared/components/PublicFrame/index.ts';
import {
  FALLBACK_BUTTON_CLASS,
  FallbackState,
} from '@/shared/components/RouteErrorBoundary/index.ts';
import { ThemeModeToggle } from '@/shared/components/ThemeModeToggle/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Compass } from '@/shared/icons/index.ts';

/**
 * The 404 (the `$` splat and every `notFound()`): the signed-out canvas with the
 * design's empty state on it — the stone illustration, the status as a neutral
 * pill inside the page's heading, "Page not found", the line and "Go home".
 */
export function Component() {
  const { t } = useTranslation(ERRORS_NS);
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
        title={
          <>
            <TonePill tone="neutral" size="sm" className="tabular-nums">
              404
            </TonePill>
            {t(ERRORS_KEYS.route.pageNotFound)}
          </>
        }
        description={t(ERRORS_KEYS.route.notFound)}
        actions={
          <Button asChild className={FALLBACK_BUTTON_CLASS}>
            <Link to="/">{t(ERRORS_KEYS.route.goHome)}</Link>
          </Button>
        }
      />

      {/* An escalated background Turnstile challenge renders here, below the action,
          instead of floating anywhere on its own. */}
      <CaptchaSlot testId="not-found-captcha-slot" />
    </PublicFrame>
  );
}
