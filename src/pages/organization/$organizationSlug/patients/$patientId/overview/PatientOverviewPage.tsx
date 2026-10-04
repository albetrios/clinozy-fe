import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './overview.manifest.ts';

/**
 * Patient file › Clinical notes (KICKOFF §6.6; H:780–826; `patient-file.md:48–57`): the section in the
 * file's content column, under its header — the four chip cards, Offering suggestions and Feedback land with L-43; the check-in and review drawers open over it.
 */
export function PatientOverviewPage() {
  return <PatientSection section="overview" data-testid={manifest.testId} />;
}
