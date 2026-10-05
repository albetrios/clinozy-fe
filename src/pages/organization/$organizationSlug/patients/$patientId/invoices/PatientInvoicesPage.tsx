'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PatientInvoiceRow } from '@/shared/api/clinic/payments-contracts.ts';
import { INVOICE_STATUS_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  InvoiceDeleteConfirm,
} from '@/shared/components/InvoiceDrawer/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { usePatientInvoices } from '@/shared/hooks/usePayments/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import {
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  PatientSectionTable,
} from '../shared/components/PatientSectionTable/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { useInvoiceRowActions } from './hooks/useInvoiceRowActions/index.ts';
import { useInvoicesTable } from './hooks/useInvoicesTable/index.ts';
import { manifest } from './invoices.manifest.ts';

const keys = PATIENT_TABLE_KEYS;

/**
 * Patient file › Invoices (KICKOFF §6.6 Section tables; H:4748;
 * `patient-file.md:34–46`): the patient's invoices newest first, the
 * status's start bar, "2 invoices · ₹4,800 due"; a billing section, so it
 * also needs billing view (`S:33`). A row opens Edit invoice — the shared
 * Invoice drawer (L-40), the file kept behind it (`from`, §4) — or, without
 * edit, its preview; the row's actions print, preview, record a payment,
 * edit and delete it ("Delete this invoice?", Undo). "New invoice" opens the
 * drawer for this patient.
 */
export function PatientInvoicesPage() {
  const { t } = useTranslation([PATIENT_TABLE_NS, INVOICE_DRAWER_NS]);
  const { patientId } = usePatientFileContext();
  const formatPaise = usePaiseFormat();
  const invoices = usePatientInvoices(patientId);
  const rows = invoices.data ?? [];
  const table = useInvoicesTable(rows);
  const [deleting, setDeleting] = useState<PatientInvoiceRow | null>(null);
  const row = useInvoiceRowActions({ onDelete: setDeleting });
  const due = rows.reduce((sum, invoice) => sum + invoice.due, 0);

  let countLabel: string | undefined;
  if (rows.length > 0) {
    countLabel =
      due > 0
        ? t(keys.invoices.countDue, { count: rows.length, due: formatPaise(due) })
        : t(keys.invoices.count, { count: rows.length });
  }

  return (
    <PatientSection
      section="invoices"
      data-testid={manifest.testId}
      columns={
        <DataTableColumnChooser
          table={table}
          tableId={PATIENT_SECTION_TABLE_IDS.invoices}
        />
      }
      className="flex flex-col"
    >
      <PatientSectionTable
        section="invoices"
        table={table}
        loading={invoices.isPending}
        countLabel={countLabel}
        minWidth={1120}
        onRowClick={row.open}
        rowTone={(invoice) => INVOICE_STATUS_TONES[invoice.status]}
        rowActions={row.actions}
      />
      {deleting ? (
        <InvoiceDeleteConfirm
          invoice={deleting}
          open
          record={t(INVOICE_DRAWER_KEYS.previewTitle[deleting.type], {
            ns: INVOICE_DRAWER_NS,
            seq: deleting.seq,
          })}
          onClose={() => setDeleting(null)}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </PatientSection>
  );
}
