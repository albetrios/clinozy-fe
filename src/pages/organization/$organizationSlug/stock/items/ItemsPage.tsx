import { Outlet, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  automaticSection,
  type RoomFilterSection,
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
  itemDeleteBlock,
  StockDeleteConfirm,
  type StockDeleteTarget,
  useStockDeleteBlockText,
} from '../shared/components/StockDeleteConfirm/index.ts';
import { StockItemDrawer } from '../shared/components/StockItemDrawer/index.ts';
import { StockMovementDrawer } from '../shared/components/StockMovementDrawer/index.ts';
import { StockStackHost } from '../shared/components/StockStackHost/index.ts';
import { StockTable } from '../shared/components/StockTable/index.ts';
import { StockToolbar } from '../shared/components/StockToolbar/index.ts';
import { StockUsePopover } from '../shared/components/StockUsePopover/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import { useStockDialogRoute } from '../shared/hooks/useStockDialogRoute/index.ts';
import { useStockItemList } from '../shared/hooks/useStockLists/index.ts';
import { useStockNav } from '../shared/hooks/useStockNav/index.ts';
import { useStockStack } from '../shared/hooks/useStockStack/index.ts';
import { useStockWords } from '../shared/hooks/useStockWords/index.ts';
import { fetchStockItem, stockQueryKeys } from '../shared/stock-api.ts';
import type { StockItemRow } from '../shared/stock-contracts.ts';
import { STOCK_DRAWER_KEYS } from '../shared/stock-drawers.constants.ts';
import { sectionValue } from '../shared/stock-filters.ts';
import type { StockMovementInputType } from '../shared/stock-records-contracts.ts';
import { runwayTone, STOCK_LEVEL_TONES } from '../shared/stock-units.ts';
import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../stock.constants.ts';
import {
  STOCK_CATEGORIES,
  STOCK_LASTS_FILTERS,
  STOCK_LEVEL_FILTERS,
  validateStockSearch,
} from '../stock.search.ts';
import { useStockItemColumns } from './hooks/useStockItemColumns/index.ts';
import { itemFilterKey, itemParamsOf, LASTS_DAYS_TO } from './items.params.ts';

const TABLE_ID = STOCK_TABLE_IDS.items;

/**
 * The Lasts section: one runway tier at a time — "Within a week" in the
 * runway pill's blush, "Within 3 weeks" in its butter — each one upper bound
 * the API filters by (`lasts_days_to`); "All" is none.
 */
function useLastsSection(): RoomFilterSection {
  const { t } = useTranslation(STOCK_NS);
  const keys = STOCK_KEYS.filters;
  return {
    field: { kind: 'options', values: STOCK_LASTS_FILTERS, single: true },
    copy: {
      label: t(keys.lasts),
      anyLabel: t(keys.all),
      options: Object.fromEntries(
        STOCK_LASTS_FILTERS.map((tier) => [
          tier,
          {
            label: t(keys.lastsWithin[tier]),
            tone: runwayTone(LASTS_DAYS_TO[tier]) ?? undefined,
          },
        ]),
      ),
    },
  };
}

/**
 * The Items Filters (`clinic-stock.md:39`): Stock (All · Low stock) · Category
 * — the six, clinozy-be serves no facets — · Lasts (a runway tier) · Created.
 */
function useItemFilters() {
  const { t } = useTranslation(STOCK_NS);
  const words = useStockWords();
  const lasts = useLastsSection();
  const keys = STOCK_KEYS.filters;
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
      STOCK_CATEGORIES.map((category) =>
        sectionValue(category, words.category(category)),
      ),
    ),
    lasts,
  });
}

/** A movement drawer opened from a row or the Use popover: the item, the type, and whether it shows. */
interface MovingState {
  item: StockItemRow;
  type: StockMovementInputType;
  open: boolean;
}

/** The moves a row offers to whoever keeps the stock, in the design's order (`clinic-stock.md:34`). */
const ROW_MOVES = [
  { id: 'use', icon: Minus },
  { id: 'receive', icon: Plus },
  { id: 'log', icon: FileIcon },
  { id: 'adjust', icon: RefreshCw },
] as const;

/** The type a row's move opens the drawer on (Use opens the popover first). */
const MOVE_TYPES: Readonly<
  Record<(typeof ROW_MOVES)[number]['id'], StockMovementInputType>
> = {
  use: 'used',
  receive: 'received',
  log: 'used',
  adjust: 'adjust',
};

/**
 * The row actions (`clinic-stock.md:34`) and what they open: Use — the Use
 * popover at the row's button, or "D-Tan Mask is out of stock" — Receive
 * stock, Log usage… and Adjust count for whoever may change the stock
 * (`stock_item:update`); Edit (read-only without it); Delete with Stock Delete
 * — only an item with nothing in stock goes, so one with stock says why. The
 * movement drawer and the popover are component state, with no URL; they show
 * the item as the list now has it (`rows`), so a refused move — the room read
 * again — shows what is really on the shelf.
 */
function useItemActions(rows: readonly StockItemRow[]) {
  const { t } = useTranslation(STOCK_NS);
  const access = useStockAccess();
  const nav = useStockNav();
  const blockText = useStockDeleteBlockText();
  const [using, setUsing] = useState<{ item: StockItemRow; anchor: HTMLElement } | null>(
    null,
  );
  const [moving, setMoving] = useState<MovingState | null>(null);
  const [deleting, setDeleting] = useState<StockDeleteTarget | null>(null);
  const keys = STOCK_KEYS.items.rowActions;
  /** The item as the list has it now; the opened copy once it has left the list. */
  const live = (item: StockItemRow | undefined) =>
    item && (rows.find((row) => row.id === item.id) ?? item);

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
  const askDelete = (item: StockItemRow) => {
    const block = itemDeleteBlock(item);
    if (block) {
      notify.info(blockText(block));
      return;
    }
    setDeleting({ kind: 'item', id: item.id, name: item.name, from: 'row' });
  };

  const rowActions = (item: StockItemRow): DataTableRowAction[] => [
    ...(access.canEdit
      ? ROW_MOVES.map(({ id, icon }) => ({
          id,
          label: t(keys[id]),
          icon,
          onSelect: (trigger?: HTMLElement) =>
            id === 'use' ? openUse(item, trigger) : move(item, MOVE_TYPES[id]),
        }))
      : []),
    {
      id: 'edit',
      label: t(keys.edit),
      icon: PenLine,
      onSelect: () => nav.itemEdit(item.id),
    },
    ...(access.canDelete
      ? [
          {
            id: 'delete',
            label: t(keys.delete),
            icon: Trash,
            destructive: true,
            onSelect: () => askDelete(item),
          },
        ]
      : []),
  ];

  const surfaces = (
    <>
      <StockUsePopover
        item={live(using?.item) ?? null}
        anchor={using?.anchor ?? null}
        onClose={() => setUsing(null)}
        onMoreDetails={(item) => {
          setUsing(null);
          move(item, 'used');
        }}
      />
      <StockMovementDrawer
        item={live(moving?.item) ?? null}
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
 * Clinic stock › Items (KICKOFF §6.8; `clinic-stock.md:25–39`) on clinozy-be
 * (`GET /app/stock-items`): the Clinic stock toolbar — "Stock check" for whoever
 * may change the stock, "+ New item" for whoever may add it — over the items:
 * ID, Item, Category, Stock with its bar and the server's level, Lasts (the
 * server's runway), the hidden Supplier and Last rate, the row's edge in its
 * level. A row opens Edit item. The search, filters and sort live in the URL;
 * the footer has no count. The dialog routes render nothing: this page opens
 * the Item drawer for `create/` (`?name=`) and `$itemId/edit/`, Stock check
 * for `check/`, with any child stacked on them; the row actions open the Use
 * popover, the movement drawer and the delete confirm.
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
  const { rowActions, surfaces } = useItemActions(rows);
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
          access.canCreate
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
