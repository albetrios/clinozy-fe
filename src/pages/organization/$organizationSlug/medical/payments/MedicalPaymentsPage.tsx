import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationPaymentEdit } from '@/lib/routes/payments-builders.ts';
import { LEDGER_FILTER_VALUES } from '@/shared/api/app/ledger-filter-values.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import type { FixtureLedgerListParams } from '@/shared/api/app/payments-fixture-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { PAYMENT_KIND_TONES, PAYMENT_MODE_TONES } from '@/shared/app/app-tones.ts';
import {
  LEDGER_KEYS,
  LEDGER_NS,
  ledgerEntryLock,
} from '@/shared/components/LedgerCells/index.ts';
import {
  PaymentDeleteConfirm,
  type PaymentDeleteTarget,
} from '@/shared/components/PaymentDeleteConfirm/index.ts';
import {
  type RoomFilterCopy,
  type RoomFilterFields,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useFixtureLedgerList } from '@/shared/hooks/useFixtureLedger/index.ts';
import { useLedgerRowActions } from '@/shared/hooks/useLedgerRowActions/index.ts';
import { ledgerRowTone, useLedgerTable } from '@/shared/hooks/useLedgerTable/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { MEDICAL_KEYS, MEDICAL_NS, MEDICAL_TABLE_IDS } from '../medical.constants.ts';
import {
  type MedicalPaymentsSearch,
  validateMedicalPaymentsSearch,
} from '../medical.search.ts';
import { MedicalTable } from '../shared/components/MedicalTable/index.ts';
import { MedicalToolbar } from '../shared/components/MedicalToolbar/index.ts';
import { useMedicalNav } from '../shared/hooks/useMedicalNav/index.ts';

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

/** The ledger read for the URL: its filters and search, the header branches, the Medical scope. */
function ledgerParamsOf(
  search: MedicalPaymentsSearch,
  branchIds: readonly string[],
): FixtureLedgerListParams {
  return {
    kind: search.kind,
    mode: search.mode,
    created: search.created,
    q: search.q,
    branchIds: branchIds.length > 0 ? [...branchIds] : undefined,
    scope: 'medical',
  };
}

/**
 * Medical › Payments (KICKOFF §6.7; `medical.md:121–135`): the Payments ledger
 * limited to Medical (`scope=medical`, `S:71`, `S:1662`) — receipts on Medical
 * invoices ("Sale · Invoice #785"), payments of Medical PO bills and expenses
 * in Medicines — under the Medical toolbar, "New sale" its primary. The shared
 * ledger columns, no sort; What, Mode, Created and the search in the URL. An
 * open day's entry opens in Payments (`/payments/$paymentId/edit` — the
 * drawer over the Payments ledger, a standing deviation, `S:87`) with Edit and
 * Delete in its row; a closed day's answers "PAY-5501 · Day closed".
 */
export function MedicalPaymentsPage() {
  const { t } = useTranslation(MEDICAL_NS);
  const { t: tLedger } = useTranslation(LEDGER_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validateMedicalPaymentsSearch(useSearch({ strict: false }));
  const { preferences } = usePreferences();
  const access = useAppAccess();
  const nav = useMedicalNav();
  const filters = useRoomFilters(MEDICAL_LEDGER_FILTER_FIELDS);
  const filterCopy = useFilterCopy();
  const [deleting, setDeleting] = useState<PaymentDeleteTarget | null>(null);

  const list = useFixtureLedgerList(ledgerParamsOf(search, preferences.branchFilter));
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
    void navigate({ ...organizationPaymentEdit(organizationSlug, row.id), search: {} });
  };
  const rowActions = useLedgerRowActions({ onEdit: openEntry, onDelete: setDeleting });
  const canCreate = access.isResolved && access.can('medical', 'create');

  return (
    <section data-testid="medical-payments-page" className="flex min-h-0 flex-1 flex-col">
      <MedicalToolbar
        tab="payments"
        table={table}
        filters={{ fields: MEDICAL_LEDGER_FILTER_FIELDS, copy: filterCopy }}
      />
      <MedicalTable
        tab="payments"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(MEDICAL_KEYS.payments.empty)}
        emptyAction={
          canCreate
            ? { label: t(MEDICAL_KEYS.create.sale), onSelect: () => nav.create('sales') }
            : undefined
        }
        recordsLabel={t(MEDICAL_KEYS.payments.records)}
        minWidth={LEDGER_MIN_WIDTH}
        onRowClick={openEntry}
        rowTone={ledgerRowTone}
        rowActions={rowActions}
        exportName="medical-payments.csv"
        avatar
      />
      <PaymentDeleteConfirm target={deleting} onClose={() => setDeleting(null)} fixture />
      <Outlet />
    </section>
  );
}
