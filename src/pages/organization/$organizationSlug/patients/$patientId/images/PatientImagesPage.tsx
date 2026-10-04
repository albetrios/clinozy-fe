import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './images.manifest.ts';

/**
 * Patient file › Photos (KICKOFF §6.6; H:827–832; `patient-file.md:59–68`): the section in the
 * file's content column, under its header — the albums, the photo grid, uploads, the viewer and Photo details land with L-44; "Upload images" needs Patients create.
 */
export function PatientImagesPage() {
  return <PatientSection section="images" data-testid={manifest.testId} />;
}
