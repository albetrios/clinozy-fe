import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadCsv, toCsv } from '@/lib/csv.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import {
  organizationDayClose,
  organizationPaymentEdit,
  organizationPaymentPay,
  organizationPaymentReceive,
} from '@/lib/routes/payments-builders.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import { LEDGER_FILTER_VALUES } from '@/shared/api/app/ledger-filter-values.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { PAYMENT_KIND_TONES, PAYMENT_MODE_TONES } from '@/shared/app/app-tones.ts';
import { DataTable } from '@/shared/components/DataTable/index.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import { EmptyState, EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import {
  ledgerEntryEditable,
  ledgerEntryFixed,
  ledgerEntryLock,
  ledgerWhat,
  useLedgerSubLine,
} from '@/shared/components/LedgerCells/index.ts';
import {
  PaymentDeleteConfirm,
  type PaymentDeleteTarget,
} from '@/shared/components/PaymentDeleteConfirm/index.ts';
import { PaymentReverseConfirm } from '@/shared/components/PaymentReverseConfirm/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import {
  type RoomFilterCopy,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useLedgerRowActions } from '@/shared/hooks/useLedgerRowActions/index.ts';
import { ledgerRowTone, useLedgerTable } from '@/shared/hooks/useLedgerTable/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePaymentAccess } from '@/shared/hooks/usePaymentAccess/index.ts';
import { useLedgerCount, useLedgerList } from '@/shared/hooks/usePayments/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import { ArrowDownLeft, ArrowUpRight, FileIcon, Wallet } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PaymentsDrawers } from './components/PaymentsDrawers/index.ts';
import { usePaymentsDialogRoute } from './hooks/usePaymentsDialogRoute/index.ts';
import {
  LEDGER_FILTER_FIELDS,
  LEDGER_TABLE_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from './payments.constants.ts';
import { ledgerListParamsOf } from './payments.params.ts';
import { validatePaymentsSearch } from './payments.search.ts';
import { PaymentsToolbar } from './shared/components/PaymentsToolbar/index.ts';

/** The exported file's name. */
const EXPORT_FILE_NAME = 'payments.csv';

/** How many placeholder rows stand in for the list while it loads. */
const SKELETON_ROWS = 8;

/** The ledger's minimum width with every column (`payments.md:30`). */
const LEDGER_MIN_WIDTH = 1180;

/**
 * What the table shows while the ledger's first page loads, or when nothing is
 * in it — the in-place skeleton, the room's empty state (a butter tile with
 * `Wallet`, "No entry matches", and Receive), or the filtered one
 * (`payments.md:398`). A search, filter or Day close's day keeps the rows and
 * turns them to bars (the table's `refreshing`).
 */
function LedgerEmpty({
  loading,
  filtered,
  onClearFilters,
  onReceive,
}: {
  loading: boolean;
  filtered: boolean;
  onClearFilters: () => void;
  onReceive?: () => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  if (loading) {
    return (
      <SkeletonRows
        rows={SKELETON_ROWS}
        avatar
        label={t(PAYMENTS_KEYS.manifest.title)}
        rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
      />
    );
  }
  if (filtered) return <EmptyState tone="butter" onClearFilters={onClearFilters} />;
  return (
    <EmptyState
      tone="butter"
      icon={<Wallet />}
      title={t(PAYMENTS_KEYS.empty.ledgerTitle)}
      description={t(PAYMENTS_KEYS.empty.description)}
      action={
        onReceive ? (
          <EmptyStateAction onClick={onReceive}>
            {t(PAYMENTS_KEYS.empty.receive)}
          </EmptyStateAction>
        ) : undefined
      }
    />
  );
}

/** The Filters popover's sections (`payments.md:39`): Show (All by default), What, Mode. */
function useLedgerFilterCopy(): Readonly<Record<string, RoomFilterCopy>> {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  return {
    direction: {
      label: t(PAYMENTS_KEYS.filters.show),
      anyLabel: t(PAYMENTS_KEYS.filters.all),
      options: {
        received: { label: t(PAYMENTS_KEYS.directions.received), tone: 'sage' },
        paid: { label: t(PAYMENTS_KEYS.directions.paid), tone: 'blush' },
      },
    },
    kind: {
      label: t(PAYMENTS_KEYS.columns.what),
      options: Object.fromEntries(
        LEDGER_FILTER_VALUES.kind.map((kind) => [
          kind,
          { label: t(PAYMENTS_KEYS.kinds[kind]), tone: PAYMENT_KIND_TONES[kind] },
        ]),
      ),
    },
    mode: {
      label: t(PAYMENTS_KEYS.columns.mode),
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

/**
 * One CSV row of an entry: its cells as the ledger words them — but When as
 * the full date and time in the member's date format, not the room's "Mon
 * 9:10 am": a sheet outlives the day it was exported. Amount is signed rupees,
 * so a sheet sums them.
 */
function useLedgerCsv() {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tApp } = useTranslation(APP_NS);
  const { formatDate } = useLocaleFormat();
  const subLine = useLedgerSubLine();
  const headers = [
    t(PAYMENTS_KEYS.columns.ref),
    t(PAYMENTS_KEYS.columns.what),
    t(PAYMENTS_KEYS.columns.when),
    t(PAYMENTS_KEYS.columns.party),
    t(PAYMENTS_KEYS.columns.mode),
    t(PAYMENTS_KEYS.columns.amount),
    t(PAYMENTS_KEYS.columns.by),
  ];
  const rowOf = (row: LedgerRow) => [
    displayId.payment(row.seq),
    t(ledgerWhat(row).labelKey),
    formatDate(row.paidAt),
    [row.partyName, subLine(row)].filter(Boolean).join(' · '),
    [...new Set(row.splits.map((split) => tApp(APP_KEYS.paymentModes[split.mode])))].join(
      ' + ',
    ),
    (row.direction === 'received' ? 1 : -1) * row.amount,
    row.by?.name ?? '',
  ];
  return { headers, rowOf };
}

/**
 * The rows as the ledger shows them: a reversal of money out names nobody on the API (no payee,
 * no contact), so it takes the name of the entry it undid when that entry is loaded — a reversal
 * is newer than its entry, so the entry shows further down the same ledger.
 */
function withReversedParties(rows: readonly LedgerRow[]): readonly LedgerRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return rows.map((row) => {
    if (row.kind !== 'reversal' || row.partyName !== '' || !row.reversesPaymentId) {
      return row;
    }
    const original = byId.get(row.reversesPaymentId);
    return original ? { ...row, partyName: original.partyName } : row;
  });
}

/** The bulk bar's Export of the selected rows, for those who may export (`payment:export`). */
function useExportAction(canExport: boolean): DataTableBulkAction<LedgerRow>[] {
  const { t } = useTranslation(PAYMENTS_NS);
  const csv = useLedgerCsv();
  if (!canExport) return [];
  return [
    {
      id: 'export',
      label: t(PAYMENTS_KEYS.bulk.export),
      icon: FileIcon,
      onSelect: (selected) => {
        downloadCsv(EXPORT_FILE_NAME, toCsv(csv.headers, selected.map(csv.rowOf)));
        notify.success(t(PAYMENTS_KEYS.bulk.exported, { count: selected.length }));
      },
    },
  ];
}

/**
 * Payments room — the ledger on clinozy-be (KICKOFF §6.9 Ledger; `payments.md:25–39`;
 * `GET /app/payments`): the room toolbar (tabs Payments · Pending, the search — the person, the
 * payee or a PAY- number — Filters, saved views, Columns, Day close, and the paired Pay +
 * Receive — floating pills on a phone) over the shared table: receipts, refunds, expenses,
 * supplier bills, money back and reversals newest first, folded on a tablet (What · When · Amount
 * at 820), rows on a phone with Amount as the key column, selection with Export from `md`,
 * infinite scroll over cursor pages, the footer's count ("13 entries", the API's). An open day's
 * receipt or money out opens its drawer and offers Edit and Delete; a refund or a reversal only
 * Delete; a closed day's entry answers its click with "PAY-5509 · Day closed" and offers Reverse.
 * The gates are the member's `payment:*` codes (`usePaymentAccess`). The Show, What, Mode,
 * Created and search filters live in the URL; while Day close is open the ledger lists only its
 * day. A first read that fails shows the error in place, with Retry. The room's dialog routes
 * render nothing: this page reads the URL and opens their drawers.
 */
export function PaymentsPage() {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validatePaymentsSearch(useSearch({ strict: false }));
  const { preferences } = usePreferences();
  const access = usePaymentAccess();
  const filters = useRoomFilters(LEDGER_FILTER_FIELDS);
  const filterCopy = useLedgerFilterCopy();
  const [deleting, setDeleting] = useState<PaymentDeleteTarget | null>(null);
  const [reversing, setReversing] = useState<LedgerRow | null>(null);
  const { dialog, close } = usePaymentsDialogRoute();

  const reviewDay =
    dialog.kind === 'dayClose' ? (dialog.search.date ?? appToday()) : undefined;
  const params = ledgerListParamsOf(search, {
    branchIds: preferences.branchFilter,
    day: reviewDay,
  });
  const list = useLedgerList(params);
  const rows = withReversedParties(useListLoadError(list, LEDGER_TABLE_ID));
  const count = useLedgerCount(params).data ?? null;
  const table = useLedgerTable(rows, LEDGER_TABLE_ID);
  const failed = list.isError && rows.length === 0 && !list.isPending;

  const openReceive = () =>
    void navigate({ ...organizationPaymentReceive(organizationSlug), search: {} });
  const openPay = () =>
    void navigate({ ...organizationPaymentPay(organizationSlug), search: {} });
  const openEntry = (row: LedgerRow) => {
    const lock = ledgerEntryLock(row, t);
    if (lock) {
      notify.info(lock);
      return;
    }
    if (!ledgerEntryEditable(row)) {
      notify.info(ledgerEntryFixed(row, t));
      return;
    }
    void navigate({
      ...organizationPaymentEdit(organizationSlug, row.id),
      search: (current: Record<string, unknown>) => validatePaymentsSearch(current),
    });
  };

  const rowActions = useLedgerRowActions({
    onEdit: openEntry,
    onDelete: setDeleting,
    onReverse: setReversing,
  });
  const bulkActions = useExportAction(access.canExport);

  return (
    <section
      data-testid="payments-page"
      className="bg-canvas flex min-h-0 flex-1 flex-col"
    >
      <PaymentsToolbar
        table={table}
        tableId={LEDGER_TABLE_ID}
        searchPlaceholder={t(PAYMENTS_KEYS.ledger.search)}
        filters={{ fields: LEDGER_FILTER_FIELDS, copy: filterCopy }}
        onDayClose={
          access.canRead
            ? () =>
                void navigate({ ...organizationDayClose(organizationSlug), search: {} })
            : undefined
        }
        primary={
          access.canCreate
            ? {
                secondary: {
                  id: 'pay',
                  label: t(PAYMENTS_KEYS.toolbar.pay),
                  title: t(PAYMENTS_KEYS.toolbar.payTitle),
                  icon: ArrowUpRight,
                  iconClassName: 'text-destructive',
                  onSelect: openPay,
                },
                action: {
                  id: 'receive',
                  label: t(PAYMENTS_KEYS.toolbar.receive),
                  title: t(PAYMENTS_KEYS.toolbar.receiveTitle),
                  icon: ArrowDownLeft,
                  onSelect: openReceive,
                },
              }
            : undefined
        }
      />
      {failed ? (
        <RetryError
          message={tErrors(ERRORS_KEYS.frontend.query.loadFailed)}
          onRetry={list.refetch}
        />
      ) : (
        <DataTable
          table={table}
          tableId={LEDGER_TABLE_ID}
          label={t(PAYMENTS_KEYS.manifest.title)}
          recordsLabel={t(PAYMENTS_KEYS.ledger.records)}
          countLabel={
            count === null ? undefined : t(PAYMENTS_KEYS.ledger.count, { count })
          }
          fold
          selectable
          minWidth={LEDGER_MIN_WIDTH}
          onRowClick={(row) => openEntry(row.original)}
          getRowTone={(row) => ledgerRowTone(row.original)}
          rowActions={(row) => rowActions(row.original)}
          bulkActions={bulkActions}
          hasNextPage={list.hasNextPage}
          isFetchingNextPage={list.isFetchingNextPage}
          fetchNextPage={list.fetchNextPage}
          refreshing={list.isRefreshing}
          empty={
            <LedgerEmpty
              loading={list.isPending}
              filtered={filters.count > 0 || Boolean(search.q)}
              onClearFilters={() => filters.apply({})}
              onReceive={access.canCreate ? openReceive : undefined}
            />
          }
          className="m-(--room-card-margin) flex-1"
        />
      )}
      <PaymentDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <PaymentReverseConfirm entry={reversing} onClose={() => setReversing(null)} />
      <PaymentsDrawers
        dialog={dialog}
        onClose={close}
        onDayChange={(date) =>
          void navigate({
            ...organizationDayClose(organizationSlug),
            search: (current: Record<string, unknown>) => ({ ...current, date }),
            replace: true,
          })
        }
      />
      <Outlet />
    </section>
  );
}
