import { useCallback } from 'react';

import { clinicToday, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

/** "24 Sep 2026" — a day with its month and year. */
const DAY_WITH_YEAR: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/**
 * A record's day as the section tables write it (H:4746–4760): "24 Sep 2026"
 * — or "24 Sep" in this year when `short` (the Invoices' 90px Date). A moment
 * — the Treatments' Date, the Payments' When — reads by the rooms' one time
 * rule instead (`useClinicClock().moment`).
 */
export function useTableDay(): (civilDate: string, short?: boolean) => string {
  const { formatDate } = useLocaleFormat();
  return useCallback(
    (civilDate, short = false) => {
      const thisYear = civilDate.slice(0, 4) === clinicToday().slice(0, 4);
      return formatDate(
        localDateOf(civilDate),
        short && thisYear ? { day: 'numeric', month: 'short' } : DAY_WITH_YEAR,
        { civilDay: true },
      );
    },
    [formatDate],
  );
}
