import { useTranslation } from 'react-i18next';

import type { Weekday } from '@/shared/api/app/app-schema.ts';
import { localDateOf, workingDaysPattern } from '@/shared/api/app/app-time.ts';
import { WEEK } from '@/shared/api/app/app-week.ts';
import type { BranchHours } from '@/shared/app/branch-hours.ts';

import {
  AUTH_SHOWCASE_KEYS as K,
  AUTH_SHOWCASE_NS,
  TOUR_BRANCH_ORDER,
  TOUR_BRANCHES,
  type TourBranch,
} from './auth-showcase.constants.ts';
import { type TourBranchState, tourTimeOf } from './tour-day.ts';
import type { TourFormat } from './tour-format.ts';

/*
 * The Branches chapter's data and words (its components are `TourBranches.tsx`): the branches in
 * order, each one's hours, and how a branch reads — its state on the viewer's clock, its hours.
 */

/** The branches in the header picker's order, the main one first. */
export const TOUR_BRANCH_LIST: readonly TourBranch[] = TOUR_BRANCH_ORDER.map(
  (id) => TOUR_BRANCHES[id],
);

/** A branch's hours: its own, or this device's for Riya's branch. */
export function tourBranchHours(
  branch: TourBranch,
  deviceHours: BranchHours,
): BranchHours {
  return branch.hours ?? deviceHours;
}

/** A Monday, so each weekday's short name can be formatted from a date. */
const A_MONDAY = '2026-10-26';

/** The words a branch is read in: its state on the clock, and its hours. */
export interface TourBranchWords {
  /** "Open · till 8:00 PM", "Opens 11:00 AM", "Closed · opens tomorrow 10:00 AM", "… Monday …". */
  state: (state: TourBranchState) => string;
  /** "Mon–Sat · 10:00 AM–8:00 PM", "Every day · 9:00 AM–9:00 PM". */
  hours: (hours: BranchHours, now: Date) => string;
}

/** {@link TourBranchWords} in the viewer's language and clock. */
export function useTourBranchWords(format: TourFormat): TourBranchWords {
  const { t } = useTranslation(AUTH_SHOWCASE_NS);
  const weekday = (day: Weekday) => {
    const date = localDateOf(A_MONDAY);
    date.setDate(date.getDate() + WEEK.indexOf(day));
    return format.weekdayShort(date);
  };
  const days = (workingDays: readonly Weekday[]) => {
    const pattern = workingDaysPattern(workingDays);
    if (pattern.kind === 'everyDay') return t(K.lens.branches.everyDay);
    if (pattern.kind === 'run') return `${weekday(pattern.from)}–${weekday(pattern.to)}`;
    if (pattern.kind === 'list') return pattern.days.map(weekday).join(', ');
    return '';
  };
  return {
    state: (state) => {
      if (state.kind === 'open') {
        return t(K.sheet.branchState.open, { time: format.time(state.closes) });
      }
      return t(K.sheet.branchState[state.kind], {
        time: format.time(state.opens),
        weekday: format.weekday(state.opens),
      });
    },
    hours: (hours, now) =>
      t(K.lens.branches.days, {
        days: days(hours.workingDays),
        opens: format.time(tourTimeOf(now, hours.opensAt)),
        closes: format.time(tourTimeOf(now, hours.closesAt)),
      }),
  };
}
