import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import {
  automaticSection,
  type RoomFilterPerson,
  type RoomFilterSection,
  roomFiltersOf,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { RefreshCw } from '@/shared/icons/index.ts';

import {
  isRevertable,
  StockRevertConfirm,
  type StockRevertTarget,
} from '../shared/components/StockRevertConfirm/index.ts';
import { StockTable } from '../shared/components/StockTable/index.ts';
import { StockToolbar } from '../shared/components/StockToolbar/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import {
  useStockItemCatalogue,
  useStockMovementList,
  useStockSummary,
} from '../shared/hooks/useStockLists/index.ts';
import { useStockNav } from '../shared/hooks/useStockNav/index.ts';
import { type StockLabel, useStockWords } from '../shared/hooks/useStockWords/index.ts';
import type { StockItemRecord, StockMovementRow } from '../shared/stock-contracts.ts';
import { sectionValue } from '../shared/stock-filters.ts';
import { STOCK_MOVEMENT_TONES } from '../shared/stock-units.ts';
import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../stock.constants.ts';
import { STOCK_MOVEMENT_KINDS, validateStockSearch } from '../stock.search.ts';
import { useStockMovementColumns } from './hooks/useStockMovementColumns/index.ts';
import { movementFilterKey, movementParamsOf } from './movements.params.ts';

const TABLE_ID = STOCK_TABLE_IDS.movements;

/** An item as the Item section lists it: its first letter in its category's tone, "#167 · Peels". */
function itemChoice(
  item: Pick<StockItemRecord, 'id' | 'seq' | 'name' | 'category'>,
  category: StockLabel,
): RoomFilterPerson {
  return {
    id: item.id,
    name: item.name,
    initials: Array.from(item.name.trim())[0]?.toLocaleUpperCase() ?? '',
    tone: category.tone ?? 'stone',
    role: `${displayId.stockItem(item.seq)} · ${category.label}`,
  };
}

/**
 * The Filters' Item section: one item's entries (`stock_item_id`) — every live
 * item from the room's catalogue, searchable by name, number or category.
 * Always offered, so an item in the URL counts and clears before the
 * catalogue arrives.
 */
function useItemSection(): RoomFilterSection {
  const { t } = useTranslation(STOCK_NS);
  const words = useStockWords();
  const items = useStockItemCatalogue().data ?? [];
  const keys = STOCK_KEYS.movements.itemFilter;
  return {
    field: { kind: 'people', single: true },
    copy: {
      label: t(STOCK_KEYS.items.columns.name),
      clearLabel: t(keys.clear),
      options: {},
      people: {
        members: items.map((item) => itemChoice(item, words.category(item.category))),
        anyone: t(keys.any),
        count: (count) => t(keys.count, { count }),
        search: t(keys.search),
        noMatch: t(keys.noMatch),
      },
    },
  };
}

/**
 * The Movements Filters (`clinic-stock.md:71`): Item · the fixed Type section
 * (every `type` the API knows, `opening` included) · Created.
 */
function useMovementFilters() {
  const { t } = useTranslation(STOCK_NS);
  const words = useStockWords();
  return roomFiltersOf({
    item: useItemSection(),
    type: automaticSection(
      t(STOCK_KEYS.filters.type),
      STOCK_MOVEMENT_KINDS.map((kind) => sectionValue(kind, words.movementType(kind))),
    ),
  });
}

/** A row's 3px edge: its type's tone, grey once reverted. */
const movementTone = (row: StockMovementRow) =>
  row.reverted ? 'stone' : STOCK_MOVEMENT_TONES[row.kind];

/**
 * Clinic stock › Movements (KICKOFF §6.8; `clinic-stock.md:57–71`) on
 * clinozy-be (`GET /app/stock-item-movements`): every stock change, newest
 * first — its type, the item and its note, when, by whom and the signed change,
 * struck through once reverted. A receipt names its purchase ("From purchase
 * #16 · bill AP-1042") and opens it. Nothing sorts, no row opens, there is no
 * search and no create; the footer counts the entries. "Revert" — a red action
 * for whoever may move stock (`stock_item:update`) — asks "Revert this
 * movement?" for a reason. A first read that fails shows the error in place,
 * with Retry.
 */
export function MovementsPage() {
  const { t } = useTranslation(STOCK_NS);
  const { t: tErrors } = useTranslation(ERRORS_NS);
  const search = validateStockSearch(useSearch({ strict: false }));
  const params = movementParamsOf(search);
  const { fields, copy } = useMovementFilters();
  const filters = useRoomFilters(fields);
  const access = useStockAccess();
  const nav = useStockNav();
  const [reverting, setReverting] = useState<StockRevertTarget | null>(null);

  const list = useStockMovementList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, movementFilterKey(params));
  const summary = useStockSummary('movements', params).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useStockMovementColumns({ onOpenPurchase: nav.purchaseEdit }),
    rows: loading ? [] : rows,
    sort: undefined,
    onSortChange: () => undefined,
  });

  const rowActions = (row: StockMovementRow): DataTableRowAction[] =>
    access.canEdit && isRevertable(row)
      ? [
          {
            id: 'revert',
            label: t(STOCK_KEYS.movements.rowActions.revert),
            icon: RefreshCw,
            destructive: true,
            onSelect: () => setReverting(row),
          },
        ]
      : [];
  const total = summary?.total ?? null;
  const failed = list.isError && rows.length === 0 && !loading;

  return (
    <section data-testid="stock-movements-page" className="flex min-h-0 flex-1 flex-col">
      <StockToolbar tab="movements" table={table} filters={{ fields, copy }} />
      {failed ? (
        <RetryError
          message={tErrors(ERRORS_KEYS.frontend.query.loadFailed)}
          onRetry={list.refetch}
        />
      ) : (
        <StockTable
          tab="movements"
          table={table}
          list={list}
          loading={loading}
          filtered={filters.count > 0}
          onClearFilters={() => filters.apply({})}
          emptyTitle={t(STOCK_KEYS.empty.stock)}
          recordsLabel={t(STOCK_KEYS.movements.records)}
          countLabel={
            total === null ? undefined : t(STOCK_KEYS.movements.count, { count: total })
          }
          minWidth={920}
          rowTone={movementTone}
          rowActions={rowActions}
          exportName="clinic-stock-movements.csv"
        />
      )}
      <StockRevertConfirm movement={reverting} onClose={() => setReverting(null)} />
    </section>
  );
}
