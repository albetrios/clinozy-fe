import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  organizationDayClose,
  organizationPendingCreate,
  organizationPendingEdit,
} from '@/lib/routes/payments-builders.ts';
import type { CreditDirection } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  CreditListParams,
  CreditRow,
} from '@/shared/api/clinic/credits-contracts.ts';
import {
  CREDIT_DIRECTION_TONES,
  CREDIT_STATUS_TONES,
} from '@/shared/clinic/clinic-tones.ts';
import { DataTable } from '@/shared/components/DataTable/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { EmptyState, EmptyStateAction } from '@/shared/components/EmptyState/index.ts';
import {
  type RoomFilterCopy,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { SettleCreditDrawer } from '@/shared/components/SettleCreditDrawer/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useCreditList } from '@/shared/hooks/useCredits/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import { PenLine, Receipt, RefreshCw, Trash, Wallet } from '@/shared/icons/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS, PENDING_TABLE_ID } from '../payments.constants.ts';
import { PaymentsToolbar } from '../shared/components/PaymentsToolbar/index.ts';
import { CreditDeleteConfirm } from './components/CreditDeleteConfirm/index.ts';
import { CreditDrawer } from './components/CreditDrawer/index.ts';
import { creditReason, isOpenCredit } from './components/PendingCells/index.ts';
import { canUseOnBill, useCreditOnBill } from './hooks/useCreditOnBill/index.ts';
import {
  type PendingDialogRoute,
  usePendingDialogRoute,
} from './hooks/usePendingDialogRoute/index.ts';
import { pendingRowTone, usePendingTable } from './hooks/usePendingTable/index.ts';
import { PENDING_FILTER_FIELDS } from './pending.constants.ts';
import {
  PENDING_FILTER_VALUES,
  type PendingSearch,
  validatePendingSearch,
} from './pending.search.ts';

/** How many placeholder rows stand in for the list while it loads. */
const SKELETON_ROWS = 6;

/** Pending's minimum width with every column (`payments.md:46`). */
const PENDING_MIN_WIDTH = 1240;

/** The list read's params for the URL as it stands. */
function creditListParamsOf(search: PendingSearch): CreditListParams {
  return {
    direction: search.direction,
    status: search.status,
    created: search.created,
    q: search.q,
  };
}

/** The Filters popover's sections (`payments.md:55`): Which way and State. */
function usePendingFilterCopy(): Readonly<Record<string, RoomFilterCopy>> {
  const { t } = useTranslation(PAYMENTS_NS);
  const K = PAYMENTS_KEYS.pending;
  return {
    direction: {
      label: t(PAYMENTS_KEYS.columns.way),
      options: Object.fromEntries(
        PENDING_FILTER_VALUES.direction.map((direction) => [
          direction,
          { label: t(K.ways[direction]), tone: CREDIT_DIRECTION_TONES[direction] },
        ]),
      ),
    },
    status: {
      label: t(PAYMENTS_KEYS.columns.state),
      options: Object.fromEntries(
        PENDING_FILTER_VALUES.status.map((status) => [
          status,
          { label: t(K.states[status]), tone: CREDIT_STATUS_TONES[status] },
        ]),
      ),
    },
  };
}

/** The drawer the URL opens over Pending: Add pending, or an open credit's Edit pending. */
function PendingDrawers({
  dialog,
  onClose,
}: {
  dialog: PendingDialogRoute;
  onClose: () => void;
}) {
  if (dialog.kind === 'create') {
    return (
      <CreditDrawer
        open
        mode="create"
        direction={dialog.prefill.direction}
        onClose={onClose}
      />
    );
  }
  if (dialog.kind !== 'edit' || !dialog.credit) return null;
  return (
    <CreditDrawer
      open
      mode="edit"
      credit={dialog.credit}
      readOnly={dialog.readOnly}
      onClose={onClose}
    />
  );
}

/** The skeleton, the empty state ("Nothing pending" + Add pending) or the filtered one. */
function PendingEmpty({
  loading,
  filtered,
  onClearFilters,
  onAdd,
}: {
  loading: boolean;
  filtered: boolean;
  onClearFilters: () => void;
  onAdd?: () => void;
}) {
  const { t } = useTranslation(PAYMENTS_NS);
  if (loading) {
    return (
      <SkeletonRows
        rows={SKELETON_ROWS}
        avatar
        label={t(PAYMENTS_KEYS.tabs.pending)}
        rowClassName="h-13.25 border-b border-b-muted px-(--table-pad-x)"
      />
    );
  }
  if (filtered) return <EmptyState tone="butter" onClearFilters={onClearFilters} />;
  return (
    <EmptyState
      tone="butter"
      icon={<Wallet />}
      title={t(PAYMENTS_KEYS.empty.pendingTitle)}
      description={t(PAYMENTS_KEYS.empty.description)}
      action={
        onAdd ? (
          <EmptyStateAction onClick={onAdd}>
            {t(PAYMENTS_KEYS.toolbar.addPending)}
          </EmptyStateAction>
        ) : undefined
      }
    />
  );
}

/**
 * Payments › Pending (KICKOFF §6.9 Pending; `payments.md:41–55`): the room
 * toolbar on its second tab — with "+ Add pending" and its "⌄" (Give · Take) —
 * over the shared table of credits: Ref · Who · Which way · Amount · Why · Since
 * · State, newest first, Who carrying the meta line and Amount the phone's key.
 * An open credit opens Edit pending and offers Edit and Delete; a settled one
 * opens nothing. Its dialog routes render nothing: this page reads the URL and
 * opens their drawers.
 */
export function PendingPage() {
  const { t } = useTranslation(PAYMENTS_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validatePendingSearch(useSearch({ strict: false }));
  const access = useClinicAccess();
  const filters = useRoomFilters(PENDING_FILTER_FIELDS);
  const filterCopy = usePendingFilterCopy();
  const [deleting, setDeleting] = useState<CreditRow | null>(null);
  const [settling, setSettling] = useState<CreditRow | null>(null);
  const adjustOnBill = useCreditOnBill();
  const { dialog, close } = usePendingDialogRoute();

  const params = creditListParamsOf(search);
  const list = useCreditList(params);
  useListLoadError(list, PENDING_TABLE_ID);
  const table = usePendingTable(list.rows);

  const can = (action: 'create' | 'edit' | 'delete') =>
    access.isResolved && access.can('payments', action);
  // Give / Take name the way through Pending's own `direction` (`S:88–89`):
  // the list behind follows it too.
  const openCreate = (direction?: CreditDirection) =>
    void navigate({
      ...organizationPendingCreate(organizationSlug),
      search: (current: Record<string, unknown>) => ({
        ...validatePendingSearch(current),
        ...(direction ? { direction: [direction] } : {}),
      }),
    });
  const openCredit = (credit: CreditRow) => {
    if (!isOpenCredit(credit)) return;
    void navigate({
      ...organizationPendingEdit(organizationSlug, credit.id),
      search: (current: Record<string, unknown>) => validatePendingSearch(current),
    });
  };

  // Give back writes money out to them: the `refund` ability (Q-U8).
  const canSettle = (credit: CreditRow) =>
    access.isResolved &&
    (credit.direction === 'give' ? access.canAbility('refund') : can('create'));

  const rowActions = (credit: CreditRow): DataTableRowAction[] => {
    // Open credits only (`payments.md:50`).
    if (!isOpenCredit(credit)) return [];
    const actions: DataTableRowAction[] = [];
    if (canSettle(credit)) {
      actions.push({
        id: 'settle',
        label: t(
          credit.direction === 'give'
            ? PAYMENTS_KEYS.rowActions.giveBack
            : PAYMENTS_KEYS.rowActions.gotBack,
        ),
        icon: Wallet,
        onSelect: () => setSettling(credit),
      });
    }
    if (canUseOnBill(credit) && can('create')) {
      actions.push({
        id: 'use-on-bill',
        label: t(PAYMENTS_KEYS.rowActions.useOnBill),
        icon: Receipt,
        onSelect: () => void adjustOnBill(credit),
      });
    }
    if (can('edit')) {
      actions.push({
        id: 'edit',
        label: t(PAYMENTS_KEYS.rowActions.edit),
        icon: PenLine,
        onSelect: () => openCredit(credit),
      });
    }
    if (can('delete')) {
      actions.push({
        id: 'delete',
        label: t(PAYMENTS_KEYS.rowActions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () => setDeleting(credit),
      });
    }
    return actions;
  };

  return (
    <section
      data-testid="payments-pending-page"
      className="bg-canvas flex min-h-0 flex-1 flex-col"
    >
      <PaymentsToolbar
        table={table}
        tableId={PENDING_TABLE_ID}
        filters={{ fields: PENDING_FILTER_FIELDS, copy: filterCopy }}
        onDayClose={() =>
          void navigate({ ...organizationDayClose(organizationSlug), search: {} })
        }
        primary={
          can('create')
            ? {
                action: {
                  id: 'add',
                  label: t(PAYMENTS_KEYS.toolbar.addPending),
                  onSelect: () => openCreate(),
                },
                menu: {
                  actions: [
                    {
                      id: 'give',
                      label: t(PAYMENTS_KEYS.toolbar.give),
                      sub: t(PAYMENTS_KEYS.toolbar.giveSub),
                      icon: RefreshCw,
                      tone: 'blush',
                      onSelect: () => openCreate('give'),
                    },
                    {
                      id: 'take',
                      label: t(PAYMENTS_KEYS.toolbar.take),
                      sub: t(PAYMENTS_KEYS.toolbar.takeSub),
                      icon: Wallet,
                      tone: 'sky',
                      onSelect: () => openCreate('take'),
                    },
                  ],
                },
              }
            : undefined
        }
      />
      <DataTable
        table={table}
        tableId={PENDING_TABLE_ID}
        label={t(PAYMENTS_KEYS.tabs.pending)}
        recordsLabel={t(PAYMENTS_KEYS.pending.records)}
        fold
        selectable
        minWidth={PENDING_MIN_WIDTH}
        onRowClick={(row) => openCredit(row.original)}
        getRowTone={(row) => pendingRowTone(row.original)}
        rowActions={(row) => rowActions(row.original)}
        hasNextPage={list.hasNextPage}
        isFetchingNextPage={list.isFetchingNextPage}
        fetchNextPage={list.fetchNextPage}
        refreshing={list.isRefreshing}
        empty={
          <PendingEmpty
            loading={list.isPending}
            filtered={filters.count > 0 || Boolean(search.q)}
            onClearFilters={() => filters.apply({})}
            onAdd={can('create') ? () => openCreate() : undefined}
          />
        }
        className="m-(--room-card-margin) flex-1"
      />
      <CreditDeleteConfirm credit={deleting} onClose={() => setDeleting(null)} />
      <SettleCreditDrawer
        credit={settling}
        reasonLabel={settling ? creditReason(settling, t) : undefined}
        onClose={() => setSettling(null)}
      />
      <PendingDrawers dialog={dialog} onClose={close} />
      <Outlet />
    </section>
  );
}
