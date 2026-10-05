import type { PatientNextVisit } from '@/shared/api/clinic/patient-file-contracts.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';

/**
 * The next visit's start beside its date tile — the rail's Up next and the
 * Overview's Visits card (H:723, H:4990): the time alone ("11:00 am"), the
 * booking's clinic-local start as written. The tile already names the day,
 * so the line is the rooms' one time rule where the context is that day.
 */
export function useVisitWhen(): (
  visit: Pick<PatientNextVisit, 'date' | 'startTime'>,
) => string {
  const clock = useClinicClock();
  return (visit) => clock.wallTime(visit.date, visit.startTime);
}
