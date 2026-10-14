import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import { onceAsync } from '@/lib/lazy-module.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

// The widget's copy (`app` › `bugReport`, `bug-report.constants.ts`) is fetched with its chunk so
// the trigger never draws a key.
const loadBugReport = onceAsync(async () => {
  const [, module] = await Promise.all([
    ensureNamespace(useLocaleStore.getState().locale, I18N_NAMESPACES.app),
    import('./BugReport.tsx'),
  ]);
  return module;
});

const BugReportWidget = lazy(() =>
  loadBugReport().then((m) => ({ default: m.BugReport })),
);

/**
 * Report a bug, off the shell's critical path, for a signed-in person only — the backend stamps
 * the reporter from the session, so with no session there is nobody to report as (iteration
 * feat-bug-report-2026-10-13-dgnx D8).
 *
 * Failure is silent on purpose, like the cookie card's: a broken widget in a fixed corner has
 * nowhere sensible to show an error card. The throw is still reported by the boundary.
 */
export function BugReportLazy() {
  const { t } = useTranslation(ERRORS_NS);
  const signedIn = useAuthStore((state) => state.user !== null);

  if (!signedIn) return null;

  return (
    <SectionErrorBoundary title={t(ERRORS_KEYS.widget.unavailable)} variant="silent">
      <Suspense fallback={null}>
        <BugReportWidget />
      </Suspense>
    </SectionErrorBoundary>
  );
}
