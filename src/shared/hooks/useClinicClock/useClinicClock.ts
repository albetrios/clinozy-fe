import type { TFunction } from 'i18next';
import { useMemo } from 'react';

import { dateFormatOptions, resolvedTimeZone } from '@/lib/i18n/intl-config.ts';
import {
  civilDayOffset,
  CLINIC_TIME_ZONE,
  clinicClockTime,
  clinicToday,
  localDateOf,
} from '@/shared/api/clinic/clinic-time.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/picker.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

/**
 * How a clinic screen reads dates: today's calendar date and the zone's day
 * of an instant, with the viewer's clock time and short date
 * (`useLocaleFormat`) — the chat thread's times, a room table's "When".
 */
export interface ClinicClock {
  /** Today, `YYYY-MM-DD`, where the times are read (clinic-local unless the viewer set a zone). */
  today: string;
  /** The calendar date of an instant in that zone. */
  dayOf: (instant: string) => string;
  /** "4:00 pm" — an instant's clock time. */
  time: (instant: string) => string;
  /** "4 pm" on the hour, else "12:30 pm" — a slot as a message offers it (H:5741). */
  shortTime: (instant: string) => string;
  /** "9 Oct" — a calendar date ("9 Oct 2025" in another year). */
  date: (date: string) => string;
}

/**
 * The clinic clock (`useLocaleFormat`): days are the clinic's — or the
 * viewer's chosen zone — and times follow the viewer's format and hour cycle.
 */
export function useClinicClock(): ClinicClock {
  const { formatDate, prefs } = useLocaleFormat();
  return useMemo(() => {
    const zone = resolvedTimeZone(prefs.timeZone) ?? CLINIC_TIME_ZONE;
    const today = clinicToday(new Date(), zone);
    const clockOptions: Intl.DateTimeFormatOptions = {
      ...dateFormatOptions('time', prefs.hourCycle),
      hour: 'numeric',
      second: undefined,
      timeZone: zone,
    };
    return {
      today,
      dayOf: (instant) => clinicToday(new Date(instant), zone),
      time: (instant) => formatDate(instant, clockOptions),
      shortTime: (instant) =>
        formatDate(
          instant,
          clinicClockTime(new Date(instant), zone).endsWith(':00')
            ? { ...clockOptions, minute: undefined }
            : clockOptions,
        ),
      date: (date) =>
        formatDate(
          localDateOf(date),
          {
            day: 'numeric',
            month: 'short',
            ...(date.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
          },
          { civilDay: true },
        ),
    };
  }, [formatDate, prefs]);
}

/** The app's one set of relative-day words — the date list's, in `common`. */
const DAY_WORDS = { ns: PICKER_NS } as const;

/**
 * A calendar date as the clinic screens name it: "Today", "Tomorrow",
 * "Yesterday", else "9 Oct" ("9 Oct 2025" in another year).
 */
export function clinicDayLabel(date: string, clock: ClinicClock, t: TFunction): string {
  const offset = civilDayOffset(clock.today, date);
  if (offset === 0) return t(PICKER_KEYS.date.today, DAY_WORDS);
  if (offset === 1) return t(PICKER_KEYS.date.tomorrow, DAY_WORDS);
  if (offset === -1) return t(PICKER_KEYS.date.yesterday, DAY_WORDS);
  return clock.date(date);
}
