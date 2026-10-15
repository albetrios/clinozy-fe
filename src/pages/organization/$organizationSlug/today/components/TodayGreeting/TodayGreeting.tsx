import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { appClockTime, appToday } from '@/shared/api/app/app-time.ts';
import { greetingFor } from '@/shared/app/app-greeting.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { appWallClock, useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { Keyboard } from '@/shared/icons/index.ts';

import { TODAY_KEYS, TODAY_NS, TODAY_TEST_IDS } from '../../today.constants.ts';

/** Props for {@link TodayGreeting}. */
export interface TodayGreetingProps {
  /** The signed-in member's first name ("Dr." kept); null reads "there". */
  firstName: string | null;
  /** The clock the greeting and the pulse read. */
  now: Date;
  /** The pulse's counts (`todayPulse`). */
  counts: { inClinic: number; waiting: number; arriving: number };
  /** "New booking" — absent without Leads Create (§3.7). */
  onNewBooking?: () => void;
  /** "Walk-in" — the command menu; absent without Appointments Create (F4, D163). */
  onWalkIn?: () => void;
  /** The floor finder, between the pulse and the buttons (change-today-command-center). */
  finder?: ReactNode;
  /** The keyboard button: the app's shortcuts list (from `md`). */
  onShortcuts?: () => void;
}

/** The buttons' frame (`today.md:18`): 32px, 13px, `rounded-lg`. */
const BUTTON = 'h-8 rounded-lg px-3.5 text-body leading-[normal]';

/** Walk-in, the outline button: transparent, hover `accent`. */
const OUTLINE = 'bg-transparent font-normal shadow-none dark:bg-transparent';

/**
 * The greeting row (KICKOFF §6.2; `today.md:18`; H:579–584): "Good morning,
 * <first name>" on the clinic-local clock — the screen's title, so it is the
 * page's h1 — the pulse after a live dot ("● 6 in clinic · 2 waiting · 3
 * arriving · Sat 3 Oct, 10:42", the clinic's day and time in the viewer's
 * format and hour cycle; the floor refreshes every minute) under it; at the
 * inline end, on one line from `md`, the floor finder, the keyboard button,
 * "Walk-in" and the primary "New booking" (change-today-command-center). On a
 * phone: the greeting, the pulse, the finder across the width, the buttons.
 */
export function TodayGreeting({
  firstName,
  now,
  counts,
  onNewBooking,
  onWalkIn,
  finder,
  onShortcuts,
}: TodayGreetingProps) {
  const { t } = useTranslation(TODAY_NS);
  const { formatDate, formatNumber } = useLocaleFormat();
  const clock = useAppClock();
  const today = appToday(now);
  const time = appClockTime(now);
  const part = greetingFor(Number(time.slice(0, 2)));
  const name = firstName?.trim() || t(TODAY_KEYS.greeting.nobody); // NOSONAR(S6606): a blank name greets nobody
  const day = formatDate(
    appWallClock(today, '00:00'),
    { weekday: 'short', day: 'numeric', month: 'short' },
    { wallClock: true },
  );

  return (
    <div className="flex flex-none flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1
          data-testid={TODAY_TEST_IDS.greeting}
          className="font-heading text-greeting font-semibold"
        >
          {t(TODAY_KEYS.greeting[part], { name })}
        </h1>
        <p
          data-testid={TODAY_TEST_IDS.pulse}
          className="text-body text-muted-foreground-strong flex items-center gap-2 leading-[normal] tabular-nums"
        >
          <span
            aria-hidden="true"
            title={t(TODAY_KEYS.live)}
            className="bg-tone-sage-dot size-1.5 flex-none animate-[pulse-dot_2400ms_ease-in-out_infinite] rounded-full motion-reduce:animate-none"
          />
          {t(TODAY_KEYS.pulse, {
            inClinic: formatNumber(counts.inClinic),
            waiting: formatNumber(counts.waiting),
            arriving: formatNumber(counts.arriving),
            day,
            time: clock.wallTime(today, time),
          })}
        </p>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 md:ms-auto md:w-auto md:flex-nowrap">
        {finder}
        <span className="flex items-center gap-2">
          {onShortcuts ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-testid={TODAY_TEST_IDS.shortcuts}
              aria-label={t(TODAY_KEYS.shortcuts)}
              aria-keyshortcuts="?"
              title={t(TODAY_KEYS.shortcuts)}
              onClick={onShortcuts}
              className="text-muted-foreground-strong size-8 rounded-lg max-md:hidden"
            >
              <Keyboard aria-hidden="true" className="size-4" />
            </Button>
          ) : null}
          {onWalkIn ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid={TODAY_TEST_IDS.walkIn}
              aria-keyshortcuts="W"
              onClick={onWalkIn}
              className={cn(BUTTON, OUTLINE)}
            >
              {t(TODAY_KEYS.walkIn)}
            </Button>
          ) : null}
          {onNewBooking ? (
            <Button
              type="button"
              size="sm"
              data-testid={TODAY_TEST_IDS.newBooking}
              aria-keyshortcuts="N"
              onClick={onNewBooking}
              className={cn(BUTTON, 'font-medium shadow-(--elevation-control)')}
            >
              {t(TODAY_KEYS.newBooking)}
            </Button>
          ) : null}
        </span>
      </div>
    </div>
  );
}
