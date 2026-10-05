import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import {
  automaticSection,
  roomFiltersOf,
  useRoomFilters,
} from '@/shared/components/RoomToolbar/index.ts';
import { useRoomList } from '@/shared/hooks/useRoomList/index.ts';
import { useRoomTable } from '@/shared/hooks/useRoomTable/index.ts';
import { RefreshCw } from '@/shared/icons/index.ts';

import { StockRevertConfirm } from '../shared/components/StockRevertConfirm/index.ts';
import { StockTable } from '../shared/components/StockTable/index.ts';
import { StockToolbar } from '../shared/components/StockToolbar/index.ts';
import { useStockAccess } from '../shared/hooks/useStockAccess/index.ts';
import {
  useStockFacets,
  useStockMovementList,
  useStockSummary,
} from '../shared/hooks/useStockLists/index.ts';
import { useStockWords } from '../shared/hooks/useStockWords/index.ts';
import type { StockChangeRow, StockMovementRow } from '../shared/stock-contracts.ts';
import { facetValues, sectionValue } from '../shared/stock-filters.ts';
import { STOCK_MOVEMENT_TONES } from '../shared/stock-units.ts';
import { STOCK_KEYS, STOCK_NS, STOCK_TABLE_IDS } from '../stock.constants.ts';
import { STOCK_MOVEMENT_KINDS, validateStockSearch } from '../stock.search.ts';
import { useStockMovementColumns } from './hooks/useStockMovementColumns/index.ts';
import { movementFilterKey, movementParamsOf } from './movements.params.ts';

const TABLE_ID = STOCK_TABLE_IDS.movements;

/** The Movements Filters (`clinic-stock.md:71`): the automatic Type section · Created. */
function useMovementFilters() {
  const { t } = useTranslation(STOCK_NS);
  const words = useStockWords();
  const facets = useStockFacets('movements').data;
  const types = facetValues(facets, 'type');
  return roomFiltersOf({
    type: automaticSection(
      t(STOCK_KEYS.filters.type),
      STOCK_MOVEMENT_KINDS.filter((kind) => types.includes(kind)).map((kind) =>
        sectionValue(kind, words.movementType(kind)),
      ),
      facets?.rows,
    ),
  });
}

/** "Revert" is offered on a stock change neither reverted nor itself a revert (`clinic-stock.md:65`). */
const canRevert = (row: StockMovementRow): row is StockChangeRow =>
  row.kind !== 'payment' && row.kind !== 'reverted' && !row.reverted;

/** A row's 3px edge: its type's tone, grey once reverted. */
const movementTone = (row: StockMovementRow) =>
  row.kind !== 'payment' && row.reverted ? 'stone' : STOCK_MOVEMENT_TONES[row.kind];

/**
 * Clinic stock › Movements (KICKOFF §6.8; `clinic-stock.md:57–71`): every stock
 * change, newest first — its type, the item and its note, when, by whom and
 * the signed change, struck through once reverted — with one Payment row per
 * purchase with money paid. Nothing sorts and no row opens; the footer counts
 * the entries. Movements has no create. "Revert" — a red action, with Stock
 * Delete — asks "Revert this movement?" for a reason.
 */
export function MovementsPage() {
  const { t } = useTranslation(STOCK_NS);
  const search = validateStockSearch(useSearch({ strict: false }));
  const params = movementParamsOf(search);
  const { fields, copy } = useMovementFilters();
  const filters = useRoomFilters(fields);
  const access = useStockAccess();
  const [reverting, setReverting] = useState<StockChangeRow | null>(null);

  const list = useStockMovementList(params);
  const { rows, loading } = useRoomList(list, TABLE_ID, movementFilterKey(params));
  const summary = useStockSummary('movements', params).data;
  const table = useRoomTable({
    tableId: TABLE_ID,
    columns: useStockMovementColumns(),
    rows: loading ? [] : rows,
    sort: undefined,
    onSortChange: () => undefined,
  });

  const rowActions = (row: StockMovementRow): DataTableRowAction[] =>
    access.canDelete && canRevert(row)
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

  return (
    <section data-testid="stock-movements-page" className="flex min-h-0 flex-1 flex-col">
      <StockToolbar tab="movements" table={table} filters={{ fields, copy }} />
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
          summary ? t(STOCK_KEYS.movements.count, { count: summary.total }) : undefined
        }
        minWidth={920}
        rowTone={movementTone}
        rowActions={rowActions}
        exportName="clinic-stock-movements.csv"
      />
      <StockRevertConfirm movement={reverting} onClose={() => setReverting(null)} />
    </section>
  );
}
