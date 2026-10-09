import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { clinicClockTime, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { greetingFor } from '@/shared/clinic/clinic-greeting.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { clinicWallClock, useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

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
  /** "Walk-in" — the command menu. */
  onWalkIn: () => void;
}

/** The two outline buttons (`today.md:18`): 32px, 13px, `rounded-lg`, transparent, hover `accent`. */
const BUTTON =
  'h-8 rounded-lg bg-transparent px-3.5 text-body leading-[normal] dark:bg-transparent';

/**
 * The greeting row (KICKOFF §6.2; `today.md:18`; H:579–584): "Good morning,
 * <first name>" on the clinic-local clock — the screen's title, so it is the
 * page's h1 — the pulse ("6 in clinic · 2 waiting · 3 arriving · Sat 3 Oct,
 * 10:42", the clinic's day and time in the viewer's format and hour cycle),
 * then "New booking" and "Walk-in" pushed to the inline end. One baseline row
 * that wraps: three lines on a phone.
 */
export function TodayGreeting({
  firstName,
  now,
  counts,
  onNewBooking,
  onWalkIn,
}: TodayGreetingProps) {
  const { t } = useTranslation(TODAY_NS);
  const { formatDate, formatNumber } = useLocaleFormat();
  const clock = useClinicClock();
  const today = clinicToday(now);
  const time = clinicClockTime(now);
  const part = greetingFor(Number(time.slice(0, 2)));
  const name = firstName?.trim() || t(TODAY_KEYS.greeting.nobody); // NOSONAR(S6606): a blank name greets nobody
  const day = formatDate(
    clinicWallClock(today, '00:00'),
    { weekday: 'short', day: 'numeric', month: 'short' },
    { wallClock: true },
  );

  return (
    <div className="flex flex-none flex-wrap items-baseline gap-3.5">
      <h1
        data-testid={TODAY_TEST_IDS.greeting}
        className="font-heading text-greeting font-semibold"
      >
        {t(TODAY_KEYS.greeting[part], { name })}
      </h1>
      <p
        data-testid={TODAY_TEST_IDS.pulse}
        className="text-body text-muted-foreground-strong leading-[normal] tabular-nums"
      >
        {t(TODAY_KEYS.pulse, {
          inClinic: formatNumber(counts.inClinic),
          waiting: formatNumber(counts.waiting),
          arriving: formatNumber(counts.arriving),
          day,
          time: clock.wallTime(today, time),
        })}
      </p>
      <span aria-hidden="true" className="flex-1" />
      {onNewBooking ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={TODAY_TEST_IDS.newBooking}
          onClick={onNewBooking}
          className={cn(BUTTON, 'font-medium shadow-(--elevation-control)')}
        >
          {t(TODAY_KEYS.newBooking)}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid={TODAY_TEST_IDS.walkIn}
        onClick={onWalkIn}
        className={cn(BUTTON, 'font-normal shadow-none')}
      >
        {t(TODAY_KEYS.walkIn)}
      </Button>
    </div>
  );
}
