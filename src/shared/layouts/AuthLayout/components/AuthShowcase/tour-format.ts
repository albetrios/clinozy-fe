import { useMemo } from 'react';

import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

import { TOUR_BILL } from './auth-showcase.constants.ts';

/** The tour's formatters: times, days and money as the viewer's locale writes them. */
export interface TourFormat {
  time: (date: Date) => string;
  longDate: (date: Date) => string;
  shortDate: (date: Date) => string;
  /** "27 October" — a date whose weekday is named beside it. */
  dayMonth: (date: Date) => string;
  weekday: (date: Date) => string;
  weekdayShort: (date: Date) => string;
  number: (value: number) => string;
  /** Two digits, as a timer's seconds read (`07`). */
  twoDigits: (value: number) => string;
  money: (rupees: number) => string;
  /** Riya's bill, in rupees: the consultation and her first session. */
  bill: number;
}

/**
 * Formatters for the tour, from the app's own locale preferences
 * (`useLocaleFormat`, `useRupeeFormat`): before sign-in that is the browser's
 * language and clock, so the sheet reads like the viewer's own day.
 */
export function useTourFormat(): TourFormat {
  const { formatDate, formatNumber } = useLocaleFormat();
  const money = useRupeeFormat();
  return useMemo(
    () => ({
      time: (date: Date) => formatDate(date, { hour: 'numeric', minute: '2-digit' }),
      longDate: (date: Date) =>
        formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' }),
      shortDate: (date: Date) =>
        formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' }),
      dayMonth: (date: Date) => formatDate(date, { day: 'numeric', month: 'long' }),
      weekday: (date: Date) => formatDate(date, { weekday: 'long' }),
      weekdayShort: (date: Date) => formatDate(date, { weekday: 'short' }),
      number: (value: number) => formatNumber(value),
      twoDigits: (value: number) => formatNumber(value, { minimumIntegerDigits: 2 }),
      money,
      bill: TOUR_BILL.consultation + TOUR_BILL.session,
    }),
    [formatDate, formatNumber, money],
  );
}
