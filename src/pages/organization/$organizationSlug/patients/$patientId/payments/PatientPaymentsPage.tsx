import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { manifest } from './payments.manifest.ts';

/**
 * Patient file › Payments (KICKOFF §6.6; H:4751; `patient-file.md:34–46`): the section in the
 * file's content column, under its header — a billing section — it also needs billing view (`S:33`); the table lands with L-43b, "Record payment" opens Receive payment for the open invoices, or says nothing is due.
 */
export function PatientPaymentsPage() {
  return <PatientSection section="payments" data-testid={manifest.testId} />;
}
