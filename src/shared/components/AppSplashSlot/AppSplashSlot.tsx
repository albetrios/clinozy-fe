import { skipToken, useQuery } from '@tanstack/react-query';
import { type CSSProperties, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import {
  appSplashElapsedMs,
  appSplashSlotHost,
  holdAppSplash,
  holdAppSplashOffline,
  reloadFromAppSplash,
  SPLASH_BLOCK_AT_MS,
} from '@/lib/app-splash.ts';
import { zonedClockParts } from '@/lib/i18n/format.ts';
import { cn } from '@/lib/utils.ts';
import { CLINIC_TIME_ZONE } from '@/shared/api/clinic/clinic-time.ts';
import { greetingFor } from '@/shared/clinic/clinic-greeting.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus/index.ts';
import { type MeContext, meContextQueryKey } from '@/shared/tenancy/me-context.ts';

import { SPLASH_KEYS, SPLASH_NS, SPLASH_TEST_IDS } from './app-splash.constants.ts';

/** What the boot knows when the slot mounts — see {@link AppSplashSlot}. */
export interface AppSplashSlotProps {
  /** `navigator.onLine === false` when the app mounted: the splash holds until Retry. */
  offlineAtMount: boolean;
  /** The boot lands in the org layout, whose first load plays the greeting (`S:20`). */
  greets: boolean;
}

/**
 * The signed-in user's first name, "Dr." and all (`S:192`, `S:209`) — read from
 * the session the boot is already restoring, never fetched here: a second
 * `me/context` request racing the auth bootstrap would be pure noise.
 */
function useSignedInFirstName(): string | null {
  const { data } = useQuery<MeContext>({
    queryKey: meContextQueryKey,
    queryFn: skipToken,
  });
  if (!data) return null;
  const firstName = data.user.firstName?.trim();
  // A blank first name falls back to the address's local part, and a blank one of those to none.
  return firstName || data.user.email.split('@')[0] || null; // NOSONAR(S6606): "" must fall back too
}

/**
 * The block's beat, measured now: 1,900ms into the splash, or at once when the
 * session landed after it ("the block fades in when ready", Q-S1). `at` is when
 * it was measured — the delay counts from there.
 */
function blockTiming(): { at: number; style: CSSProperties } {
  const at = performance.now();
  const delay = Math.max(0, Math.round(SPLASH_BLOCK_AT_MS - appSplashElapsedMs()));
  return { at, style: { '--app-splash-block-delay': `${delay}ms` } as CSSProperties };
}

/** The ticker's three lines (`splash.md:95–97`), the weekday on the clinic's calendar. */
function TickerSteps({ weekday }: { weekday: string }) {
  const { t } = useTranslation(SPLASH_NS);
  // Grey dots on the way, the success dot on "All set".
  const steps = [
    {
      id: 'opening',
      label: t(SPLASH_KEYS.ticker.opening, { weekday }),
      dot: 'bg-border-strong',
    },
    { id: 'syncing', label: t(SPLASH_KEYS.ticker.syncing), dot: 'bg-border-strong' },
    { id: 'ready', label: t(SPLASH_KEYS.ticker.ready), dot: 'bg-success' },
  ];
  return (
    <span className="app-splash-reel" data-testid={SPLASH_TEST_IDS.ticker}>
      {steps.map((step) => (
        <span key={step.id} className="app-splash-step text-detail text-muted-foreground">
          <span className={cn('app-splash-step-dot', step.dot)} />
          {step.label}
        </span>
      ))}
    </span>
  );
}

/**
 * The greeting block (frames 5–6): the greeting, then the progress bar and
 * ticker — or, offline, the notice and Retry instead. Mounted the moment it has
 * something to say, and timed against the splash's own clock.
 */
function SplashBlock({
  greeting,
  offline,
}: {
  greeting: string | null;
  offline: boolean;
}) {
  const { t } = useTranslation(SPLASH_NS);
  const { formatDate } = useLocaleFormat();
  const blockRef = useRef<HTMLDivElement>(null);
  const [timing] = useState(blockTiming);
  // The delay was measured at render; the browser would start counting it from
  // its next frame after the commit — a dev-mode render later, the block rose
  // ~150ms off the beat. Start the block's animations at the measuring instant.
  useLayoutEffect(() => {
    const block = blockRef.current;
    if (!block || typeof block.getAnimations !== 'function') return;
    for (const animation of block.getAnimations({ subtree: true })) {
      animation.startTime = timing.at;
    }
  }, [timing.at]);
  // The clinic-local calendar, read once: a greeting must not flip mid-splash.
  const [weekday] = useState(() => {
    const clinic = zonedClockParts(new Date(), CLINIC_TIME_ZONE);
    return formatDate(
      new Date(clinic.year, clinic.month - 1, clinic.day),
      { weekday: 'long' },
      { civilDay: true },
    );
  });

  return (
    <div
      ref={blockRef}
      className="app-splash-block"
      style={timing.style}
      data-testid={SPLASH_TEST_IDS.block}
    >
      {greeting === null ? null : (
        <span
          className="text-title text-primary font-medium whitespace-nowrap"
          data-testid={SPLASH_TEST_IDS.greeting}
        >
          {greeting}
        </span>
      )}
      {offline ? (
        <div
          role="alert"
          className="app-splash-notice"
          data-testid={SPLASH_TEST_IDS.offline}
        >
          <span className="text-detail text-muted-foreground-strong whitespace-nowrap">
            {t(SPLASH_KEYS.offline.message)}
          </span>
          <Button
            type="button"
            variant="outline"
            className="text-body text-primary hover:bg-muted dark:bg-background dark:hover:bg-muted h-9 rounded-lg px-3.5 shadow-none"
            data-testid={SPLASH_TEST_IDS.retry}
            onClick={reloadFromAppSplash}
          >
            {t(SPLASH_KEYS.offline.retry)}
          </Button>
        </div>
      ) : (
        <div className="app-splash-progress" data-testid={SPLASH_TEST_IDS.progress}>
          <span
            className="app-splash-track bg-muted-strong"
            data-slot="pill"
            aria-hidden="true"
          >
            <span
              className="app-splash-bar bg-primary"
              data-slot="pill"
              data-testid={SPLASH_TEST_IDS.bar}
            />
          </span>
          {/* Fixed copy on a timer (D15), not live status — announcing all three
              lines at once would only say "All set" before it is. */}
          <span className="app-splash-ticker" aria-hidden="true">
            <TickerSteps weekday={weekday} />
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * The boot splash's React slot (KICKOFF §6.1): renders the greeting block into
 * `#app-splash` once i18n and the session are ready — the HTML carries no copy
 * (Q-S1). On the first load of the org layout it greets the user by name on the
 * clinic-local clock (D15) and runs the progress bar and ticker; offline at mount
 * it shows the notice and Retry and holds the splash until a reload
 * (`holdAppSplashOffline`). Mounted, lazily, by `AppSplashSlotLazy`.
 */
export function AppSplashSlot({ offlineAtMount, greets }: AppSplashSlotProps) {
  const { t } = useTranslation(SPLASH_NS);
  const [host] = useState(appSplashSlotHost);
  const online = useOnlineStatus();
  const firstName = useSignedInFirstName();
  // Decided at mount; re-read on render only to SHOW the notice, never to drop
  // a hold that only Retry may lift.
  const offline = offlineAtMount || !online;

  useLayoutEffect(
    () => (offlineAtMount ? holdAppSplashOffline() : undefined),
    [offlineAtMount],
  );

  // On the org layout's first load the greeting is part of the boot: hold the
  // splash until the session lands and the block is on it. Leaving the layout
  // (a guest sent to sign in) unmounts the slot, which lets go.
  const awaitingSession = greets && !offline && firstName === null;
  useLayoutEffect(
    () => (awaitingSession ? holdAppSplash() : undefined),
    [awaitingSession],
  );

  const [clinicHour] = useState(() => zonedClockParts(new Date(), CLINIC_TIME_ZONE).hour);
  const greeting =
    greets && firstName
      ? t(SPLASH_KEYS.greeting[greetingFor(clinicHour)], { name: firstName })
      : null;

  if (!(host && (offline || greeting))) return null;
  return createPortal(<SplashBlock greeting={greeting} offline={offline} />, host);
}
