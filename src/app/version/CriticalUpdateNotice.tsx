import { useEffect, useState } from 'react';

import { formatCountdown, secondsUntil } from '@/lib/countdown.ts';
import i18n from '@/lib/i18n/i18n.ts';
import { useAppSplashActive } from '@/shared/hooks/useAppSplashActive/index.ts';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus/index.ts';
import { type CriticalUpdate, useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  CRITICAL_UPDATE_TEST_IDS,
  VERSION_UPDATE_KEYS,
  VERSION_UPDATE_NS,
} from './version-update.constants.ts';

const keys = VERSION_UPDATE_KEYS.required;

/**
 * The notice's copy through the shared i18n instance, as the "Update available"
 * toast reads it — not `useTranslation`: importing react-i18next from this lazy
 * chunk split the hook into a first-paint chunk of its own (+0.3 kB gzipped).
 * The clock re-renders every second, so a language change still lands.
 */
const t = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: VERSION_UPDATE_NS, ...options });

/** The whole seconds left until `deadline`, re-read once a second. */
function useSecondsLeft(deadline: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(tick);
  }, []);
  return secondsUntil(deadline, now);
}

/**
 * The pill itself, mounted only while an update counts down, so its clock
 * starts with it. The countdown is visual only: the one `role="alert"` is a
 * sentence fixed at mount, so a screen reader hears the deadline once, not a
 * number every second.
 *
 * `z-[60]`, one tier over the cookie card and the offline pill (`z-50`): the
 * cookie card spans a phone's width at the bottom and would hide the notice,
 * and a deadline outranks a one-time choice the reload brings back anyway.
 * Still under the workspace-switch overlay, the upload tray and the toasts.
 */
function CriticalUpdatePill({ reloadAt, reloadNow }: CriticalUpdate) {
  const seconds = useSecondsLeft(reloadAt);
  const time = formatCountdown(seconds);
  const [announcement] = useState(() =>
    t(keys.announcement, { time: formatCountdown(secondsUntil(reloadAt)) }),
  );

  return (
    <div
      data-testid={CRITICAL_UPDATE_TEST_IDS.notice}
      data-slot="pill"
      className="bg-primary text-primary-foreground text-body animate-dropdown-up fixed bottom-[calc(var(--floating-bottom-offset,0rem)+1rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex h-11 max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full ps-4 pe-1.5 shadow-(--elevation-fab)"
    >
      <span aria-hidden="true" className="bg-warning size-2 flex-none rounded-full" />
      <span className="font-semibold whitespace-nowrap">{t(keys.title)}</span>
      {/* A phone has room for the time, not the sentence — "Reloading …" would
          truncate away the one thing that matters. The sentence from `sm`. */}
      <span
        data-testid={CRITICAL_UPDATE_TEST_IDS.time}
        className="text-disabled text-xs whitespace-nowrap tabular-nums sm:hidden"
      >
        {time}
      </span>
      <span className="text-disabled hidden min-w-0 truncate text-xs tabular-nums sm:inline">
        {seconds > 0 ? t(keys.countdown, { time }) : t(keys.saveFirst)}
      </span>
      <button
        type="button"
        data-testid={CRITICAL_UPDATE_TEST_IDS.updateNow}
        data-slot="pill"
        onClick={reloadNow}
        className="bg-canvas text-foreground hover:bg-border h-8 flex-none rounded-full px-3 text-xs font-medium transition-colors"
      >
        {t(keys.updateNow)}
      </button>
      <span role="alert" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

/**
 * "Update required" — the critical update's notice (`showCriticalUpdate`): the
 * design's notice pill (`shell.md:63`, as `OfflineIndicator`), counting down to
 * the reload with an "Update now" button. It cannot be dismissed, and it does not
 * cover the page: the user can still press Save before the deadline, and
 * unsaved drawers, Settings and onboarding keep the browser's own leave prompt.
 * Mounted at the root, so it reaches the sign-in screens too.
 *
 * Not while offline — `OfflineIndicator` holds the slot, and the checker waits
 * for the network before reloading — nor under the boot splash, where a
 * critical update reloads at once.
 */
export function CriticalUpdateNotice() {
  const update = useUIStore((state) => state.criticalUpdate);
  const online = useOnlineStatus();
  const splashActive = useAppSplashActive();

  if (!(update && online) || splashActive) return null;
  return <CriticalUpdatePill {...update} />;
}
