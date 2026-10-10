import { Outlet, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { PenLine, Trash } from '@/shared/icons/index.ts';

import {
  StockDeleteConfirm,
  type StockDeleteTarget,
  vendorDeleteBlock,
} from '../shared/components/StockDeleteConfirm/index.ts';
import { StockTable } from '../shared/components/StockTable/index.ts';
import { StockToolbar } from '../shared/components/StockToolbar/index.ts';
import {
  StockVendorDrawer,
  useRefreshStockVendors,
} from '../shared/components/StockVendorDrawer/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import { useStockDialogRoute } from '../shared/hooks/useStockDialogRoute/index.ts';
import {
  useStockSummary,
  useStockVendorList,
} from '../shared/hooks/useStockLists/index.ts';
import { useStockNav } from '../shared/hooks/useStockNav/index.ts';
import { useStockWords } from '../shared/hooks/useStockWords/index.ts';
import { fetchStockVendor, stockQueryKeys } from '../shared/stock-api.ts';
import type { StockVendorListParams, StockVendorRow } from '../shared/stock-contracts.ts';
import { STOCK_DRAWER_KEYS } from '../shared/stock-drawers.constants.ts';
import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../stock.constants.ts';
import { validateStockSearch } from '../stock.search.ts';
import { useStockVendorColumns } from './hooks/useStockVendorColumns/index.ts';
import { vendorFilterKey, vendorParamsOf } from './vendors.params.ts';

const TABLE_ID = STOCK_TABLE_IDS.vendors;

/**
 * The footer: "5 vendors · ₹2,310 payable" — how many vendors the search
 * matches and what is owed to them (`meta.payable_total`), one read of a single
 * row, keyed by the search alone: a sort changes neither figure. Nothing while
 * either figure is unknown.
 */
function useVendorCount({ q }: StockVendorListParams): string | undefined {
  const { t, formatRupees } = useStockWords();
  const summary = useStockSummary('vendors', { q }).data;
  if (summary?.total == null || summary.due == null) {
    return undefined;
  }
  return t(STOCK_KEYS.vendors.count, {
    count: summary.total,
    payable: formatRupees(summary.due),
  });
}

/**
 * A row's actions: Edit (read-only without Edit), and Delete with Stock Delete
 * while nothing is owed (`vendor_has_dues`). A confirm that closes without
 * deleting reads the vendors again — a refusal means a purchase owes them since.
 */
function useVendorActions() {
  const { t } = useTranslation(STOCK_NS);
  const access = useStockAccess();
  const nav = useStockNav();
  const refresh = useRefreshStockVendors();
  const [deleting, setDeleting] = useState<StockDeleteTarget | null>(null);
  const keys = STOCK_KEYS.vendors.rowActions;

  const rowActions = (vendor: StockVendorRow): DataTableRowAction[] => [
    {
      id: 'edit',
      label: t(keys.edit),
      icon: PenLine,
      onSelect: () => nav.vendorEdit(vendor.id),
    },
    ...(access.canDelete && vendorDeleteBlock(vendor) === null
      ? [
          {
            id: 'delete',
            label: t(keys.delete),
            icon: Trash,
            destructive: true,
            onSelect: () =>
              setDeleting({
                kind: 'vendor',
                id: vendor.id,
                name: vendor.name,
                from: 'row',
              }),
          },
        ]
      : []),
  ];

  const confirm = (
    <StockDeleteConfirm
      target={deleting}
      onClose={() => {
        setDeleting(null);
        refresh();
      }}
    />
  );
  return { rowActions, confirm };
}

/**
 * Clinic stock › Vendors (Q-K1; KICKOFF §6.8; `S:81–83`) on clinozy-be (`GET
 * /app/stock-vendors`), modelled on Medical › Suppliers: the Clinic stock
 * toolbar — search by name, "+ New clinic vendor" for those who may add stock —
 * over the vendors, how many purchases they have and what they are owed, the
 * server's figures; sort by Vendor or Payable. A row opens Edit clinic vendor;
 * the footer counts the vendors the search matches and what is owed to them.
 * "Pay ₹X" waits for Payments (Q-S3): the Payments room still reads fixtures
 * and cannot pay a live purchase. The dialog routes render nothing: this page
 * opens the vendor drawer for `create/` (`?name=`) and `$vendorId/edit/`;
 * Delete — only while nothing is owed — asks for a reason. A first read that
 * fails shows in place with Retry.
 */
export function VendorsPage() {
  const { t } = useTranslation(STOCK_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const search = validateStockSearch(useSearch({ strict: false }));
  const params = vendorParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useStockAccess();
  const nav = useStockNav();
  const { rowActions, confirm } = useVendorActions();
  const { dialog, close } = useStockDialogRoute({
    tab: 'vendors',
    param: 'vendorId',
    queryKey: stockQueryKeys.vendor,
    fetchRecord: fetchStockVendor,
    recordLabel: t(STOCK_DRAWER_KEYS.records.vendor),
  });

  const list = useStockVendorList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, vendorFilterKey(params));
  const countLabel = useVendorCount(params);
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useStockVendorColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });
  const failed = list.isError && rows.length === 0 && !loading;

  return (
    <section data-testid="stock-vendors-page" className="flex min-h-0 flex-1 flex-col">
      <StockToolbar tab="vendors" table={table} />
      {failed ? (
        <RetryError
          message={tErrors(ERRORS_KEYS.frontend.query.loadFailed)}
          onRetry={list.refetch}
        />
      ) : (
        <StockTable
          tab="vendors"
          table={table}
          list={list}
          loading={loading}
          // Vendors has no Filters (`S:81`): a search with no match is the plain empty state.
          filtered={false}
          onClearFilters={() => undefined}
          emptyTitle={t(STOCK_KEYS.vendors.empty)}
          emptyAction={
            access.canCreate
              ? {
                  label: t(STOCK_KEYS.create.vendor),
                  onSelect: () => nav.create('vendors'),
                }
              : undefined
          }
          recordsLabel={t(STOCK_KEYS.vendors.records)}
          countLabel={countLabel}
          minWidth={640}
          onRowClick={(vendor) => nav.vendorEdit(vendor.id)}
          rowActions={rowActions}
          exportName="clinic-stock-vendors.csv"
          avatar
        />
      )}
      <StockVendorDrawer
        {...(dialog.kind === 'record'
          ? { mode: 'edit' as const, vendor: dialog.record }
          : {
              mode: 'create' as const,
              prefill:
                dialog.kind === 'create' ? { name: dialog.prefill.name } : undefined,
            })}
        open={dialog.kind !== 'none'}
        onClose={close}
      />
      {confirm}
      <Outlet />
    </section>
  );
}
