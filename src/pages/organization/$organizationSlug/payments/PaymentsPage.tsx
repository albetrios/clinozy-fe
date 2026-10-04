import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadCsv, toCsv } from '@/lib/csv.ts';
import {
  organizationDayClose,
  organizationPaymentEdit,
  organizationPaymentPay,
  organizationPaymentReceive,
} from '@/lib/routes/index.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { PAYMENT_KIND_TONES, PAYMENT_MODE_TONES } from '@/shared/clinic/clinic-tones.ts';
import { DataTable } from '@/shared/components/DataTable/index.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { EmptyState, EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import {
  type RoomFilterCopy,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { useLedgerList } from '@/shared/hooks/usePayments/index.ts';
import { usePreferences } from '@/shared/hooks/usePreferences/index.ts';
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileIcon,
  PenLine,
  Trash,
  Wallet,
} from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useLedgerSubLine, useLedgerWhen } from './components/LedgerCells/index.ts';
import {
  PaymentDeleteConfirm,
  type PaymentDeleteTarget,
} from './components/PaymentDeleteConfirm/index.ts';
import { ledgerRowTone, useLedgerTable } from './hooks/useLedgerTable/index.ts';
import { usePaymentsDialogRoute } from './hooks/usePaymentsDialogRoute/index.ts';
import {
  LEDGER_FILTER_FIELDS,
  LEDGER_TABLE_ID,
  PAYMENTS_KEYS,
  PAYMENTS_NS,
} from './payments.constants.ts';
import { ledgerListParamsOf } from './payments.params.ts';
import { LEDGER_FILTER_VALUES, validatePaymentsSearch } from './payments.search.ts';
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
  const { t: tClinic } = useTranslation(CLINIC_NS);
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
            label: tClinic(CLINIC_KEYS.paymentModes[mode]),
            tone: PAYMENT_MODE_TONES[mode],
          },
        ]),
      ),
    },
  };
}

/** One CSV row of an entry: its cells as the ledger words them. */
function useLedgerCsv() {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tClinic } = useTranslation(CLINIC_NS);
  const when = useLedgerWhen();
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
    t(PAYMENTS_KEYS.directions[row.direction]),
    when(row.paidAt),
    [row.partyName, subLine(row)].filter(Boolean).join(' · '),
    [
      ...new Set(
        row.splits.map((split) => tClinic(CLINIC_KEYS.paymentModes[split.mode])),
      ),
    ].join(' + '),
    // Signed rupees, so a sheet sums them.
    ((row.direction === 'received' ? 1 : -1) * row.amount) / 100,
    row.by?.name ?? '',
  ];
  return { headers, rowOf };
}

/**
 * Payments room — the ledger (KICKOFF §6.9 Ledger; `payments.md:25–39`): the
 * room toolbar (tabs Payments · Pending, search, Filters, saved views, Columns,
 * Day close, and the paired Pay + Receive — floating pills on a phone) over the
 * shared table: receipts, refunds and expenses newest first, folded on a tablet
 * (What · When · Amount at 820), rows on a phone with Amount as the key column,
 * selection with Export from `md`, Edit and Delete on an open day's entries,
 * infinite scroll over cursor pages. A closed day's entry answers its click
 * with "PAY-5509 · Day closed". The Show, What, Mode, Created and search filters
 * live in the URL; while Day close is open the ledger lists only its day. The
 * room's dialog routes render nothing: this page reads the URL and opens their
 * drawers.
 */
export function PaymentsPage() {
  const { t } = useTranslation(PAYMENTS_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validatePaymentsSearch(useSearch({ strict: false }));
  const { preferences } = usePreferences();
  const access = useClinicAccess();
  const filters = useRoomFilters(LEDGER_FILTER_FIELDS);
  const filterCopy = useLedgerFilterCopy();
  const csv = useLedgerCsv();
  const [deleting, setDeleting] = useState<PaymentDeleteTarget | null>(null);
  const { dialog } = usePaymentsDialogRoute();

  const reviewDay =
    dialog.kind === 'dayClose' ? (dialog.search.date ?? clinicToday()) : undefined;
  const params = ledgerListParamsOf(search, {
    branchIds: preferences.branchFilter,
    day: reviewDay,
  });
  const list = useLedgerList(params);
  useListLoadError(list, LEDGER_TABLE_ID);
  const table = useLedgerTable(list.rows);

  const can = (action: 'create' | 'edit' | 'delete') =>
    access.isResolved && access.can('payments', action);
  const openReceive = () =>
    void navigate({ ...organizationPaymentReceive(organizationSlug), search: {} });
  const openPay = () =>
    void navigate({ ...organizationPaymentPay(organizationSlug), search: {} });
  const openEntry = (row: LedgerRow) => {
    if (row.locked) {
      const ref = displayId.payment(row.seq);
      notify.info(
        row.edits.length > 0
          ? t(PAYMENTS_KEYS.ledger.dayClosedEdited, { ref, count: row.edits.length })
          : t(PAYMENTS_KEYS.ledger.dayClosed, { ref }),
      );
      return;
    }
    void navigate({
      ...organizationPaymentEdit(organizationSlug, row.id),
      search: (current: Record<string, unknown>) => validatePaymentsSearch(current),
    });
  };

  const rowActions = (row: LedgerRow): DataTableRowAction[] => {
    // Open-day entries only (`payments.md:34`): a closed day shows no actions.
    if (row.locked) return [];
    const actions: DataTableRowAction[] = [];
    if (can('edit')) {
      actions.push({
        id: 'edit',
        label: t(PAYMENTS_KEYS.rowActions.edit),
        icon: PenLine,
        onSelect: () => openEntry(row),
      });
    }
    if (can('delete')) {
      actions.push({
        id: 'delete',
        label: t(PAYMENTS_KEYS.rowActions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () =>
          setDeleting({
            entry: row,
            dueAfter: row.invoice ? row.invoice.due + row.amount : undefined,
          }),
      });
    }
    return actions;
  };

  const bulkActions: DataTableBulkAction<LedgerRow>[] =
    access.isResolved && access.canAbility('export')
      ? [
          {
            id: 'export',
            label: t(PAYMENTS_KEYS.bulk.export),
            icon: FileIcon,
            onSelect: (selected) => {
              downloadCsv(EXPORT_FILE_NAME, toCsv(csv.headers, selected.map(csv.rowOf)));
              notify.success(t(PAYMENTS_KEYS.bulk.exported, { count: selected.length }));
            },
          },
        ]
      : [];

  return (
    <section data-testid="payments-page" className="flex min-h-0 flex-1 flex-col">
      <PaymentsToolbar
        table={table}
        tableId={LEDGER_TABLE_ID}
        filters={{ fields: LEDGER_FILTER_FIELDS, copy: filterCopy }}
        onDayClose={() =>
          void navigate({ ...organizationDayClose(organizationSlug), search: {} })
        }
        primary={
          can('create')
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
      <DataTable
        table={table}
        tableId={LEDGER_TABLE_ID}
        label={t(PAYMENTS_KEYS.manifest.title)}
        recordsLabel={t(PAYMENTS_KEYS.ledger.records)}
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
            onReceive={can('create') ? openReceive : undefined}
          />
        }
        className="m-(--room-card-margin) flex-1"
      />
      <PaymentDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <Outlet />
    </section>
  );
}
