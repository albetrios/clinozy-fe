import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './treatments.manifest.ts';

/**
 * Patient file › Treatments (KICKOFF §6.6; H:4757; `patient-file.md:34–46`): the section in the
 * file's content column, under its header — the table lands with L-43b, the treatment drawer with L-45; "New treatment" is the Doctor and Therapist gate (`S:38`).
 */
export function PatientTreatmentsPage() {
  return <PatientSection section="treatments" data-testid={manifest.testId} />;
}
