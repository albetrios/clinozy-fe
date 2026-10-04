import { Outlet, useSearch } from '@tanstack/react-router';
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
import { PenLine } from '@/shared/icons/index.ts';

import { StockTable } from '../shared/components/StockTable/index.ts';
import { StockToolbar } from '../shared/components/StockToolbar/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import { useStockFacets, useStockItemList } from '../shared/hooks/useStockLists/index.ts';
import { useStockNav } from '../shared/hooks/useStockNav/index.ts';
import { useStockWords } from '../shared/hooks/useStockWords/index.ts';
import type { StockItemRow } from '../shared/stock-contracts.ts';
import { facetValues, sectionValue } from '../shared/stock-filters.ts';
import { runwayFromKey, STOCK_LEVEL_TONES } from '../shared/stock-units.ts';
import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../stock.constants.ts';
import {
  STOCK_CATEGORIES,
  STOCK_LEVEL_FILTERS,
  validateStockSearch,
} from '../stock.search.ts';
import { useStockItemColumns } from './hooks/useStockItemColumns/index.ts';
import { itemFilterKey, itemParamsOf } from './items.params.ts';

const TABLE_ID = STOCK_TABLE_IDS.items;

/**
 * The Items Filters (`clinic-stock.md:39`): Stock (All · Low stock) · the
 * automatic Category and Lasts sections — the values the whole list holds,
 * 2 to 10 of them and fewer than its rows — · Created.
 */
function useItemFilters() {
  const { t } = useTranslation(STOCK_NS);
  const words = useStockWords();
  const facets = useStockFacets('items').data;
  const keys = STOCK_KEYS.filters;
  const categories = facetValues(facets, 'category');
  const runways = facetValues(facets, 'lasts').flatMap((key) => {
    const runway = runwayFromKey(key);
    return runway ? [sectionValue(key, words.runwayChip(runway))] : [];
  });
  return roomFiltersOf({
    stock: {
      field: { kind: 'options', values: STOCK_LEVEL_FILTERS, single: true },
      copy: {
        label: t(keys.stock),
        anyLabel: t(keys.all),
        options: { low: { label: t(keys.lowStock), tone: 'butter' } },
      },
    },
    category: automaticSection(
      t(keys.category),
      STOCK_CATEGORIES.filter((category) => categories.includes(category)).map(
        (category) => sectionValue(category, words.category(category)),
      ),
      facets?.rows,
    ),
    lasts: automaticSection(t(keys.lasts), runways, facets?.rows),
  });
}

/**
 * Clinic stock › Items (KICKOFF §6.8; `clinic-stock.md:25–39`): the Clinic stock
 * toolbar — "Stock check" and "+ New item" for those who keep the stock — over
 * the items: ID, Item, Category, Stock with its bar, Lasts and the hidden
 * Supplier, the row's edge in its stock level. A row opens Edit item. The
 * search, filters and sort live in the URL; the footer has no count. The
 * dialog routes (`create/`, `$itemId/edit/`, `check/`) render nothing: the
 * drawers mount here (L-51b).
 */
export function ItemsPage() {
  const { t } = useTranslation(STOCK_NS);
  const search = validateStockSearch(useSearch({ strict: false }));
  const params = itemParamsOf(search);
  const { patchSearch } = useDataTableUrlState(true);
  const access = useStockAccess();
  const nav = useStockNav();
  const { fields, copy } = useItemFilters();
  const filters = useRoomFilters(fields);

  const list = useStockItemList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, itemFilterKey(params));
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useStockItemColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

  const rowActions = (item: StockItemRow): DataTableRowAction[] => [
    {
      id: 'edit',
      label: t(STOCK_KEYS.items.rowActions.edit),
      icon: PenLine,
      onSelect: () => nav.itemEdit(item.id),
    },
  ];

  return (
    <section data-testid="stock-items-page" className="flex min-h-0 flex-1 flex-col">
      <StockToolbar tab="items" table={table} filters={{ fields, copy }} />
      <StockTable
        tab="items"
        table={table}
        list={list}
        loading={loading}
        filtered={filters.count > 0}
        onClearFilters={() => filters.apply({})}
        emptyTitle={t(STOCK_KEYS.items.empty)}
        emptyAction={
          access.canManage
            ? { label: t(STOCK_KEYS.create.item), onSelect: () => nav.create('items') }
            : undefined
        }
        recordsLabel={t(STOCK_KEYS.items.records)}
        minWidth={1100}
        onRowClick={(item) => nav.itemEdit(item.id)}
        rowTone={(item) => STOCK_LEVEL_TONES[item.level]}
        rowActions={rowActions}
        exportName="clinic-stock-items.csv"
      />
      <Outlet />
    </section>
  );
}
