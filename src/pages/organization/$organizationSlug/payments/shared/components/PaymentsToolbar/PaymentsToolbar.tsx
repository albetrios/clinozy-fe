'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve it
// stale answers (see `DataTable.tsx`).

import { useParams } from '@tanstack/react-router';
import type { ReactTable, RowData } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import type { DataTableFeatures } from '@/shared/components/DataTable/index.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import {
  type RoomAction,
  type RoomFilterCopy,
  type RoomFilterFields,
  type RoomLinkTab,
  RoomTabs,
  RoomToolbar,
} from '@/shared/components/RoomToolbar/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { Receipt, RefreshCw } from '@/shared/icons/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS } from '../../../payments.constants.ts';

/** The room's tab routes (D24): `/payments` is the ledger itself, `/payments/pending` the credits. */
const TAB_ROUTES = {
  ledger: '/organization/$organizationSlug/payments',
  pending: '/organization/$organizationSlug/payments/pending',
} as const;

/** Props of {@link PaymentsToolbar}. */
export interface PaymentsToolbarProps<TData extends RowData> {
  /** The tab's table — the Columns chooser drives its column visibility. */
  table: ReactTable<DataTableFeatures, TData>;
  /** The tab's table id: the toolbar's test-id prefix and its saved views' key. */
  tableId: string;
  /** What the tab's search finds, when it is not the room's "Patient, invoice or receipt". */
  searchPlaceholder?: string;
  /** The tab's Filters and the copy of their chips. */
  filters: {
    fields: RoomFilterFields;
    copy: Readonly<Record<string, RoomFilterCopy>>;
  };
  /** "Day close" (both tabs) — absent for a role without it. */
  onDayClose?: () => void;
  /** The tab's create actions: Pay + Receive, or Add pending with Give / Take. */
  primary?: {
    action: RoomAction;
    secondary?: RoomAction;
    menu?: { label?: string; actions: readonly RoomAction[] };
  };
}

/**
 * The Payments toolbar (KICKOFF §6.9 Toolbar; `payments.md:17`) on the shared
 * room toolbar: h1 "Payments" · the tabs "Payments" · "Pending", folding into
 * "More" when the measured space runs out · the tab's search ("Patient, invoice or
 * receipt"; the ledger's "Patient, payee or PAY-") · saved views · Filters · Columns · "Day close" · the tab's create
 * actions — on a phone the search row, then the tabs with "Day close", and the
 * create actions as floating pills.
 */
export function PaymentsToolbar<TData extends RowData>({
  table,
  tableId,
  searchPlaceholder,
  filters,
  onDayClose,
  primary,
}: PaymentsToolbarProps<TData>) {
  const { t } = useTranslation(PAYMENTS_NS);
  const { organizationSlug = '' } = useParams({ strict: false });
  const tabs: RoomLinkTab[] = [
    {
      id: 'ledger',
      label: t(PAYMENTS_KEYS.tabs.ledger),
      icon: Receipt,
      to: TAB_ROUTES.ledger,
      params: { organizationSlug },
    },
    {
      id: 'pending',
      label: t(PAYMENTS_KEYS.tabs.pending),
      icon: RefreshCw,
      to: TAB_ROUTES.pending,
      params: { organizationSlug },
    },
  ];

  return (
    <RoomToolbar
      title={t(PAYMENTS_KEYS.manifest.title)}
      tableId={tableId}
      layout="actions"
      tabs={
        <RoomTabs
          label={t(PAYMENTS_KEYS.tabs.label)}
          tabs={tabs}
          overflow="fold"
          testIdPrefix={tableId}
        />
      }
      search={{
        placeholder: searchPlaceholder ?? t(PAYMENTS_KEYS.search.placeholder),
        label: t(PAYMENTS_KEYS.search.label),
      }}
      filters={filters}
      columns={<DataTableColumnChooser table={table} tableId={tableId} />}
      actions={
        onDayClose ? (
          <Button
            type="button"
            variant="outline"
            data-testid={`${tableId}-day-close`}
            onClick={onDayClose}
            className="text-body h-9 rounded-lg px-3 shadow-none"
          >
            {t(PAYMENTS_KEYS.toolbar.dayClose)}
          </Button>
        ) : undefined
      }
      primary={primary}
    />
  );
}
