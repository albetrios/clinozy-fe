import { useTranslation } from 'react-i18next';

import { dateFormatOptions } from '@/lib/i18n/intl-config.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { PATIENTS_KEYS, PATIENTS_NS } from '../../patients.constants.ts';

/**
 * "Sep 24 · 14:50" — a day and a clock time in the viewer's locale, zone and
 * hour cycle (the Follow-up badge, the Updated cell); the time reads as the
 * chat column's clock does.
 */
export function useDayTime(): (instant: string) => string {
  const { t } = useTranslation(PATIENTS_NS);
  const { formatDate, prefs } = useLocaleFormat();
  return (instant) =>
    t(PATIENTS_KEYS.table.dayTime, {
      day: formatDate(instant, { month: 'short', day: '2-digit' }),
      time: formatDate(instant, {
        ...dateFormatOptions('time', prefs.hourCycle),
        hour: 'numeric',
        second: undefined,
      }),
    });
}
