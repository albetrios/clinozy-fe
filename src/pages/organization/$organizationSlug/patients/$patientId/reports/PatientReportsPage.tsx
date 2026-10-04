import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './reports.manifest.ts';

/**
 * Patient file › Reports (KICKOFF §6.6; H:4760; `patient-file.md:34–46`): the section in the
 * file's content column, under its header — the table lands with L-43b, Upload report and Report view with L-45.
 */
export function PatientReportsPage() {
  return <PatientSection section="reports" data-testid={manifest.testId} />;
}
