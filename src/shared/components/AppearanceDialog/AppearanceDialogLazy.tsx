import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  isAuthenticatedAppSurface,
  useAuthenticatedIdleChunkPrefetch,
} from '@/lib/chunk-prefetch.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { LazyOverlay } from '@/shared/components/LazyOverlay/index.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { APPEARANCE_TEST_IDS } from './appearance-dialog.constants.ts';
import { loadAppearanceDialog } from './appearance-dialog-loader.ts';
import { AppearanceDialogPending } from './appearance-dialog-pending.tsx';

/**
 * The root route's Appearance mount — and all of it that rides the entry chunk:
 * the open flag, the idle prefetch on signed-in app surfaces, and the drawer's
 * placeholder. The drawer itself (with the record drawer under it) loads on
 * demand through {@link LazyOverlay}: a placeholder while the chunk is in
 * flight, Esc or the × out of a stalled one, a contained Retry card for a
 * failed one. Nothing mounts while it is closed.
 */
export function AppearanceDialogLazy() {
  const { t } = useTranslation(ERRORS_NS);
  const open = useUIStore((s) => s.appearanceOpen);
  const setOpen = useUIStore((s) => s.setAppearanceOpen);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAuthLoading = useAuthStore((s) => s.isLoading);

  useAuthenticatedIdleChunkPrefetch(
    loadAppearanceDialog,
    !open && isAuthenticatedAppSurface(pathname, isAuthenticated, isAuthLoading),
  );

  if (!open) return null;

  const close = () => setOpen(false);
  return (
    <LazyOverlay
      load={loadAppearanceDialog}
      title={t(ERRORS_KEYS.widget.appearance)}
      testId={APPEARANCE_TEST_IDS.loadError}
      onDismiss={close}
      pending={<AppearanceDialogPending onClose={close} />}
    />
  );
}
