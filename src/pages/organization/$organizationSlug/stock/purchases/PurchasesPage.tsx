import { Outlet, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  automaticSection,
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
import { StockPurchaseDrawer } from '../shared/components/StockPurchaseDrawer/index.ts';
import { StockStackHost } from '../shared/components/StockStackHost/index.ts';
import { StockTable } from '../shared/components/StockTable/index.ts';
import { StockToolbar } from '../shared/components/StockToolbar/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import { useStockDialogRoute } from '../shared/hooks/useStockDialogRoute/index.ts';
import {
  useStockFacets,
  useStockPurchaseList,
  useStockSummary,
} from '../shared/hooks/useStockLists/index.ts';
import { useStockNav } from '../shared/hooks/useStockNav/index.ts';
import { useStockStack } from '../shared/hooks/useStockStack/index.ts';
import { useStockWords } from '../shared/hooks/useStockWords/index.ts';
import { fetchStockPurchase, stockQueryKeys } from '../shared/stock-api.ts';
import type { StockPurchaseRow } from '../shared/stock-contracts.ts';
import { STOCK_DRAWER_KEYS } from '../shared/stock-drawers.constants.ts';
import { facetValues, sectionValue } from '../shared/stock-filters.ts';
import { STOCK_PURCHASE_STATUS_TONES } from '../shared/stock-units.ts';
import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../stock.constants.ts';
import { STOCK_PURCHASE_STATUSES, validateStockSearch } from '../stock.search.ts';
import { useStockPurchaseColumns } from './hooks/useStockPurchaseColumns/index.ts';
import { purchaseFilterKey, purchaseParamsOf } from './purchases.params.ts';

const TABLE_ID = STOCK_TABLE_IDS.purchases;

/**
 * The Purchases Filters (`clinic-stock.md:55`): the automatic Status section ·
 * Created. "Follow-up date" is not built — a purchase has no follow-up
 * (KICKOFF §6.8).
 */
function usePurchaseFilters() {
  const { t } = useTranslation(STOCK_NS);
  const words = useStockWords();
  const facets = useStockFacets('purchases').data;
  const statuses = facetValues(facets, 'status');
  return roomFiltersOf({
    status: automaticSection(
      t(STOCK_KEYS.filters.status),
      STOCK_PURCHASE_STATUSES.filter((status) => statuses.includes(status)).map(
        (status) => sectionValue(status, words.status(status)),
      ),
      facets?.rows,
    ),
  });
}

/**
 * Clinic stock › Purchases (KICKOFF §6.8; `clinic-stock.md:41–55`): the Clinic
 * stock toolbar — "+ New purchase" for those who keep the stock — over the
 * bills from clinic vendors: ID, Supplier, Invoice (hidden), Date, Bill, Due
 * and Status, the row's edge in its status. A row opens Edit purchase. The
 * footer counts the purchases and what is due on them. The dialog routes
 * render nothing: this page opens the Purchase drawer for `create/` —
 * `?reorder=low` presets "Reorder low items" — and `$purchaseId/edit/`, with
 * a vendor or an item stacked on it; Delete asks for a reason. "Pay ₹X" waits
 * on the Payments pay route (L-50c, Q-M1).
 */
export function PurchasesPage() {
  const { t } = useTranslation(STOCK_NS);
  const search = validateStockSearch(useSearch({ strict: false }));
  const params = purchaseParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useStockAccess();
  const nav = useStockNav();
  const { formatPaise } = useStockWords();
  const { fields, copy } = usePurchaseFilters();
  const filters = useRoomFilters(fields);
  const stack = useStockStack();
  const [deleting, setDeleting] = useState<StockDeleteTarget | null>(null);
  const { dialog, close } = useStockDialogRoute({
    tab: 'purchases',
    param: 'purchaseId',
    queryKey: stockQueryKeys.purchase,
    fetchRecord: fetchStockPurchase,
    recordLabel: t(STOCK_DRAWER_KEYS.records.purchase),
  });

  const list = useStockPurchaseList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, purchaseFilterKey(params));
  const summary = useStockSummary('purchases', params).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useStockPurchaseColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

  const rowActions = (purchase: StockPurchaseRow): DataTableRowAction[] => {
    const actions: DataTableRowAction[] = [
      {
        id: 'edit',
        label: t(STOCK_KEYS.purchases.rowActions.edit),
        icon: PenLine,
        onSelect: () => nav.purchaseEdit(purchase.id),
      },
    ];
    if (access.canDelete) {
      actions.push({
        id: 'delete',
        label: t(STOCK_KEYS.purchases.rowActions.delete),
        icon: Trash,
        destructive: true,
        onSelect: () =>
          setDeleting({
            kind: 'purchase',
            id: purchase.id,
            name: `#${purchase.seq}`,
            seq: purchase.seq,
            record: purchase.vendor?.name,
          }),
      });
    }
    return actions;
  };

  return (
    <section data-testid="stock-purchases-page" className="flex min-h-0 flex-1 flex-col">
      <StockToolbar tab="purchases" table={table} filters={{ fields, copy }} />
      <StockTable
        tab="purchases"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(STOCK_KEYS.empty.stock)}
        emptyAction={
          access.canManage
            ? {
                label: t(STOCK_KEYS.create.purchase),
                onSelect: () => nav.create('purchases'),
              }
            : undefined
        }
        recordsLabel={t(STOCK_KEYS.purchases.records)}
        countLabel={
          summary
            ? t(STOCK_KEYS.purchases.count, {
                count: summary.total,
                due: formatPaise(summary.due),
              })
            : undefined
        }
        minWidth={1000}
        onRowClick={(purchase) => nav.purchaseEdit(purchase.id)}
        rowTone={(purchase) => STOCK_PURCHASE_STATUS_TONES[purchase.status]}
        rowActions={rowActions}
        exportName="clinic-stock-purchases.csv"
        avatar
      />
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
      <StockDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
      <Outlet />
    </section>
  );
}
