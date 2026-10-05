import type { PatientNextVisit } from '@/shared/api/clinic/patient-file-contracts.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';

/**
 * The next visit's day and time by the rooms' one time rule — "11:00 am"
 * today, "Tomorrow 11:00 am", "10 Oct 11:00 am" — as the rail's Up next
 * and the Overview's Visits card write it (H:723, H:4990): the booking's
 * clinic-local day and start, as written.
 */
export function useVisitWhen(): (
  visit: Pick<PatientNextVisit, 'date' | 'startTime'>,
) => string {
  const clock = useClinicClock();
  return (visit) => clock.wallMoment(visit.date, visit.startTime);
}
