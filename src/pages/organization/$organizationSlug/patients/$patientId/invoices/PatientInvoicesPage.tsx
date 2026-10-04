import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './invoices.manifest.ts';

/**
 * Patient file › Invoices (KICKOFF §6.6; H:4748; `patient-file.md:34–46`): the section in the
 * file's content column, under its header — a billing section — it also needs billing view (`S:33`); the table lands with L-43b, "New invoice" opens the shared Invoice drawer (L-40) keeping the file behind it.
 */
export function PatientInvoicesPage() {
  return <PatientSection section="invoices" data-testid={manifest.testId} />;
}
