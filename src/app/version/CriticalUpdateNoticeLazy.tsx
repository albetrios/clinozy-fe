import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';

import { onceAsync } from '@/lib/lazy-module.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { VERSION_UPDATE_KEYS, VERSION_UPDATE_NS } from './version-update.constants.ts';

const loadCriticalUpdateNotice = onceAsync(() => import('./CriticalUpdateNotice.tsx'));

const CriticalUpdateNoticePill = lazy(() =>
  loadCriticalUpdateNotice().then((m) => ({ default: m.CriticalUpdateNotice })),
);

/**
 * The "Update required" notice, off the first-paint path. It is mounted on the
 * ROOT route, and almost no load ever shows it, so a static import would put it
 * in the entry chunk of every load for a surface seen once in many releases. It
 * loads the moment a critical update starts counting down; the service worker
 * precaches the chunk, so it is still there after the deploy took it off the CDN.
 *
 * Failure is silent on purpose: the checker reloads at the deadline whatever the
 * notice does, so a missing notice costs the warning, never the update — and the
 * boundary still reports the throw.
 */
export function CriticalUpdateNoticeLazy() {
  const { t } = useTranslation(VERSION_UPDATE_NS);
  const countingDown = useUIStore((state) => state.criticalUpdate !== null);

  if (!countingDown) return null;

  return (
    <SectionErrorBoundary title={t(VERSION_UPDATE_KEYS.required.title)} variant="silent">
      <Suspense fallback={null}>
        <CriticalUpdateNoticePill />
      </Suspense>
    </SectionErrorBoundary>
  );
}
