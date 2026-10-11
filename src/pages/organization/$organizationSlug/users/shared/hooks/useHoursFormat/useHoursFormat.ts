import { useTranslation } from 'react-i18next';

import type { Weekday } from '@/shared/api/app/app-schema.ts';
import { localDateOf, workingDaysPattern } from '@/shared/api/app/app-time.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { USERS_KEYS, USERS_NS } from '../../../users.constants.ts';

/** A Monday the weekday names are read from (any Monday reads the same). */
const MONDAY = '2024-01-01';

const WEEK_INDEX: Readonly<Record<Weekday, number>> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

/** What the Users room shows of days, hours and times, in the viewer's locale. */
export interface HoursFormat {
  /** "Mon" — a weekday's short name. */
  weekday: (day: Weekday) => string;
  /** "Mon–Sat", "Every day", "Mon, Wed, Fri"; '' for none. */
  days: (days: readonly Weekday[]) => string;
  /** "Mon–Sat · 09:30–19:30" — the clock times as written (clinic-local `HH:mm`). */
  hours: (days: readonly Weekday[], from: string, to: string) => string;
  /** When a profile was saved, by the rooms' one time rule: "9:02 am", "Yesterday 10:38 am", "9 Dec 2025". */
  updated: (instant: string) => string;
}

/**
 * The Users room's words for days and times (`usRange`, H:3608; the Updated
 * cell, `users.md:32`) — a member's working hours, a branch's opening hours:
 * weekday names from the locale, times in the viewer's zone and hour cycle for
 * an instant, clinic clock times as written. Family shared: the Team, the
 * user drawer and the Branches tab read it.
 */
export function useHoursFormat(): HoursFormat {
  const { t } = useTranslation(USERS_NS);
  const { formatDate } = useLocaleFormat();
  const clock = useAppClock();

  const weekday = (day: Weekday) => {
    const date = localDateOf(MONDAY);
    date.setDate(date.getDate() + WEEK_INDEX[day]);
    return formatDate(date, { weekday: 'short' }, { civilDay: true });
  };

  const days = (picked: readonly Weekday[]) => {
    const pattern = workingDaysPattern(picked);
    switch (pattern.kind) {
      case 'none':
        return '';
      case 'everyDay':
        return t(USERS_KEYS.hours.everyDay);
      case 'run':
        return t(USERS_KEYS.hours.run, {
          from: weekday(pattern.from),
          to: weekday(pattern.to),
        });
      case 'list':
        return t(USERS_KEYS.hours.list, { days: pattern.days.map(weekday) });
    }
  };

  return {
    weekday,
    days,
    hours: (picked, from, to) =>
      t(USERS_KEYS.hours.line, { days: days(picked), from, to }),
    updated: (instant) => clock.moment(instant),
  };
}
