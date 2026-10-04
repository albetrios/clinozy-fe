import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './prescriptions.manifest.ts';

/**
 * Patient file › Prescriptions (KICKOFF §6.6; H:4753; `patient-file.md:34–46`): the section in the
 * file's content column, under its header — the table lands with L-43b, the prescription drawers and the print preview with L-45; "New prescription" is the Doctor and Admin gate (`S:35`).
 */
export function PatientPrescriptionsPage() {
  return <PatientSection section="prescriptions" data-testid={manifest.testId} />;
}
