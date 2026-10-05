import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';

/**
 * The tables' date words, on the clinic clock: a moment by the rooms' one time
 * rule — `when` an instant ("10:12 am" today, "Yesterday 9:10 am", "Fri 10:52
 * am", "25 Sep") and `visit` a rep's last or next visit day ("Today", "Mon",
 * "9 Oct") — and `day` a record's calendar date as it is dated ("25 Sep",
 * the year added when it is another year's).
 */
export function useMedicalDates() {
  const clock = useClinicClock();
  return {
    clock,
    when: (instant: string) => clock.moment(instant),
    visit: (date: string) => clock.day(date),
    day: (date: string) => clock.date(date),
  };
}
