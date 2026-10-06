import { useTranslation } from 'react-i18next';

import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import { useAppSplashActive } from '@/shared/hooks/useAppSplashActive/index.ts';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus/index.ts';

/**
 * The splash's offline line (`splash.offline.message`, in `common`). Declared
 * here, not imported from the splash's key table: this indicator is mounted by
 * the root route, so it is entry-resident, and the table would bring every
 * splash key with it. `OfflineIndicator.test.tsx` pins the text to `SPLASH_KEYS`.
 */
const OFFLINE_MESSAGE_KEY = 'splash.offline.message';

/**
 * Offline indicator — shows a notice when the user loses connectivity and
 * auto-dismisses when it returns. The design's notice pill (`shell.md:63`, the
 * shape it gives every system notice): the ink pill, 44px, centred at the
 * bottom — above the phone tab bar — with a red status dot and the splash's
 * own offline line, "Can’t reach Clinozy · check the internet connection".
 * Uses role="alert" and aria-live for screen reader announcement.
 *
 * Not while the boot splash covers the page: offline at mount, the splash holds
 * with that same line and its Retry, and the pill under it — invisible, the app
 * renders at opacity 0 there — would be a second assertive alert saying it again.
 */
export function OfflineIndicator() {
  const online = useOnlineStatus();
  const splashActive = useAppSplashActive();
  const { t } = useTranslation(I18N_NAMESPACES.common);

  if (online || splashActive) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="offline-indicator"
      data-slot="pill"
      className="bg-primary text-primary-foreground text-body animate-dropdown-up fixed bottom-[calc(var(--floating-bottom-offset,0rem)+1rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex h-11 max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full ps-4 pe-5 font-medium shadow-(--elevation-fab)"
    >
      <span aria-hidden="true" className="bg-destructive size-2 flex-none rounded-full" />
      <span className="min-w-0 truncate">{t(OFFLINE_MESSAGE_KEY)}</span>
    </div>
  );
}
