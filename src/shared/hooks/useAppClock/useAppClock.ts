import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { dateFormatOptions, resolvedTimeZone } from '@/lib/i18n/intl-config.ts';
import {
  APP_TIME_ZONE,
  appClockTime,
  appToday,
  civilDayReading,
  localDateOf,
} from '@/shared/api/app/app-time.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { PICKER_KEYS, PICKER_NS } from '@/shared/components/Picker/picker.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

/**
 * The context a moment sits in — what the room around it already shows — and
 * from when it is read.
 */
export interface AppMomentOptions {
  /**
   * Default `true`: the room shows times, so the day comes with its time —
   * "Today 11:30 am", "Yesterday 4:00 pm", "Mon 9:00 am", "24 Sep 10:30 am".
   * `false` where the room shows days alone: "Today", "Yesterday", "Mon",
   * "24 Sep".
   */
  withTime?: boolean;
  /**
   * The context already is the day (a chat bubble under the conversation of
   * today): today's moment is its bare time ("10:28 am"), any other day still
   * names its day. Default `false`.
   */
  sameDay?: boolean;
  /**
   * The moment "today" is read from — a list that keeps its own clock (the
   * tasks' due labels, the leads' hold) passes it; default, when the clock
   * was made.
   */
  now?: Date;
}

/**
 * How a clinic screen reads dates: today's calendar date and the zone's day
 * of an instant, with the viewer's clock time and short date
 * (`useLocaleFormat`) — and the one rule every room names a moment by
 * ({@link AppClock.moment}): the chat thread's times, the lists' Updated,
 * Last visit and When, the activity timeline, notes, task due labels and the
 * notifications.
 */
export interface AppClock {
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
  /**
   * "10:40 am" — a clinic-local day and `HH:mm` as written (a booking's start,
   * a due time), in the viewer's hour cycle; no display zone moves it.
   */
  wallTime: (date: string, time: string) => string;
  /**
   * A calendar date by the one rule: "Today", "Yesterday", the weekday of the
   * last six days ("Mon"), "Tomorrow", else the date ("24 Sep", "24 Sep 2025")
   * — a weekday only ever names a past day. Read on the day of `now`
   * (default, when the clock was made).
   */
  day: (date: string, now?: Date) => string;
  /**
   * An instant by the one rule: its {@link day} with its time where the room
   * shows times — "Today 11:30 am", "Yesterday 4:00 pm", "Mon 9:00 am", "24 Sep
   * 10:30 am"; ahead "Tomorrow 3:30 pm", "7 Oct 3:30 pm" — the day alone where
   * it shows days, the bare time only where the context already is that day
   * ({@link AppMomentOptions}).
   */
  moment: (instant: string, options?: AppMomentOptions) => string;
  /** A clinic-local calendar date by the rule's day words — read against the clinic's own today. */
  wallDay: (date: string, now?: Date) => string;
  /**
   * A clinic-local day and `HH:mm` (a booking, a due time) by the same rule,
   * as written — read against the clinic's own today.
   */
  wallMoment: (date: string, time: string, options?: AppMomentOptions) => string;
}

/** What the one rule is worded with, in the viewer's language and format locale. */
export interface AppClockWords {
  today: string;
  yesterday: string;
  tomorrow: string;
  /** "Mon" — a day of the last six, by its weekday. */
  weekday: (date: string) => string;
  /**
   * "24 Sep", "Sep 24, 2025" — a day the rule names by its date. The hook's
   * words isolate it (bidi), as they do the time; without it the clock's own
   * {@link AppClock.date} is used.
   */
  date?: (date: string) => string;
  /**
   * "Today 11:30 am" — today and a clock time together. The hook's words
   * isolate the time (bidi), as in {@link dayTime}.
   */
  todayTime: (time: string) => string;
  /**
   * "Yesterday 10:30 am" — a day and a clock time together. The hook's words
   * isolate the time (bidi), so it stays whole beside a right-to-left day word;
   * the day word keeps the page's direction.
   */
  dayTime: (day: string, time: string) => string;
}

/** A clock's own parts — everything but the rule, which {@link appClockOf} adds. */
export type AppClockParts = Omit<
  AppClock,
  'day' | 'moment' | 'wallDay' | 'wallMoment'
> & {
  /** The clinic's own today (`APP_TIME_ZONE`) — what a wall-clock value reads against. */
  appToday: string;
};

/**
 * A clock time as one unbreakable token: "10:40 am" never wraps between its
 * digits and its "am" — a line may break before the time, never inside it.
 */
function keepTogether(time: string): string {
  return time.replace(/\s+/gu, '\u00a0');
}

/**
 * The one moment rule on a clock's parts: {@link AppClock.day},
 * {@link AppClock.moment}, {@link AppClock.wallDay} and
 * {@link AppClock.wallMoment} from the day words — the reading itself is
 * {@link civilDayReading}.
 */
export function appClockOf(parts: AppClockParts, words: AppClockWords): AppClock {
  const { appToday: wallToday, ...clock } = parts;
  /** Today where the times are read — at `now`, else when the clock was made. */
  const zoneToday = (now?: Date) => (now ? clock.dayOf(now.toISOString()) : clock.today);
  /** The clinic's own today — at `now`, else when the clock was made. */
  const appDay = (now?: Date) => (now ? appToday(now) : wallToday);
  const dayFrom = (today: string, date: string): string => {
    switch (civilDayReading(today, date)) {
      case 'today':
        return words.today;
      case 'yesterday':
        return words.yesterday;
      case 'tomorrow':
        return words.tomorrow;
      case 'thisWeek':
        return words.weekday(date);
      case 'ahead':
      case 'earlier':
        return words.date ? words.date(date) : clock.date(date);
    }
  };
  /**
   * The rule once the day is known: the day always named — with its time
   * where the room shows times — and today's bare time only where the context
   * already is today.
   */
  const momentFrom = (
    today: string,
    date: string,
    time: string,
    { withTime = true, sameDay = false }: AppMomentOptions = {},
  ): string => {
    if (!withTime) return dayFrom(today, date);
    if (civilDayReading(today, date) === 'today') {
      return sameDay ? time : words.todayTime(time);
    }
    return words.dayTime(dayFrom(today, date), time);
  };
  return {
    ...clock,
    day: (date, now) => dayFrom(zoneToday(now), date),
    moment: (instant, options) =>
      momentFrom(
        zoneToday(options?.now),
        clock.dayOf(instant),
        keepTogether(clock.time(instant)),
        options,
      ),
    wallDay: (date, now) => dayFrom(appDay(now), date),
    wallMoment: (date, time, options) =>
      momentFrom(
        appDay(options?.now),
        date,
        keepTogether(clock.wallTime(date, time)),
        options,
      ),
  };
}

/**
 * A clinic-local day and clock time (`YYYY-MM-DD`, `HH:mm`) as a wall-clock
 * `Date` — formatted with `{ wallClock: true }`, so no display zone moves it.
 */
export function appWallClock(date: string, time: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split('-').map(Number);
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * The clinic clock (`useLocaleFormat`): days are the clinic's — or the
 * viewer's chosen zone — and times follow the viewer's format and hour cycle
 * (KICKOFF §7.2); moments read by the one rule ({@link appClockOf}).
 */
export function useAppClock(): AppClock {
  const { formatDate, prefs } = useLocaleFormat();
  const { t } = useTranslation([APP_NS, PICKER_NS]);
  return useMemo(() => {
    const now = new Date();
    const zone = resolvedTimeZone(prefs.timeZone) ?? APP_TIME_ZONE;
    const today = appToday(now, zone);
    const thisYear = (date: string) => date.slice(0, 4) === today.slice(0, 4);
    const civil = (date: string, options: Intl.DateTimeFormatOptions) =>
      formatDate(localDateOf(date), options, { civilDay: true });
    /** "9 Oct" — "9 Oct 2025" in another year. */
    const dateText = (date: string) =>
      civil(date, {
        day: 'numeric',
        month: 'short',
        ...(thisYear(date) ? {} : { year: 'numeric' }),
      });
    const hourCycle: Intl.DateTimeFormatOptions = {
      ...dateFormatOptions('time', prefs.hourCycle),
      hour: 'numeric',
      second: undefined,
    };
    const clockOptions: Intl.DateTimeFormatOptions = { ...hourCycle, timeZone: zone };
    return appClockOf(
      {
        today,
        appToday: appToday(now),
        dayOf: (instant) => appToday(new Date(instant), zone),
        time: (instant) => formatDate(instant, clockOptions),
        shortTime: (instant) =>
          formatDate(
            instant,
            appClockTime(new Date(instant), zone).endsWith(':00')
              ? { ...clockOptions, minute: undefined }
              : clockOptions,
          ),
        date: dateText,
        // Screen-only (lane hints, cards, due labels): one unbreakable token.
        wallTime: (date, time) =>
          keepTogether(
            formatDate(appWallClock(date, time), hourCycle, { wallClock: true }),
          ),
      },
      {
        today: t(PICKER_KEYS.date.today, { ns: PICKER_NS }),
        yesterday: t(PICKER_KEYS.date.yesterday, { ns: PICKER_NS }),
        tomorrow: t(PICKER_KEYS.date.tomorrow, { ns: PICKER_NS }),
        weekday: (date) => civil(date, { weekday: 'short' }),
        // The date and the time are the line's data tokens (isolated); the day
        // words keep the page's direction. The clock's own `date` stays bare —
        // message text reads it.
        date: (date) => isolateText(dateText(date)),
        todayTime: (time) =>
          t(APP_KEYS.clock.todayTime, { ns: APP_NS, time: isolateText(time) }),
        dayTime: (day, time) =>
          t(APP_KEYS.clock.dayTime, { ns: APP_NS, day, time: isolateText(time) }),
      },
    );
  }, [formatDate, prefs, t]);
}
