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
import {
  FileIcon,
  Minus,
  PenLine,
  Plus,
  RefreshCw,
  Trash,
} from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { StockCheckDrawer } from '../shared/components/StockCheckDrawer/index.ts';
import {
  StockDeleteConfirm,
  type StockDeleteTarget,
} from '../shared/components/StockDeleteConfirm/index.ts';
import { StockItemDrawer } from '../shared/components/StockItemDrawer/index.ts';
import { StockMovementDrawer } from '../shared/components/StockMovementDrawer/index.ts';
import { StockStackHost } from '../shared/components/StockStackHost/index.ts';
import { StockTable } from '../shared/components/StockTable/index.ts';
import { StockToolbar } from '../shared/components/StockToolbar/index.ts';
import { StockUsePopover } from '../shared/components/StockUsePopover/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import { useStockDialogRoute } from '../shared/hooks/useStockDialogRoute/index.ts';
import { useStockFacets, useStockItemList } from '../shared/hooks/useStockLists/index.ts';
import { useStockNav } from '../shared/hooks/useStockNav/index.ts';
import { useStockStack } from '../shared/hooks/useStockStack/index.ts';
import { useStockWords } from '../shared/hooks/useStockWords/index.ts';
import { fetchStockItem, stockQueryKeys } from '../shared/stock-api.ts';
import type { StockItemRow } from '../shared/stock-contracts.ts';
import { STOCK_DRAWER_KEYS } from '../shared/stock-drawers.constants.ts';
import { facetValues, sectionValue } from '../shared/stock-filters.ts';
import type { StockMovementInputType } from '../shared/stock-records-contracts.ts';
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

/** A movement drawer opened from a row or the Use popover: the item, the type, and whether it shows. */
interface MovingState {
  item: StockItemRow;
  type: StockMovementInputType;
  open: boolean;
}

/**
 * The row actions (`clinic-stock.md:34`) and what they open: Use — the Use
 * popover at the row's button, or "D-Tan Mask is out of stock" — and Log
 * usage… for whoever uses stock; Receive stock and Adjust count for those who
 * keep it; Edit; Delete with Stock Delete. The movement drawer and the popover
 * are component state, with no URL.
 */
function useItemActions() {
  const { t } = useTranslation(STOCK_NS);
  const access = useStockAccess();
  const nav = useStockNav();
  const [using, setUsing] = useState<{ item: StockItemRow; anchor: HTMLElement } | null>(
    null,
  );
  const [moving, setMoving] = useState<MovingState | null>(null);
  const [deleting, setDeleting] = useState<StockDeleteTarget | null>(null);
  const keys = STOCK_KEYS.items.rowActions;

  const move = (item: StockItemRow, type: StockMovementInputType) =>
    setMoving({ item, type, open: true });
  const openUse = (item: StockItemRow, trigger?: HTMLElement) => {
    if (item.level === 'out') {
      notify.info(t(STOCK_DRAWER_KEYS.use.outOfStock, { name: item.name }));
      return;
    }
    // The popover anchors to the row's Use button; from the row menu, a Log usage drawer.
    if (trigger) setUsing({ item, anchor: trigger });
    else move(item, 'used');
  };

  const rowActions = (item: StockItemRow): DataTableRowAction[] => {
    const actions: DataTableRowAction[] = [];
    if (access.canUse) {
      actions.push({
        id: 'use',
        label: t(keys.use),
        icon: Minus,
        onSelect: (trigger) => openUse(item, trigger),
      });
    }
    if (access.canManage) {
      actions.push({
        id: 'receive',
        label: t(keys.receive),
        icon: Plus,
        onSelect: () => move(item, 'received'),
      });
    }
    if (access.canUse) {
      actions.push({
        id: 'log',
        label: t(keys.log),
        icon: FileIcon,
        onSelect: () => move(item, 'used'),
      });
    }
    if (access.canManage) {
      actions.push({
        id: 'adjust',
        label: t(keys.adjust),
        icon: RefreshCw,
        onSelect: () => move(item, 'adjust'),
      });
    }
    actions.push({
      id: 'edit',
      label: t(keys.edit),
      icon: PenLine,
      onSelect: () => nav.itemEdit(item.id),
    });
    if (access.canDelete) {
      actions.push({
        id: 'delete',
        label: t(keys.delete),
        icon: Trash,
        destructive: true,
        onSelect: () =>
          setDeleting({ kind: 'item', id: item.id, name: item.name, from: 'row' }),
      });
    }
    return actions;
  };

  const surfaces = (
    <>
      <StockUsePopover
        item={using?.item ?? null}
        anchor={using?.anchor ?? null}
        onClose={() => setUsing(null)}
        onMoreDetails={(item) => {
          setUsing(null);
          move(item, 'used');
        }}
      />
      <StockMovementDrawer
        item={moving?.item ?? null}
        type={moving?.type ?? 'used'}
        open={moving?.open ?? false}
        // Closed, the drawer keeps its item while it slides out.
        onClose={() => setMoving((current) => current && { ...current, open: false })}
      />
      <StockDeleteConfirm target={deleting} onClose={() => setDeleting(null)} />
    </>
  );
  return { rowActions, surfaces };
}

/**
 * Clinic stock › Items (KICKOFF §6.8; `clinic-stock.md:25–39`): the Clinic stock
 * toolbar — "Stock check" and "+ New item" for those who keep the stock — over
 * the items: ID, Item, Category, Stock with its bar, Lasts and the hidden
 * Supplier, the row's edge in its stock level. A row opens Edit item. The
 * search, filters and sort live in the URL; the footer has no count. The
 * dialog routes render nothing: this page opens the Item drawer for `create/`
 * (`?name=`) and `$itemId/edit/`, Stock check for `check/`, with any child
 * stacked on them; the row actions open the Use popover, the movement drawer
 * and the delete confirm.
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
  const stack = useStockStack();
  const { rowActions, surfaces } = useItemActions();
  const { dialog, close } = useStockDialogRoute({
    tab: 'items',
    param: 'itemId',
    queryKey: stockQueryKeys.item,
    fetchRecord: fetchStockItem,
    recordLabel: t(STOCK_DRAWER_KEYS.records.item),
    tabActions: ['check'],
  });

  const list = useStockItemList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, itemFilterKey(params));
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useStockItemColumns(),
    rows: loading ? [] : rows,
    sort: search.sort,
    onSortChange: (sort) => patchSearch({ sort }),
  });

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
      <StockItemDrawer
        {...(dialog.kind === 'record'
          ? { mode: 'edit' as const, item: dialog.record }
          : {
              mode: 'create' as const,
              prefill:
                dialog.kind === 'create' ? { name: dialog.prefill.name } : undefined,
            })}
        open={dialog.kind === 'create' || dialog.kind === 'record'}
        onClose={close}
        openChild={stack.open}
      />
      <StockCheckDrawer open={dialog.kind === 'action'} onClose={close} />
      <StockStackHost stack={stack} />
      {surfaces}
      <Outlet />
    </section>
  );
}
