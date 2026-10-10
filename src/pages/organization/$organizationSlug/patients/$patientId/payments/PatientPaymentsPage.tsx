'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useTranslation } from 'react-i18next';

import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import { usePatientPayments } from '@/shared/hooks/usePayments/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import {
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  PatientSectionTable,
} from '../shared/components/PatientSectionTable/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { usePatientPaymentsTable } from './hooks/usePatientPaymentsTable/index.ts';
import { manifest } from './payments.manifest.ts';

/**
 * Patient file › Payments (KICKOFF §6.6 Section tables; H:4751;
 * `patient-file.md:34–46`): the patient's receipts and refunds, newest
 * first — a refund with the blush start bar — "3 transactions" and "All
 * transactions loaded"; a billing section, so it also needs billing view
 * (`S:33`). A row opens nothing. Record payment comes back with Payments on
 * clinozy-be (§5.7); the receipts are still the fixture world's.
 */
export function PatientPaymentsPage() {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const { patientId } = usePatientFileContext();
  const payments = usePatientPayments(patientId);
  const rows = payments.data ?? [];
  const table = usePatientPaymentsTable(rows);

  return (
    <PatientSection
      section="payments"
      data-testid={manifest.testId}
      columns={
        <DataTableColumnChooser
          table={table}
          tableId={PATIENT_SECTION_TABLE_IDS.payments}
        />
      }
      className="flex flex-col"
    >
      <PatientSectionTable
        section="payments"
        table={table}
        loading={payments.isPending}
        countLabel={
          rows.length > 0
            ? t(PATIENT_TABLE_KEYS.payments.count, { count: rows.length })
            : undefined
        }
        minWidth={760}
        rowTone={(row) => (row.direction === 'paid' ? 'blush' : undefined)}
      />
    </PatientSection>
  );
}
