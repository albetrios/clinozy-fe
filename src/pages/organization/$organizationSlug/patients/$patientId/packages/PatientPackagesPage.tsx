import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './packages.manifest.ts';

/**
 * Patient file › Packages (KICKOFF §6.6; H:833; `patient-file.md:70–79`): the section in the
 * file's content column, under its header — the package cards land with L-43b, the Add package drawer with L-45.
 */
export function PatientPackagesPage() {
  return <PatientSection section="packages" data-testid={manifest.testId} />;
}
