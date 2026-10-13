import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { onAppSplashDismissed } from '@/lib/app-splash.ts';
import { ensureNamespace } from '@/lib/i18n/load-namespace.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import { onceAsync } from '@/lib/lazy-module.ts';
import type { OnboardingSetup } from '@/shared/api/app/onboarding-setup-contracts.ts';
import {
  LazyOverlay,
  LazyOverlaySkeleton,
} from '@/shared/components/LazyOverlay/index.ts';
import {
  useOnboardingSetup,
  useSetupAccess,
  useSetupInvalidation,
} from '@/shared/hooks/useOnboardingSetup/index.ts';
import { LAYOUT_KEYS, LAYOUT_NS } from '@/shared/layouts/layout.constants.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { setupEvents } from './setup-analytics.ts';
import { isSetupHash, setupHash } from './setup-hash-grammar.ts';

const loadSetupSurface = onceAsync(async () => {
  const locale = useLocaleStore.getState().locale;
  const [, , , , module] = await Promise.all([
    ensureNamespace(locale, I18N_NAMESPACES.setup),
    ensureNamespace(locale, I18N_NAMESPACES.app),
    // The days-and-hours line reads the Users room's copy, the invite drawer Settings'.
    ensureNamespace(locale, I18N_NAMESPACES.users),
    ensureNamespace(locale, I18N_NAMESPACES.settings),
    import('./SetupDrawer.tsx'),
  ]);
  return { default: module.SetupDrawer };
});

/** Whether another drawer or dialog is open — the drawer never opens over one by itself. */
function isAnotherOverlayOpen(): boolean {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

/**
 * Opens the drawer by itself once per clinic (KICKOFF §6.1; BRIEF.md:38–40): after the boot
 * splash, for a manager of a team clinic that is neither live nor deferred, with nothing else
 * open — `#setup` with `replace`, so Back leaves the room as it was. Closing it defers it on the
 * server (D5), so it never comes back by itself.
 */
function useSetupAutoOpen({
  setup,
  canManageSetup,
  hash,
}: {
  setup: OnboardingSetup | undefined;
  canManageSetup: boolean;
  hash: string;
}) {
  const navigate = useNavigate();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const openedFor = useRef<string | null>(null);
  const eligible =
    canManageSetup &&
    setup !== undefined &&
    !setup.isLive &&
    setup.deferredAt === null &&
    hash === '' &&
    organizationId !== null;

  useEffect(() => {
    if (!eligible || openedFor.current === organizationId) return;
    return onAppSplashDismissed(() => {
      if (isAnotherOverlayOpen() || window.location.hash !== '') return;
      openedFor.current = organizationId;
      setupEvents.started();
      void navigate({
        to: '.',
        hash: setupHash(),
        search: (previous) => previous,
        replace: true,
      });
    });
  }, [eligible, organizationId, navigate]);
}

/**
 * The setup drawer's host in the organization shell (KICKOFF §4): listens for `#setup[/<step>]`
 * on any room, loads the drawer's chunk only then, and gates itself — a member without
 * `organization:update`, a personal workspace or a View-as preview never sees it (the address is
 * dropped once access is known). It also opens the drawer by itself (G3) and keeps the setup
 * fresh after every write that may tick it.
 */
export function SetupDrawerLazy() {
  const { t } = useTranslation(LAYOUT_NS);
  const hash = useRouterState({ select: (state) => state.location.hash });
  const navigate = useNavigate();
  const { canManageSetup, isResolved } = useSetupAccess();
  const { data: setup } = useOnboardingSetup();
  useSetupInvalidation();
  useSetupAutoOpen({ setup, canManageSetup, hash });

  const isOpen = isSetupHash(hash);
  const close = () =>
    void navigate({ to: '.', hash: '', search: (previous) => previous, replace: true });

  useEffect(() => {
    if (isOpen && isResolved && !canManageSetup) {
      void navigate({ to: '.', hash: '', search: (previous) => previous, replace: true });
    }
  }, [isOpen, isResolved, canManageSetup, navigate]);

  if (!(isOpen && canManageSetup)) return null;
  return (
    <LazyOverlay
      load={loadSetupSurface}
      title={t(LAYOUT_KEYS.app.setup.drawerName)}
      testId="setup-drawer-load-error"
      onDismiss={close}
      pending={
        <LazyOverlaySkeleton className="max-w-md p-6">
          <h2 className="text-lg font-semibold">{t(LAYOUT_KEYS.app.setup.drawerName)}</h2>
        </LazyOverlaySkeleton>
      }
    />
  );
}
