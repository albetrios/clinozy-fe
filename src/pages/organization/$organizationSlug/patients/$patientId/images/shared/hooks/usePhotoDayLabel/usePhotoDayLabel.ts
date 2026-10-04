import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { clinicToday, localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import {
  PATIENT_PHOTOS_KEYS,
  PATIENT_PHOTOS_NS,
} from '../../../../shared/patient-photos.constants.ts';

/**
 * A photo day as the Photos section names it (H:4766 `humanD`): "Today", else
 * the day and month ("24 Sep"), with the year when it is not this one.
 */
export function usePhotoDayLabel(): (date: string) => string {
  const { t } = useTranslation(PATIENT_PHOTOS_NS);
  const { formatDate } = useLocaleFormat();
  return useCallback(
    (date: string) => {
      const today = clinicToday();
      if (date === today) return t(PATIENT_PHOTOS_KEYS.today);
      return formatDate(
        localDateOf(date),
        {
          day: 'numeric',
          month: 'short',
          ...(date.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' }),
        },
        { civilDay: true },
      );
    },
    [formatDate, t],
  );
}
