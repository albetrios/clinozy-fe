import { useTranslation } from 'react-i18next';

import { dateFormatOptions } from '@/lib/i18n/intl-config.ts';
import {
  civilDayOffset,
  clinicInstant,
  clinicToday,
  localDateOf,
} from '@/shared/api/clinic/clinic-time.ts';
import type { PatientNextVisit } from '@/shared/api/clinic/patient-file-contracts.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { PATIENT_FILE_KEYS, PATIENT_FILE_NS } from './patient-file.constants.ts';

const K = PATIENT_FILE_KEYS.visit;

/**
 * "Today · 11:00 am" / "Tomorrow · …" / "Sat, 10 Oct · …" — the next visit's
 * day and time, as the rail's Up next and the Overview's Visits card write it
 * (H:723, H:4990).
 */
export function useVisitWhen(): (
  visit: Pick<PatientNextVisit, 'date' | 'startTime'>,
) => string {
  const { t } = useTranslation(PATIENT_FILE_NS);
  const { formatDate, prefs } = useLocaleFormat();
  return (visit) => {
    const offset = civilDayOffset(clinicToday(), visit.date);
    let day = formatDate(
      localDateOf(visit.date),
      { weekday: 'short', day: 'numeric', month: 'short' },
      { civilDay: true },
    );
    if (offset === 0) day = t(K.today);
    if (offset === 1) day = t(K.tomorrow);
    const time = formatDate(clinicInstant(visit.date, visit.startTime), {
      ...dateFormatOptions('time', prefs.hourCycle),
      hour: 'numeric',
      second: undefined,
    });
    return t(K.when, { day, time });
  };
}
