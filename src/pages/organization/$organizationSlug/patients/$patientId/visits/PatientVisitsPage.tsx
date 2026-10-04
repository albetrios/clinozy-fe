import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './visits.manifest.ts';

/**
 * Patient file › Visits (KICKOFF §6.6; H:4746; `patient-file.md:34–46`): the section in the
 * file's content column, under its header — the patient's appointments (a prototype-only section, D26) — the table lands with L-43b; "New appointment" opens the appointment form for this patient.
 */
export function PatientVisitsPage() {
  return <PatientSection section="visits" data-testid={manifest.testId} />;
}
