import {
  addCivilDays,
  civilDateOf,
  civilDayOffset,
  clockMinutes,
  clockOfMinutes,
  localDateOf,
} from '@/shared/api/app/app-time.ts';
import {
  type BranchHours,
  isBranchWorkingDay,
  nextBranchWorkingDay,
} from '@/shared/app/branch-hours.ts';

/**
 * The tour's clinic day, on the viewer's own clock (no session, so no clinic
 * time zone yet: the browser's) and in this device's branch hours
 * (`rememberedBranchHours`: the branch last worked in here, else the defaults
 * a new branch starts with). While a slot is left today the day sheet is
 * today, its rows a quarter hour either side of now; otherwise it is the
 * branch's next opening — this morning before it opens, else its next working
 * day — and Riya books into it.
 */

/** A booking's length on the sheet: its rows and slots are a quarter hour apart. */
const SLOT_MINUTES = 15;
/** The follow-up call the last chapter sets: the first working day this many days after her visit. */
const FOLLOW_UP_DAYS = 3;
/** A package's next session, three weeks after this one: the same weekday, so a working day. */
const NEXT_SESSION_DAYS = 21;

const MINUTE_MS = 60_000;

/** Which day the sheet shows: today, tomorrow, or a later day (the days between closed). */
export type TourSheetDay = 'today' | 'tomorrow' | 'later';

/** One clinic day for the tour, built from a moment on the viewer's clock. */
export interface TourDay {
  /** True while the branch is open and a slot is left today: the sheet is today, with a now line. */
  open: boolean;
  /** The day the sheet shows. Before opening it is today, not yet open. */
  sheetDay: TourSheetDay;
  /** The row before Riya's: now rounded down to the quarter hour, or a quarter hour after opening. */
  base: Date;
  /** Riya's slot, a quarter hour after {@link TourDay.base}. */
  slot: Date;
  /** When the sheet's day opens; a visit before it is not drawn. */
  opens: Date;
  /** When it closes; a visit from then on is not drawn. */
  closes: Date;
  /** Her follow-up call: the first working day three or more days after her visit. */
  followUp: Date;
  /** Her package's next session, three weeks on at her slot's time. */
  nextSession: Date;
}

/** `date` moved by `minutes` (negative goes back). */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}

/** A calendar date at a clock time `HH:mm`, on the viewer's clock. */
function localAt(date: string, time: string): Date {
  const moment = localDateOf(date);
  const minutes = clockMinutes(time);
  moment.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return moment;
}

/** The minutes after midnight of a local moment. */
const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();

const SHEET_DAYS: Readonly<Record<number, TourSheetDay>> = { 0: 'today', 1: 'tomorrow' };

/**
 * The day sheet for `now` in a branch's `hours`. It is open on a working day
 * from opening while Riya's slot, the quarter hour after this one, still ends
 * by closing; else it shows the next opening — today's before it opens, or the
 * next working day's — from a quarter hour after it.
 */
export function buildTourDay(now: Date, hours: BranchHours): TourDay {
  const today = civilDateOf(now);
  const nowMinutes = minutesOf(now);
  const quarter = Math.floor(nowMinutes / SLOT_MINUTES) * SLOT_MINUTES;
  const workingToday = isBranchWorkingDay(hours, today);
  const opensAt = clockMinutes(hours.opensAt);
  const open =
    workingToday &&
    nowMinutes >= opensAt &&
    quarter + 2 * SLOT_MINUTES <= clockMinutes(hours.closesAt);
  const beforeOpening = workingToday && nowMinutes < opensAt;
  const date =
    open || beforeOpening ? today : nextBranchWorkingDay(hours, addCivilDays(today, 1));
  const opens = localAt(date, hours.opensAt);
  const base = open
    ? localAt(today, clockOfMinutes(quarter))
    : addMinutes(opens, SLOT_MINUTES);
  const slot = addMinutes(base, SLOT_MINUTES);
  return {
    open,
    sheetDay: SHEET_DAYS[civilDayOffset(today, date)] ?? 'later',
    base,
    slot,
    opens,
    closes: localAt(date, hours.closesAt),
    followUp: localAt(
      nextBranchWorkingDay(hours, addCivilDays(date, FOLLOW_UP_DAYS)),
      hours.opensAt,
    ),
    nextSession: localAt(
      addCivilDays(date, NEXT_SESSION_DAYS),
      clockOfMinutes(minutesOf(slot)),
    ),
  };
}

/** Whether a visit at `at` falls inside the sheet day's hours — one outside is not drawn. */
export function isInTourHours(day: TourDay, at: Date): boolean {
  return at >= day.opens && at < day.closes;
}
