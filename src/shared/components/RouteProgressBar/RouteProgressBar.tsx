import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { LOCALE_KEYS, LOCALE_NS } from '@/lib/i18n/locale.constants.ts';
import { ProgressLine } from '@/shared/components/ProgressLine/index.ts';

/**
 * Thin top-edge progress bar shown while the router resolves a navigation
 * (beforeLoad guards, loaders, lazy chunks). Gives feedback for in-app
 * transitions — e.g. switching organizations — WITHOUT blanking the page to a
 * full-screen spinner, so the current screen stays put until the next is ready.
 * The shared indeterminate {@link ProgressLine}, pinned to the top edge;
 * honours reduced-motion via the global rule.
 */
export function RouteProgressBar() {
  const { t } = useTranslation(LOCALE_NS);
  const isNavigating = useRouterState({ select: (s) => s.status === 'pending' });
  if (!isNavigating) return null;
  return (
    <ProgressLine
      label={t(LOCALE_KEYS.loadingPage)}
      testId="route-progress"
      className="fixed inset-x-0 top-0 z-[60]"
    />
  );
}
