import { Outlet, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
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
import { RetryError } from '@/shared/components/RetryError/index.ts';
import {
  type RoomFilterCopy,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { SettleCreditDrawer } from '@/shared/components/SettleCreditDrawer/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { useCreditList } from '@/shared/hooks/useCredits/index.ts';
import { useListLoadError } from '@/shared/hooks/useListLoadError/index.ts';
import {
  type PaymentAccess,
  usePaymentAccess,
} from '@/shared/hooks/usePaymentAccess/index.ts';
import { PenLine, Receipt, RefreshCw, Trash, Wallet } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PAYMENTS_KEYS, PAYMENTS_NS, PENDING_TABLE_ID } from '../payments.constants.ts';
import {
  PaymentsToolbar,
  type PaymentsToolbarProps,
} from '../shared/components/PaymentsToolbar/index.ts';
import { CreditDeleteConfirm } from './components/CreditDeleteConfirm/index.ts';
import { CreditDrawer } from './components/CreditDrawer/index.ts';
import {
  creditReason,
  isChangeableCredit,
  isOpenCredit,
  useCreditLockLabel,
} from './components/PendingCells/index.ts';
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

/** Pending's minimum width with every column (`payments.md:46`, and the 130px By). */
const PENDING_MIN_WIDTH = 1370;

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

/** The row actions' callbacks. */
interface PendingRowHandlers {
  onSettle: (credit: CreditRow) => void;
  onUseOnBill: (credit: CreditRow) => void;
  onEdit: (credit: CreditRow) => void;
  onDelete: (credit: CreditRow) => void;
}

/**
 * An open credit's actions (`payments.md:50`), each for those whose codes allow it: Got it back
 * (`payment:create` — money comes in), Give back and Use on next bill (money goes back —
 * `payment:create` and `payment:delete`, clinozy-be D83 (1)), and while nothing of it is settled
 * Edit (`payment:update`) and Delete (`payment:delete`). A settled credit has none.
 */
function usePendingRowActions(
  access: PaymentAccess,
  handlers: PendingRowHandlers,
): (credit: CreditRow) => DataTableRowAction[] {
  const { t } = useTranslation(PAYMENTS_NS);
  return (credit) => {
    if (!isOpenCredit(credit)) return [];
    const changeable = isChangeableCredit(credit);
    const actions: DataTableRowAction[] = [];
    const givesBack = credit.direction === 'give';
    if (givesBack ? access.canGiveBack : access.canCreate) {
      actions.push({
        id: 'settle',
        label: t(
          givesBack
            ? PAYMENTS_KEYS.rowActions.giveBack
            : PAYMENTS_KEYS.rowActions.gotBack,
        ),
        icon: Wallet,
        onSelect: () => handlers.onSettle(credit),
      });
    }
    if (access.canGiveBack && canUseOnBill(credit)) {
      actions.push({
        id: 'use-on-bill',
        label: t(PAYMENTS_KEYS.rowActions.useOnBill),
        icon: Receipt,
        onSelect: () => handlers.onUseOnBill(credit),
      });
    }
    if (access.canEdit && changeable) {
      actions.push({
        id: 'edit',
        label: t(PAYMENTS_KEYS.rowActions.edit),
        icon: PenLine,
        onSelect: () => handlers.onEdit(credit),
      });
    }
    if (access.canDelete && changeable) {
      actions.push({
        id: 'delete',
        label: t(PAYMENTS_KEYS.rowActions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () => handlers.onDelete(credit),
      });
    }
    return actions;
  };
}

/** "+ Add pending" and its "⌄" (Give · Take), for those who may record money (`payment:create`). */
function usePendingPrimary(
  canCreate: boolean,
  openCreate: (direction?: CreditDirection) => void,
): PaymentsToolbarProps<CreditRow>['primary'] {
  const { t } = useTranslation(PAYMENTS_NS);
  if (!canCreate) return undefined;
  return {
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
  };
}

/**
 * Payments › Pending (KICKOFF §6.9 Pending; `payments.md:41–55`) on clinozy-be
 * (`GET /app/pending-credits`, 50 a page): the room toolbar on its second tab —
 * with "+ Add pending" and its "⌄" (Give · Take) — over the shared table of
 * credits: Ref · Who · Which way · Amount · Why · Since · State · By, newest
 * first, Who carrying the meta line and Amount the phone's key. Search finds
 * the person, the supplier's name or a `CR-` number (D81). An open credit
 * nothing has settled opens Edit pending and offers Edit and Delete; one with a
 * part settled answers its click with "CR-1 · ₹50 settled · it can’t change
 * now"; a settled one with its state. Give back / Got it back and Use on next
 * bill settle an open one. The gates are the member's `payment:*` codes
 * (`usePaymentAccess`). A first read that fails shows the error in place, with
 * Retry. Its dialog routes render nothing: this page reads the URL and opens
 * their drawers.
 */
export function PendingPage() {
  const { t } = useTranslation(PAYMENTS_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const search = validatePendingSearch(useSearch({ strict: false }));
  const access = usePaymentAccess();
  const filters = useRoomFilters(PENDING_FILTER_FIELDS);
  const filterCopy = usePendingFilterCopy();
  const [deleting, setDeleting] = useState<CreditRow | null>(null);
  const [settling, setSettling] = useState<CreditRow | null>(null);
  const adjustOnBill = useCreditOnBill();
  const lockLabel = useCreditLockLabel();
  const { dialog, close } = usePendingDialogRoute();

  const params = creditListParamsOf(search);
  const list = useCreditList(params);
  const rows = useListLoadError(list, PENDING_TABLE_ID);
  const table = usePendingTable(rows);
  const failed = list.isError && rows.length === 0 && !list.isPending;

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
    const lock = lockLabel(credit);
    if (lock) {
      // A settled credit says why it stays; a fully settled one stays silent (`payments.md:49`).
      if (isOpenCredit(credit)) notify.info(lock);
      return;
    }
    void navigate({
      ...organizationPendingEdit(organizationSlug, credit.id),
      search: (current: Record<string, unknown>) => validatePendingSearch(current),
    });
  };
  const rowActions = usePendingRowActions(access, {
    onSettle: setSettling,
    onUseOnBill: (credit) => void adjustOnBill(credit),
    onEdit: openCredit,
    onDelete: setDeleting,
  });
  const primary = usePendingPrimary(access.canCreate, openCreate);

  return (
    <section
      data-testid="payments-pending-page"
      className="bg-canvas flex min-h-0 flex-1 flex-col"
    >
      <PaymentsToolbar
        table={table}
        tableId={PENDING_TABLE_ID}
        searchPlaceholder={t(PAYMENTS_KEYS.pending.search)}
        filters={{ fields: PENDING_FILTER_FIELDS, copy: filterCopy }}
        onDayClose={
          access.canRead
            ? () =>
                void navigate({ ...organizationDayClose(organizationSlug), search: {} })
            : undefined
        }
        primary={primary}
      />
      {failed ? (
        <RetryError
          message={tErrors(ERRORS_KEYS.frontend.query.loadFailed)}
          onRetry={list.refetch}
        />
      ) : (
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
              onAdd={access.canCreate ? () => openCreate() : undefined}
            />
          }
          className="m-(--room-card-margin) flex-1"
        />
      )}
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
