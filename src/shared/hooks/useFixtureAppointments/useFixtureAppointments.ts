import {
  fetchFixtureBookableStaff,
  fetchFixturePatientAppointments,
  fixtureAppointmentQueryKeys,
} from '@/shared/api/clinic/appointments-fixture-api.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';

/*
 * The fixture world's bookings for the rooms still on fixtures (D149) — the patient file's
 * Visits, timeline and care card, and its staff pickers. The Appointments room reads clinozy-be
 * (`useAppointments`); these go with the last fixture room that reads a booking.
 */

/** The fixture doctors and therapists, with their roles — the patient file's staff pickers. */
export function useFixtureBookableStaff() {
  return useAppQuery({
    queryKey: fixtureAppointmentQueryKeys.staff(),
    queryFn: fetchFixtureBookableStaff,
    staleTime: 5 * 60_000,
  });
}

/** A fixture patient's bookings, newest first — the patient file's Visits; idle without a patient. */
export function useFixturePatientAppointments(patientId: string) {
  return useAppQuery({
    queryKey: fixtureAppointmentQueryKeys.patient(patientId),
    queryFn: () => fetchFixturePatientAppointments(patientId),
    enabled: patientId !== '',
  });
}
