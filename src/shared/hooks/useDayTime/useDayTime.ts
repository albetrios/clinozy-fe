import { useTranslation } from 'react-i18next';

import { dateFormatOptions } from '@/lib/i18n/intl-config.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

/**
 * "Sep 24 · 14:50" — an instant as a day and a clock time in the viewer's
 * locale, zone and hour cycle: the rooms' Updated cells and the Patients
 * follow-up badge. The time reads as the chat column's clock does.
 */
export function useDayTime(): (instant: string) => string {
  const { t } = useTranslation(CLINIC_NS);
  const { formatDate, prefs } = useLocaleFormat();
  return (instant) =>
    t(CLINIC_KEYS.lists.dayTime, {
      day: formatDate(instant, { month: 'short', day: '2-digit' }),
      time: formatDate(instant, {
        ...dateFormatOptions('time', prefs.hourCycle),
        hour: 'numeric',
        second: undefined,
      }),
    });
}
