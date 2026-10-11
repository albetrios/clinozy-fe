import {
  fetchPatient,
  fixturePatientQueryKeys,
} from '@/shared/api/app/patients-fixture-api.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';

/*
 * The fixture world's patients for the rooms still on fixtures (D152) — Payments' receive
 * drawer, the invoice drawer and its patient picker, and Tasks' new task. The Patients room and
 * the patient file read clinozy-be (`usePatients`); this goes with the last fixture room that
 * reads a patient.
 */

/** One fixture patient by id; idle while there is no id. */
export function useFixturePatient(id: string | undefined) {
  return useAppQuery({
    queryKey: fixturePatientQueryKeys.detail(id ?? ''),
    queryFn: () => fetchPatient(id ?? ''),
    enabled: Boolean(id),
  });
}
