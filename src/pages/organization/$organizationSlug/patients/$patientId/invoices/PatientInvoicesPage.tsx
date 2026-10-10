'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import type {
  InvoiceRecord,
  InvoiceTotals,
} from '@/shared/api/clinic/invoices-contracts.ts';
import { INVOICE_STATUS_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import {
  INVOICE_DRAWER_KEYS,
  INVOICE_DRAWER_NS,
  InvoiceDeleteConfirm,
} from '@/shared/components/InvoiceDrawer/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { useInvoiceList, useInvoiceTotals } from '@/shared/hooks/useInvoices/index.ts';
import { useRupeeFormat } from '@/shared/hooks/useRupeeFormat/index.ts';

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
 * The footer's "2 invoices · ₹4,800 due" — the server's count and due over all her invoices
 * (`estimated_total`, `meta.due_total`), never summed here; the rows on screen count once every
 * page is in. Nothing until the totals have answered (or failed), so the line never changes under
 * the reader.
 */
function useCountLabel({
  loaded,
  complete,
  totals,
}: {
  /** How many rows are on screen. */
  loaded: number;
  /** Every page is in. */
  complete: boolean;
  totals: { data: InvoiceTotals | null | undefined; isPending: boolean };
}): string | undefined {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const formatRupees = useRupeeFormat();
  if (loaded === 0 || totals.isPending) return undefined;
  const count = totals.data?.count ?? (complete ? loaded : null);
  if (count === null) return undefined;
  const due = totals.data?.due ?? 0;
  return due > 0
    ? t(keys.invoices.countDue, { count, due: formatRupees(due) })
    : t(keys.invoices.count, { count });
}

/**
 * Patient file › Invoices (KICKOFF §6.6 Section tables; H:4748;
 * `patient-file.md:34–46`) on clinozy-be: the patient's invoices newest first
 * (`GET /app/invoices?patient_id=`, 50 a page as the table scrolls), the
 * status's start bar, "2 invoices · ₹4,800 due" from the server's totals
 * (`meta.due_total`); a billing section, so it also needs billing view
 * (`S:33`). A row opens Edit invoice — the shared Invoice drawer (L-40), the
 * file kept behind it (`from`, §4) — or, for a member who may not change it,
 * its preview; the row's actions print, preview, copy, record a payment, edit
 * and delete it ("Delete this invoice?", Undo), each on its `payment:*` code.
 * A failed read says so in place, with Retry.
 */
export function PatientInvoicesPage() {
  const { t } = useTranslation([PATIENT_TABLE_NS, INVOICE_DRAWER_NS, ERRORS_NS]);
  const { patientId } = usePatientFileContext();
  const invoices = useInvoiceList({ patientId });
  const totals = useInvoiceTotals({ patientId });
  const table = useInvoicesTable(invoices.rows);
  const [deleting, setDeleting] = useState<InvoiceRecord | null>(null);
  const row = useInvoiceRowActions({ onDelete: setDeleting });
  const countLabel = useCountLabel({
    loaded: invoices.rows.length,
    complete: !invoices.hasNextPage,
    totals,
  });

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
      {invoices.isError && invoices.rows.length === 0 ? (
        <RetryError
          message={t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS })}
          onRetry={invoices.refetch}
          isRetrying={invoices.isFetching}
        />
      ) : (
        <PatientSectionTable
          section="invoices"
          table={table}
          loading={invoices.isPending}
          countLabel={countLabel}
          minWidth={1120}
          onRowClick={row.open}
          rowTone={(invoice) => INVOICE_STATUS_TONES[invoice.status]}
          rowActions={row.actions}
          paging={invoices}
        />
      )}
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
