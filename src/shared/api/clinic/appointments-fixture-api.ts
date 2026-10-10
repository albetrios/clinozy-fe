import type {
  AppointmentRow,
  AppointmentStaff,
} from './appointments-fixture-contracts.ts';

/*
 * The fixture world's appointments, for the rooms still on fixtures (D149): the patient file's
 * Visits, timeline and care card, and its staff pickers. The Appointments room and the
 * appointment form read clinozy-be (`appointments-api.ts`); this module goes with the last
 * fixture room that reads a booking. The world is imported on demand, so its seed data never
 * lands in a route chunk.
 */

const server = () => import('./fixtures/appointments-server.fixtures.ts');

/** TanStack Query keys for the fixture bookings — under the room's, so its writes refresh them. */
export const fixtureAppointmentQueryKeys = {
  all: ['clinic', 'appointments', 'fixture'] as const,
  staff: () => [...fixtureAppointmentQueryKeys.all, 'staff'] as const,
  /** A patient's bookings — the patient file's Visits. */
  patient: (patientId: string) =>
    [...fixtureAppointmentQueryKeys.all, 'patient', patientId] as const,
};

/** A fixture patient's bookings, newest first — the patient file's Visits. */
export async function fetchFixturePatientAppointments(
  patientId: string,
): Promise<AppointmentRow[]> {
  return (await server()).listPatientAppointments(patientId);
}

/** The fixture doctors and therapists — the patient file's staff pickers. */
export async function fetchFixtureBookableStaff(): Promise<AppointmentStaff[]> {
  return (await server()).listBookableStaff();
}
