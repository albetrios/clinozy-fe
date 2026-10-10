import { Outlet, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { formatClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import {
  automaticSection,
  type RoomFilterPerson,
  type RoomFilterSection,
  roomFiltersOf,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { PenLine, Trash } from '@/shared/icons/index.ts';

import {
  StockDeleteConfirm,
  type StockDeleteTarget,
} from '../shared/components/StockDeleteConfirm/index.ts';
import {
  StockPurchaseDrawer,
  usePurchaseDelete,
} from '../shared/components/StockPurchaseDrawer/index.ts';
import { StockStackHost } from '../shared/components/StockStackHost/index.ts';
import { StockTable } from '../shared/components/StockTable/index.ts';
import { StockToolbar } from '../shared/components/StockToolbar/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import { useStockDialogRoute } from '../shared/hooks/useStockDialogRoute/index.ts';
import {
  useStockPurchaseList,
  useStockSummary,
  useStockVendorCatalogue,
} from '../shared/hooks/useStockLists/index.ts';
import { useStockNav } from '../shared/hooks/useStockNav/index.ts';
import { useStockStack } from '../shared/hooks/useStockStack/index.ts';
import { useStockWords } from '../shared/hooks/useStockWords/index.ts';
import { fetchStockPurchase, stockQueryKeys } from '../shared/stock-api.ts';
import type {
  StockListSummary,
  StockPurchaseRow,
  StockVendorRecord,
} from '../shared/stock-contracts.ts';
import { STOCK_DRAWER_KEYS } from '../shared/stock-drawers.constants.ts';
import { sectionValue } from '../shared/stock-filters.ts';
import { STOCK_PURCHASE_STATUS_TONES } from '../shared/stock-units.ts';
import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../stock.constants.ts';
import { STOCK_PURCHASE_STATUSES, validateStockSearch } from '../stock.search.ts';
import { useStockPurchaseColumns } from './hooks/useStockPurchaseColumns/index.ts';
import { purchaseFilterKey, purchaseParamsOf } from './purchases.params.ts';

const TABLE_ID = STOCK_TABLE_IDS.purchases;

/** A clinic vendor as the Supplier section lists them: sky, their phone under the name. */
const vendorChoice = (
  vendor: Pick<StockVendorRecord, 'id' | 'name' | 'phone'>,
): RoomFilterPerson => ({
  id: vendor.id,
  name: vendor.name,
  tone: 'sky',
  role: vendor.phone ? formatClinicPhone(vendor.phone) : '',
});

/**
 * The Filters' Supplier section: one vendor's bills (`stock_vendor_id`) —
 * every live clinic vendor from the room's catalogue, searchable by name.
 * Always offered, so a vendor in the URL counts and clears before the
 * catalogue arrives.
 */
function useVendorSection(): RoomFilterSection {
  const { t } = useTranslation(STOCK_NS);
  const vendors = useStockVendorCatalogue().data ?? [];
  const keys = STOCK_KEYS.purchases.vendorFilter;
  return {
    field: { kind: 'people', single: true },
    copy: {
      label: t(STOCK_KEYS.purchases.columns.vendor),
      clearLabel: t(keys.clear),
      options: {},
      people: {
        members: vendors.map(vendorChoice),
        anyone: t(keys.any),
        count: (count) => t(keys.count, { count }),
        search: t(keys.search),
        noMatch: t(keys.noMatch),
      },
    },
  };
}

/**
 * The Purchases Filters (`clinic-stock.md:55`): the Status section — every
 * `payment_status` the API knows — · Supplier · Created. "Follow-up date" is
 * not built — a purchase has no follow-up (KICKOFF §6.8).
 */
function usePurchaseFilters() {
  const { t } = useTranslation(STOCK_NS);
  const words = useStockWords();
  return roomFiltersOf({
    status: automaticSection(
      t(STOCK_KEYS.filters.status),
      STOCK_PURCHASE_STATUSES.map((status) => sectionValue(status, words.status(status))),
    ),
    vendor: useVendorSection(),
  });
}

/** The footer: "4 purchases · ₹2,310 due" — the server's count and what is due over the filters. */
function useCountLabel(summary: StockListSummary | undefined): string | undefined {
  const { t } = useTranslation(STOCK_NS);
  const { formatRupees } = useStockWords();
  const total = summary?.total ?? null;
  if (total === null) return undefined;
  return t(STOCK_KEYS.purchases.count, {
    count: total,
    due: formatRupees(summary?.due ?? 0),
  });
}

/** A row's Edit and — for those who may delete — Delete, which says why a paid bill stays. */
function usePurchaseRowActions() {
  const { t } = useTranslation(STOCK_NS);
  const access = useStockAccess();
  const nav = useStockNav();
  const [deleting, setDeleting] = useState<StockDeleteTarget | null>(null);
  const askDelete = usePurchaseDelete<StockPurchaseRow>((purchase) =>
    setDeleting({
      kind: 'purchase',
      id: purchase.id,
      name: `#${purchase.seq}`,
      seq: purchase.seq,
      record: purchase.vendor?.name,
    }),
  );
  const rowActions = (purchase: StockPurchaseRow): DataTableRowAction[] => [
    {
      id: 'edit',
      label: t(STOCK_KEYS.purchases.rowActions.edit),
      icon: PenLine,
      onSelect: () => nav.purchaseEdit(purchase.id),
    },
    ...(access.canDelete
      ? [
          {
            id: 'delete',
            label: t(STOCK_KEYS.purchases.rowActions.delete),
            icon: Trash,
            destructive: true,
            onSelect: () => askDelete(purchase),
          },
        ]
      : []),
  ];
  const confirm = (
    <StockDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
  );
  return { rowActions, confirm };
}

/**
 * Clinic stock › Purchases (KICKOFF §6.8; `clinic-stock.md:41–55`) on
 * clinozy-be (`GET /app/stock-purchases`): the Clinic stock toolbar — "+ New
 * purchase" for those who may record one (`stock_item:create`) — over the
 * bills from clinic vendors: ID, Supplier, Invoice (hidden), Date, Bill, Due
 * and Status, the row's edge in its status. A row opens Edit purchase. The
 * footer counts the purchases and what is due on them (`meta.due_total`).
 * Paying a bill ("Pay ₹1,710") waits for Payments (Q-S3): a purchase is paid
 * by its "Paid" when it is recorded. The dialog routes render nothing: this
 * page opens the Purchase drawer for `create/` — `?reorder=low` presets
 * "Reorder low items" — and `$purchaseId/edit/`, with a vendor or an item
 * stacked on it; Delete asks for a reason, on an unpaid purchase only. A
 * first read that fails shows the error in place, with Retry.
 */
export function PurchasesPage() {
  const { t } = useTranslation(STOCK_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const search = validateStockSearch(useSearch({ strict: false }));
  const params = purchaseParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useStockAccess();
  const nav = useStockNav();
  const { fields, copy } = usePurchaseFilters();
  const filters = useRoomFilters(fields);
  const stack = useStockStack();
  const { rowActions, confirm } = usePurchaseRowActions();
  const { dialog, close } = useStockDialogRoute({
    tab: 'purchases',
    param: 'purchaseId',
    queryKey: stockQueryKeys.purchase,
    fetchRecord: fetchStockPurchase,
    recordLabel: t(STOCK_DRAWER_KEYS.records.purchase),
  });

  const list = useStockPurchaseList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, purchaseFilterKey(params));
  const countLabel = useCountLabel(useStockSummary('purchases', params).data);
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useStockPurchaseColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });
  const failed = list.isError && rows.length === 0 && !loading;

  return (
    <section data-testid="stock-purchases-page" className="flex min-h-0 flex-1 flex-col">
      <StockToolbar tab="purchases" table={table} filters={{ fields, copy }} />
      {failed ? (
        <RetryError
          message={tErrors(ERRORS_KEYS.frontend.query.loadFailed)}
          onRetry={list.refetch}
        />
      ) : (
        <StockTable
          tab="purchases"
          table={table}
          list={list}
          loading={loading}
          filtered={filters.count > 0}
          onClearFilters={() => filters.apply({})}
          emptyTitle={t(STOCK_KEYS.empty.stock)}
          emptyAction={
            access.canCreate
              ? {
                  label: t(STOCK_KEYS.create.purchase),
                  onSelect: () => nav.create('purchases'),
                }
              : undefined
          }
          recordsLabel={t(STOCK_KEYS.purchases.records)}
          countLabel={countLabel}
          minWidth={1000}
          onRowClick={(purchase) => nav.purchaseEdit(purchase.id)}
          rowTone={(purchase) => STOCK_PURCHASE_STATUS_TONES[purchase.status]}
          rowActions={rowActions}
          exportName="clinic-stock-purchases.csv"
          avatar
        />
      )}
      <StockPurchaseDrawer
        {...(dialog.kind === 'record'
          ? { mode: 'edit' as const, purchase: dialog.record }
          : {
              mode: 'create' as const,
              prefill:
                dialog.kind === 'create'
                  ? { reorder: dialog.prefill.reorder }
                  : undefined,
            })}
        open={dialog.kind !== 'none'}
        onClose={close}
        openChild={stack.open}
      />
      <StockStackHost stack={stack} />
      {confirm}
      <Outlet />
    </section>
  );
}
