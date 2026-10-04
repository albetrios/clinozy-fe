import { useTranslation } from 'react-i18next';

import {
  type ClinicClock,
  clinicDayLabel,
  useClinicClock,
} from '@/shared/hooks/useClinicClock/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS } from '../../../medical.constants.ts';

/** "Today 10:12", "Yesterday 9:10", "25 Sep 10:52" — an instant as the tables name it. */
function whenLabel(
  instant: string,
  clock: ClinicClock,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  return t(MEDICAL_KEYS.table.when, {
    day: clinicDayLabel(clock.dayOf(instant), clock, t),
    time: clock.time(instant),
  });
}

/**
 * The tables' date words: an instant as "Today 10:12" and a calendar date as
 * "25 Sep" (the year added when it is another year's) — on the clinic clock.
 */
export function useMedicalDates() {
  const { t } = useTranslation(MEDICAL_NS);
  const clock = useClinicClock();
  return {
    clock,
    when: (instant: string) => whenLabel(instant, clock, t),
    day: (date: string) => clock.date(date),
  };
}
