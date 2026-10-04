import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './notes.manifest.ts';

/**
 * Patient file › Team notes (KICKOFF §6.6; H:834; `patient-file.md:81–90`): the section in the
 * file's content column, under its header — the composer and the notes land with L-43b; the section has no "New …" button.
 */
export function PatientNotesPage() {
  return <PatientSection section="notes" data-testid={manifest.testId} />;
}
