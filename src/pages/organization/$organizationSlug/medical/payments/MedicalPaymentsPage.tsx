import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadCsv } from '@/lib/csv.ts';
import { organizationPaymentEdit } from '@/lib/routes/payments-builders.ts';
import { LEDGER_FILTER_VALUES } from '@/shared/api/app/ledger-filter-values.ts';
import { exportStoreLedger } from '@/shared/api/app/payments-api.ts';
import type { LedgerListParams, LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { PAYMENT_KIND_TONES, PAYMENT_MODE_TONES } from '@/shared/app/app-tones.ts';
import {
  LEDGER_KEYS,
  LEDGER_NS,
  ledgerEntryEditable,
  ledgerEntryFixed,
  ledgerEntryLock,
} from '@/shared/components/LedgerCells/index.ts';
import {
  PaymentDeleteConfirm,
  type PaymentDeleteTarget,
} from '@/shared/components/PaymentDeleteConfirm/index.ts';
import { PaymentReverseConfirm } from '@/shared/components/PaymentReverseConfirm/index.ts';
import {
  type RoomFilterCopy,
  type RoomFilterFields,
  RoomViewAction,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { canExportRows, useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useLedgerRowActions } from '@/shared/hooks/useLedgerRowActions/index.ts';
import { ledgerRowTone, useLedgerTable } from '@/shared/hooks/useLedgerTable/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { FileIcon } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import {
  type MedicalPaymentsSearch,
  validateMedicalPaymentsSearch,
} from '../medical.search.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import { useStoreLedger } from '../shared/hooks/useMedicalLists/index.ts';

const TABLE_ID = MEDICAL_TABLE_IDS.payments;

/** The ledger's minimum width with every column (`medical.md:125`). */
const LEDGER_MIN_WIDTH = 1180;

/** Medical › Payments' Filters (`medical.md:135`): What · Mode · Created — no "Show". */
const MEDICAL_LEDGER_FILTER_FIELDS = {
  kind: { kind: 'options', values: LEDGER_FILTER_VALUES.kind },
  mode: { kind: 'options', values: LEDGER_FILTER_VALUES.mode },
  created: { kind: 'date', presets: 'created' },
} as const satisfies RoomFilterFields;

/** The Filters' What and Mode sections, in the ledger's words and tones. */
function useFilterCopy(): Readonly<Record<string, RoomFilterCopy>> {
  const { t } = useTranslation(LEDGER_NS);
  const { t: tApp } = useTranslation(APP_NS);
  return {
    kind: {
      label: t(LEDGER_KEYS.columns.what),
      options: Object.fromEntries(
        LEDGER_FILTER_VALUES.kind.map((kind) => [
          kind,
          { label: t(LEDGER_KEYS.kinds[kind]), tone: PAYMENT_KIND_TONES[kind] },
        ]),
      ),
    },
    mode: {
      label: t(LEDGER_KEYS.columns.mode),
      options: Object.fromEntries(
        LEDGER_FILTER_VALUES.mode.map((mode) => [
          mode,
          {
            label: tApp(APP_KEYS.paymentModes[mode]),
            tone: PAYMENT_MODE_TONES[mode],
          },
        ]),
      ),
    },
  };
}

/** The store's ledger read for the URL: its filters and search, and the header branches. */
function ledgerParamsOf(
  search: MedicalPaymentsSearch,
  branchIds: readonly string[],
): LedgerListParams {
  return {
    kind: search.kind,
    mode: search.mode,
    created: search.created,
    q: search.q,
    branchIds: branchIds.length > 0 ? [...branchIds] : undefined,
  };
}

/** The export file the server names, when it names none. */
const EXPORT_FILE_NAME = 'medical-payments.csv';

/**
 * Export (`medicine:export`, MD31): the server's CSV of every payment the filters match — not
 * only the rows loaded — saved as a file; past the API's 10,000 it says so.
 */
function ExportAction({ params }: { params: LedgerListParams }) {
  const { t } = useTranslation(MEDICAL_NS);
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    exportStoreLedger(params)
      .then((file) => {
        downloadCsv(file.fileName || EXPORT_FILE_NAME, file.content);
        if (file.truncated) notify.warning(t(MEDICAL_KEYS.payments.exportTruncated));
        else notify.success(t(MEDICAL_KEYS.payments.exported));
      })
      .catch((error: unknown) => notifyError(error))
      .finally(() => setBusy(false));
  };
  return (
    <RoomViewAction
      actionId="export"
      icon={FileIcon}
      label={t(MEDICAL_KEYS.payments.export)}
      title={t(MEDICAL_KEYS.payments.exportTitle)}
      tableId={TABLE_ID}
      disabled={busy}
      onClick={run}
    />
  );
}

/**
 * Medical › Payments (KICKOFF §6.7; `medical.md:121–135`) on clinozy-be — the store's slice of
 * the ledger (`GET /app/medical-payments`, MD31): receipts and refunds on its sales, supplier
 * bills of its orders, `medicines` expenses and their reversals — under the Medical toolbar,
 * "New sale" its primary. The shared ledger columns, no sort; What, Mode, Created and the search
 * in the URL. The store manages its money here (D89): an open day's entry opens in Payments
 * (`/payments/$paymentId/edit` — the drawer over the Payments ledger, a standing deviation,
 * `S:87`) with Edit and Delete (Undo) in its row; a closed day's answers "PAY-5501 · Day closed"
 * and offers Reverse; Export saves the server's CSV of the filtered payments.
 */
export function MedicalPaymentsPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const { t: tLedger } = useTranslation(LEDGER_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validateMedicalPaymentsSearch(useSearch({ strict: false }));
  const { preferences } = usePreferences();
  const access = useAppAccess();
  const filters = useRoomFilters(MEDICAL_LEDGER_FILTER_FIELDS);
  const filterCopy = useFilterCopy();
  const [deleting, setDeleting] = useState<PaymentDeleteTarget | null>(null);
  const [reversing, setReversing] = useState<LedgerRow | null>(null);

  const params = ledgerParamsOf(search, preferences.branchFilter);
  const list = useStoreLedger(params);
  const { rows, loading } = useRoomList(
    list,
    TABLE_ID,
    JSON.stringify([search.q, search.kind, search.mode, search.created]),
  );
  const table = useLedgerTable(loading ? [] : rows, TABLE_ID);

  const openEntry = (row: LedgerRow) => {
    const lock = ledgerEntryLock(row, tLedger);
    if (lock) {
      notify.info(lock);
      return;
    }
    if (!ledgerEntryEditable(row)) {
      notify.info(ledgerEntryFixed(row, tLedger));
      return;
    }
    void navigate({ ...organizationPaymentEdit(organizationSlug, row.id), search: {} });
  };
  const rowActions = useLedgerRowActions({
    onEdit: openEntry,
    onDelete: setDeleting,
    onReverse: setReversing,
  });
  const canExport = canExportRows(access, 'medicine:export');

  return (
    <section data-testid="medical-payments-page" className="flex min-h-0 flex-1 flex-col">
      <MedicalToolbar
        tab="payments"
        table={table}
        filters={{ fields: MEDICAL_LEDGER_FILTER_FIELDS, copy: filterCopy }}
        viewAction={canExport ? <ExportAction params={params} /> : undefined}
      />
      <MedicalTable
        tab="payments"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(MEDICAL_KEYS.payments.empty)}
        recordsLabel={t(MEDICAL_KEYS.payments.records)}
        minWidth={LEDGER_MIN_WIDTH}
        onRowClick={openEntry}
        rowTone={ledgerRowTone}
        rowActions={rowActions}
        exportName="medical-payments.csv"
        avatar
      />
      <PaymentDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <PaymentReverseConfirm entry={reversing} onClose={() => setReversing(null)} />
      <Outlet />
    </section>
  );
}
