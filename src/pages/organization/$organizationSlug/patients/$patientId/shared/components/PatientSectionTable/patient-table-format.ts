import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { dateFormatOptions } from '@/lib/i18n/intl-config.ts';
import { clinicToday, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

/** "24 Sep 2026" — a day with its month and year. */
const DAY_WITH_YEAR: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

/**
 * A record's day as the section tables write it (H:4746–4760): "24 Sep 2026"
 * — or "24 Sep" in this year when `short` (the Invoices' 90px Date).
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

/**
 * An instant as the section tables write it — "24 Sep 2026 · 15:00" (the
 * Treatments' Date, the Payments' When): the day with its year, then the
 * clock in the viewer's zone and hour cycle, as `useDayTime` words it.
 */
export function useTableDayTime(): (instant: string) => string {
  const { t } = useTranslation(CLINIC_NS);
  const { formatDate, prefs } = useLocaleFormat();
  return useCallback(
    (instant) =>
      t(CLINIC_KEYS.lists.dayTime, {
        day: formatDate(instant, DAY_WITH_YEAR),
        time: formatDate(instant, {
          ...dateFormatOptions('time', prefs.hourCycle),
          hour: 'numeric',
          second: undefined,
        }),
      }),
    [formatDate, prefs.hourCycle, t],
  );
}
