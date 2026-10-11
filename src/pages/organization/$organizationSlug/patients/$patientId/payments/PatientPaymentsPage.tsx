'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { appCommandNavigation } from '@/shared/app/app-command-targets.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import {
  PaymentDeleteConfirm,
  type PaymentDeleteTarget,
} from '@/shared/components/PaymentDeleteConfirm/index.ts';
import { PaymentReverseConfirm } from '@/shared/components/PaymentReverseConfirm/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { useAppNavigate } from '@/shared/hooks/useAppNavigate/index.ts';
import { useLedgerRowActions } from '@/shared/hooks/useLedgerRowActions/index.ts';
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
 * `patient-file.md:34–46`) on clinozy-be: the ledger's entries for the
 * patient's person (`GET /app/payments?patient_id=` — their contact's receipts,
 * refunds, credits' money and reversals), newest first — money out with the
 * blush start bar — "3 transactions" and "All transactions loaded"; a billing
 * section, so it also needs billing view (`S:33`). A row opens nothing; its
 * actions are the ledger's, by the entry's public id: on an open day Edit
 * (`payment:update` — the entry's drawer over the file, `from`, A-P1) and
 * Delete (`payment:delete`, Undo), on a closed day Reverse (`payment:delete`).
 * A failed read says so in place, with Retry.
 */
export function PatientPaymentsPage() {
  const { t } = useTranslation([PATIENT_TABLE_NS, ERRORS_NS]);
  const navigate = useAppNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const payments = usePatientPayments(patientId);
  const rows = payments.data ?? [];
  const table = usePatientPaymentsTable(rows);
  const [deleting, setDeleting] = useState<PaymentDeleteTarget | null>(null);
  const [reversing, setReversing] = useState<LedgerRow | null>(null);
  const rowActions = useLedgerRowActions({
    onEdit: (row) =>
      void navigate(
        appCommandNavigation('paymentEdit', {
          organizationSlug,
          recordId: row.id,
          referrer: `patients/${patientId}/payments`,
        }),
      ),
    onDelete: setDeleting,
    onReverse: setReversing,
  });

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
      {payments.isError && !payments.data ? (
        <RetryError
          message={t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS })}
          onRetry={() => void payments.refetch()}
          isRetrying={payments.isFetching}
        />
      ) : (
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
          rowActions={rowActions}
        />
      )}
      <PaymentDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <PaymentReverseConfirm entry={reversing} onClose={() => setReversing(null)} />
    </PatientSection>
  );
}
