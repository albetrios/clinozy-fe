import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './timeline.manifest.ts';

/**
 * Patient file › Overview (KICKOFF §6.6; H:769–779, H:4980–4999): the section in the
 * file's content column (no header — the Overview has none, H:4943) — the default section (D19): the bento, the activity timeline and the smart note land with L-46; the visit flow on `?visit=open` with the Visit model (L-49, D18). It has no section header (H:4943).
 */
export function PatientTimelinePage() {
  return <PatientSection section="timeline" data-testid={manifest.testId} hideHeader />;
}
