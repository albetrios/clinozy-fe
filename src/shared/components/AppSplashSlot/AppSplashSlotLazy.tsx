import { useRouterState } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  holdAppSplash,
  isAppSplashActive,
  labelAppSplash,
  onAppSplashDismissed,
} from '@/lib/app-splash.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import { onceAsync } from '@/lib/lazy-module.ts';
import { parseOrganizationSlugParam } from '@/lib/routes/params.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import { readOnline, useOnlineStatus } from '@/shared/hooks/useOnlineStatus/index.ts';

/*
 * The one key this entry-resident shell reads (`SPLASH_KEYS.label` in `common`),
 * declared here so the entry chunk does not carry the slot's whole key and test-id
 * table (`app-splash.constants.ts`, which the lazy slot imports). The shell's
 * "names the splash with the translated label" test fails if it drifts.
 */
const SPLASH_LABEL = { ns: I18N_NAMESPACES.common, key: 'splash.label' } as const;

const loadSplashSlot = onceAsync(() => import('./AppSplashSlot.tsx'));

const AppSplashSlot = lazy(() =>
  loadSplashSlot().then((m) => ({ default: m.AppSplashSlot })),
);

/**
 * Keeps the splash up while the slot's chunk loads: on a fast boot (reduced
 * motion may leave from 500ms) the splash would otherwise be gone before the
 * greeting it was about to show.
 */
function HoldWhileLoading() {
  useLayoutEffect(() => holdAppSplash(), []);
  return null;
}

/**
 * `/organization/<slug>` and everything under it — the org layout, whose first
 * load plays the greeting block (`S:20`). The picker (`/organization`) is not.
 */
function isOrganizationLayoutPath(pathname: string): boolean {
  const [, root, slug] = pathname.split('/');
  return (
    root === 'organization' &&
    slug !== undefined &&
    parseOrganizationSlugParam(slug) !== null
  );
}

/**
 * The boot splash's React side, off the first-paint path. Mounted on the ROOT
 * route, so it is in the entry chunk: it only names the splash (the translated
 * `role="status"` label) and decides whether the slot has anything to say — the
 * slot itself (`AppSplashSlot`) loads on demand, for a boot that lands in the
 * org layout or a device that is offline. A guest's `/login` boot never fetches
 * it: those boots show frames 1–4 only (Q-S1).
 *
 * While the slot loads it holds the splash, like any boot loader: the greeting is
 * part of the boot it plays on. Gone with the splash: after the exit it renders
 * nothing, so a later render can never resurrect it. Failure is silent — a slot
 * that cannot load leaves the frames and the normal exit, never a held splash
 * with no Retry on it.
 */
export function AppSplashSlotLazy() {
  const { t } = useTranslation(SPLASH_LABEL.ns);
  const [active, setActive] = useState(isAppSplashActive);
  // "Offline at mount" (`splash.md:45`) — this is the app's mount.
  const [offlineAtMount] = useState(() => !readOnline());
  const online = useOnlineStatus();
  const greets = useRouterState({
    select: (state) => isOrganizationLayoutPath(state.location.pathname),
  });

  useLayoutEffect(() => {
    if (active) labelAppSplash(t(SPLASH_LABEL.key));
  }, [active, t]);

  useEffect(() => {
    if (!active) return;
    return onAppSplashDismissed(() => setActive(false));
  }, [active]);

  if (!(active && (greets || offlineAtMount || !online))) return null;

  return (
    <SectionErrorBoundary title={t(SPLASH_LABEL.key)} variant="silent">
      <Suspense fallback={<HoldWhileLoading />}>
        <AppSplashSlot offlineAtMount={offlineAtMount} greets={greets} />
      </Suspense>
    </SectionErrorBoundary>
  );
}
