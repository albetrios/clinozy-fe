import { Outlet, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { useDataTableUrlState } from '@/shared/hooks/useDataTableUrlState/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { PenLine } from '@/shared/icons/index.ts';

import { StockTable } from '../shared/components/StockTable/index.ts';
import { StockToolbar } from '../shared/components/StockToolbar/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import {
  useStockSummary,
  useStockVendorList,
} from '../shared/hooks/useStockLists/index.ts';
import { useStockNav } from '../shared/hooks/useStockNav/index.ts';
import { useStockWords } from '../shared/hooks/useStockWords/index.ts';
import type { StockVendorRow } from '../shared/stock-contracts.ts';
import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../stock.constants.ts';
import { validateStockSearch } from '../stock.search.ts';
import { useStockVendorColumns } from './hooks/useStockVendorColumns/index.ts';
import { vendorFilterKey, vendorParamsOf } from './vendors.params.ts';

const TABLE_ID = STOCK_TABLE_IDS.vendors;

/**
 * Clinic stock › Vendors (Q-K1; KICKOFF §6.8; `S:81–83`), modelled on Medical ›
 * Suppliers: the Clinic stock toolbar — search only, "+ New clinic vendor" for
 * those who keep the stock — over the vendors, their purchases and what they
 * are owed. A row opens Edit clinic vendor; the footer counts the vendors and
 * their payable (AMBER: the copy is not in the source). The dialog routes
 * (`create/`, `$vendorId/edit/`) render nothing: the drawer mounts here
 * (L-51b); "Pay ₹X" waits on the Payments pay route (L-50c, Q-M1).
 */
export function VendorsPage() {
  const { t } = useTranslation(STOCK_NS);
  const search = validateStockSearch(useSearch({ strict: false }));
  const params = vendorParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useStockAccess();
  const nav = useStockNav();
  const { formatPaise } = useStockWords();

  const list = useStockVendorList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, vendorFilterKey(params));
  const summary = useStockSummary('vendors', params).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useStockVendorColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

  const rowActions = (vendor: StockVendorRow): DataTableRowAction[] => [
    {
      id: 'edit',
      label: t(STOCK_KEYS.vendors.rowActions.edit),
      icon: PenLine,
      onSelect: () => nav.vendorEdit(vendor.id),
    },
  ];

  return (
    <section data-testid="stock-vendors-page" className="flex min-h-0 flex-1 flex-col">
      <StockToolbar tab="vendors" table={table} />
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
          access.canManage
            ? {
                label: t(STOCK_KEYS.create.vendor),
                onSelect: () => nav.create('vendors'),
              }
            : undefined
        }
        recordsLabel={t(STOCK_KEYS.vendors.records)}
        countLabel={
          summary
            ? t(STOCK_KEYS.vendors.count, {
                count: summary.total,
                payable: formatPaise(summary.due),
              })
            : undefined
        }
        minWidth={640}
        onRowClick={(vendor) => nav.vendorEdit(vendor.id)}
        rowActions={rowActions}
        exportName="clinic-stock-vendors.csv"
        avatar
      />
      <Outlet />
    </section>
  );
}
