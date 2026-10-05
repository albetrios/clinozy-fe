'use no memo';
// TanStack Table reads live table state through its row / column methods
// (`getIsSelected()`, `getIsSorted()`, `getIsVisible()` …) on objects that keep
// their identity across state changes, so React Compiler memoisation would serve
// stale answers. The table's own `useTable` re-renders us on every change.

import type { Header, ReactTable, RowData } from '@tanstack/react-table';
import {
  type CSSProperties,
  memo,
  type ReactNode,
  type RefObject,
  type UIEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { DataTableBulkAction } from '@/shared/components/DataTableBulkBar/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useElementWidth } from '@/shared/hooks/useElementWidth/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';

import {
  DEFAULT_TABLE_TEST_PREFIX,
  TABLE_KEYS,
  TABLE_NS,
  TABLE_TEST_IDS,
} from './data-table.constants.ts';
import {
  type TableEntries,
  tableEntries,
  type TableEntry,
  type TableGroupEntry,
} from './data-table-groups.ts';
import {
  type DataTablePhoneLayout,
  planTableLayout,
  summariseRowActions,
  type TableColumn,
  type TableLayout,
  type TableRow,
  toFoldColumn,
} from './data-table-layout.ts';
import { DataTableFooter } from './DataTableFooter.tsx';
import { DataTableHeaderRow } from './DataTableHeaderRow.tsx';
import { DataTableRow, type RowContext } from './DataTableRow.tsx';
import { DataTableTail } from './DataTableTail.tsx';
import type { DataTableFeatures } from './table-features.ts';
import { useRowKeyboardNav } from './useRowKeyboardNav.ts';
import { type TableSelection, useTableSelection } from './useTableSelection.ts';
import {
  ROW_HEIGHT,
  type TableWindow,
  useTableWindow,
  VIRTUALIZE_ABOVE,
} from './useTableWindow.ts';

export type { DataTablePhoneLayout } from './data-table-layout.ts';

/** One group as its header sees it: the key, its rows as loaded, and its place. */
export interface DataTableGroup<TData extends RowData> {
  key: string;
  rows: readonly TData[];
  /** 0 for the first group. */
  index: number;
}

/**
 * Rows grouped under sticky headers (the Agenda's days, KICKOFF §6.4): each
 * run of consecutive rows sharing a key sits under one header, which sticks to
 * the top of the scroller until the next group's slides over it.
 */
export interface DataTableGroups<TData extends RowData> {
  /** The group a row belongs to; consecutive rows with one key share a header. */
  keyOf: (row: TData) => string;
  /** The group's header, spanning the row. */
  header: (group: DataTableGroup<TData>) => ReactNode;
}

/** Props of {@link DataTable}. Everything past `table` is optional. */
export interface DataTableProps<TData extends RowData> {
  table: ReactTable<DataTableFeatures, TData>;
  /** Message shown when the table has no rows. */
  emptyMessage?: string;
  /** Replaces the empty message — e.g. the room's `EmptyState`. */
  empty?: ReactNode;
  /** Stable id: scopes the test ids (`<tableId>-table…`). */
  tableId?: string;
  /** Accessible name of the table (defaults to `recordsLabel`). */
  label?: string;
  /**
   * Fold columns that do not fit the measured width into the primary cell's
   * meta line, with a "Show all" ↔ "Fit to width" toggle (H:4099–4132). Off,
   * the row keeps every column and scrolls sideways inside the card.
   */
  fold?: boolean;
  /**
   * Phone rows: `fold` — primary + key column + meta line + actions line;
   * `wrap` — the cells just wrap (Leads); `regrid` — each cell takes its
   * `meta.phoneClassName` on `phoneGridClassName`. Defaults to `fold` for a
   * folding table, else `wrap`.
   */
  phoneLayout?: DataTablePhoneLayout;
  /** `regrid`: the phone row's literal grid classes. */
  phoneGridClassName?: string;
  /**
   * Phone `fold`: the key column leads with the free width and the primary
   * cell — its meta line under it — sits at the end (max 46%). Branches: the
   * chip, then the address block carrying Contact · Opening hours · Status ·
   * Default people (`users.md:92`).
   */
  phoneKeyFirst?: boolean;
  /** Explicit minimum width (px) of a row showing every column. */
  minWidth?: number;
  /** Footer count, e.g. "12 appointments" — never "x of N". */
  countLabel?: string;
  /** Plural record noun for "All <records> loaded" / "Loading more <records>". */
  recordsLabel?: string;
  /**
   * Opens the record — a click, or Enter on the focused row. A press inside a
   * cell element marked `data-row-click="ignore"` (the cell's own control) or
   * in a cell's portaled popover does not.
   */
  onRowClick?: (row: TableRow<TData>) => void;
  /** The 3px inline-start status edge's tone. */
  getRowTone?: (row: TableRow<TData>) => Tone | undefined;
  /**
   * The row whose record is open in a drawer over the list: it keeps the
   * `muted` fill (`leads.md:35`).
   */
  isRowActive?: (row: TableRow<TData>) => boolean;
  /** The row's actions, sticky at the inline end (their own line on a phone). */
  rowActions?: (row: TableRow<TData>) => readonly DataTableRowAction[];
  /** Row selection with a bulk bar — from `md` only (D31). */
  selectable?: boolean;
  bulkActions?: readonly DataTableBulkAction<TData>[];
  /** Infinite scroll over cursor pages (D7): wire a `useInfiniteQuery`. */
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
  /** Virtualise above this many rows (default 60; Leads 40). */
  virtualizeAbove?: number;
  /** Row height before measurement (default 52px). */
  rowHeight?: number;
  /** j / k move a row focus and Enter opens it (Leads, `_patterns.md:273`). */
  keyboardNav?: boolean;
  /** Values the phone meta line drops — defaults to "All branches", "Active", "—". */
  phoneMetaSkip?: readonly string[];
  /** Group the rows under sticky headers (the Agenda's days). */
  groups?: DataTableGroups<TData>;
  /**
   * The rows on screen are the previous params' while new ones load (a search,
   * sort or filter): they stay, their text and avatars turn to flat bars and
   * clicks pause; the header and the group headers stay, and the table is
   * `aria-busy` (KICKOFF §6.0 Table refresh).
   */
  refreshing?: boolean;
  className?: string;
}

/** The props that have defaults, resolved. */
interface Options {
  fold: boolean;
  phoneLayout: DataTablePhoneLayout;
  prefix: string;
  selectable: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  virtualizeAbove: number;
  rowHeight: number;
  keyboardNav: boolean;
}

function resolveOptions<TData extends RowData>(props: DataTableProps<TData>): Options {
  const fold = props.fold ?? false;
  return {
    fold,
    phoneLayout: props.phoneLayout ?? (fold ? 'fold' : 'wrap'),
    prefix: props.tableId ?? DEFAULT_TABLE_TEST_PREFIX,
    selectable: props.selectable ?? false,
    hasNextPage: props.hasNextPage ?? false,
    isFetchingNextPage: props.isFetchingNextPage ?? false,
    virtualizeAbove: props.virtualizeAbove ?? VIRTUALIZE_ABOVE,
    rowHeight: props.rowHeight ?? ROW_HEIGHT,
    keyboardNav: props.keyboardNav ?? false,
  };
}

function pickColumns<TData extends RowData>(
  ids: readonly (string | null)[],
  byId: ReadonlyMap<string, TableColumn<TData>>,
): TableColumn<TData>[] {
  return ids.flatMap((id) => {
    const column = id === null ? undefined : byId.get(id);
    return column ? [column] : [];
  });
}

/** What every row reads from the table this render. */
function buildRowContext<TData extends RowData>(args: {
  props: DataTableProps<TData>;
  options: Options;
  isPhone: boolean;
  columns: readonly TableColumn<TData>[];
  layout: TableLayout;
  hasActions: boolean;
  selection: TableSelection<TData>;
  focusIndex: number | null;
}): RowContext<TData> {
  const { props, options, layout } = args;
  const byId = new Map(args.columns.map((column) => [column.id, column]));
  const [primaryColumn] = pickColumns([layout.plan.primaryId], byId);
  const [keyColumn] = pickColumns([layout.plan.keyId], byId);
  return {
    prefix: options.prefix,
    isPhone: args.isPhone,
    phoneLayout: options.phoneLayout,
    phoneGridClassName: props.phoneGridClassName,
    phoneMetaSkip: props.phoneMetaSkip,
    phoneKeyFirst: props.phoneKeyFirst ?? false,
    columns: args.columns,
    keptColumns: pickColumns(layout.plan.kept, byId),
    foldedColumns: pickColumns(layout.plan.folded, byId),
    primaryColumn,
    keyColumn,
    indentMeta: primaryColumn?.columnDef.meta?.kind === 'person',
    hasActions: args.hasActions,
    showPrimaryLabel: layout.showPrimaryLabel,
    rowActions: props.rowActions,
    selection: args.selection,
    onRowClick: props.onRowClick,
    getRowTone: props.getRowTone,
    isRowActive: props.isRowActive,
    keyboardNav: options.keyboardNav,
    focusIndex: args.focusIndex,
    firstRowIndex: args.isPhone ? 1 : 2,
  };
}

/** The group header row: one cell across the row, sticky at the scroller's top. */
function GroupHeaderRow<TData extends RowData>({
  entry,
  entryIndex,
  context,
  groups,
  columnCount,
  measureRow,
}: {
  entry: TableGroupEntry<TData>;
  entryIndex: number;
  context: RowContext<TData>;
  groups: DataTableGroups<TData>;
  columnCount: number;
  measureRow?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={measureRow}
      role="row"
      data-slot="data-table-group"
      data-index={entryIndex}
      aria-rowindex={entryIndex + context.firstRowIndex}
      className="sticky top-0 z-3 min-w-(--dt-min-w)"
    >
      <div role="cell" aria-colspan={Math.max(1, columnCount)}>
        {groups.header({
          key: entry.key,
          rows: entry.rows.map((row) => row.original),
          index: entry.groupIndex,
        })}
      </div>
    </div>
  );
}

/**
 * While the list virtualises, the header of the group at the top of the
 * scroller may have scrolled out of the rendered window: this copy stays
 * pinned under the column header (the inline headers slide over it), so the
 * group never loses its label. Decorative — the inline header is the one read.
 */
function PinnedGroupHeader<TData extends RowData>({
  body,
  firstVisibleIndex,
  groups,
}: {
  body: TableEntries<TData>;
  firstVisibleIndex: number | null;
  groups: DataTableGroups<TData>;
}) {
  const at =
    firstVisibleIndex === null ? -1 : (body.groupOfEntry[firstVisibleIndex] ?? -1);
  const entry = body.entries[at];
  if (entry?.kind !== 'group') return null;
  return (
    <div aria-hidden="true" className="pointer-events-none sticky top-0 z-2 h-0">
      <div className="absolute inset-x-0 top-0 min-w-(--dt-min-w)">
        {groups.header({
          key: entry.key,
          rows: entry.rows.map((row) => row.original),
          index: entry.groupIndex,
        })}
      </div>
    </div>
  );
}

/**
 * The rows' rowgroup — group headers among them — or the empty state in a
 * single full-width cell. While new rows load it carries `data-refreshing`:
 * the in-place skeleton every room shares (one `index.css` rule — clicks off,
 * every leaf text in a row a flat `muted-strong` bar, an avatar a plain disc,
 * an icon nothing, group headers kept; H:275).
 */
function TableBody<TData extends RowData>({
  tableWindow,
  context,
  groups,
  empty,
  emptyMessage,
  columnCount,
  refreshing,
}: {
  tableWindow: TableWindow<TableEntry<TData>>;
  context: RowContext<TData>;
  groups?: DataTableGroups<TData>;
  empty?: ReactNode;
  emptyMessage?: string;
  columnCount: number;
  refreshing: boolean;
}) {
  const { t } = useTranslation(TABLE_NS);
  const renderEntry = ({ item, index }: { item: TableEntry<TData>; index: number }) => {
    if (item.kind === 'row') {
      return (
        <DataTableRow
          key={item.id}
          row={item.row}
          index={item.rowIndex}
          entryIndex={index}
          context={context}
          measureRow={tableWindow.measureRow}
        />
      );
    }
    if (!groups) return null;
    return (
      <GroupHeaderRow
        key={item.id}
        entry={item}
        entryIndex={index}
        context={context}
        groups={groups}
        columnCount={columnCount}
        measureRow={tableWindow.measureRow}
      />
    );
  };
  return (
    <div
      role="rowgroup"
      data-slot="data-table-body"
      data-refreshing={refreshing || undefined}
      className="shrink-0 pt-(--dt-pad-top) pb-(--dt-pad-bottom)"
    >
      {tableWindow.windowed.length > 0 ? (
        tableWindow.windowed.map(renderEntry)
      ) : (
        <div role="row">
          <div role="cell" aria-colspan={Math.max(1, columnCount)}>
            {empty ?? (
              <p className="text-muted-foreground px-(--table-pad-x) py-12 text-center text-sm">
                {emptyMessage ?? t(TABLE_KEYS.empty)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** The scroll area: rows, the next-page sentinel and the tail. */
function TableScroller<TData extends RowData>({
  attachScroller,
  headerRef,
  sentinelRef,
  body,
  tableWindow,
  context,
  props,
  options,
  rowCount,
  columnCount,
}: {
  attachScroller: (node: HTMLDivElement | null) => () => void;
  headerRef: RefObject<HTMLDivElement | null>;
  sentinelRef: RefObject<HTMLDivElement | null>;
  body: TableEntries<TData>;
  tableWindow: TableWindow<TableEntry<TData>>;
  context: RowContext<TData>;
  props: DataTableProps<TData>;
  options: Options;
  rowCount: number;
  columnCount: number;
}) {
  // The header sits outside the scroller; it follows the body sideways (H:4466).
  const syncHeader = (event: UIEvent<HTMLDivElement>) => {
    const header = headerRef.current;
    const { scrollLeft } = event.currentTarget;
    if (header && header.scrollLeft !== scrollLeft) header.scrollLeft = scrollLeft;
  };
  return (
    <div
      ref={attachScroller}
      onScroll={syncHeader}
      // A column, so a short list's end line keeps to the card's foot — the
      // prototype grows a filler before it (measured side by side, L-39).
      className="relative flex min-h-0 flex-1 [scrollbar-gutter:stable] flex-col overflow-auto overscroll-contain max-md:overflow-x-hidden"
    >
      {props.groups && tableWindow.virtualizing ? (
        <PinnedGroupHeader
          body={body}
          firstVisibleIndex={tableWindow.firstVisibleIndex}
          groups={props.groups}
        />
      ) : null}
      <TableBody
        tableWindow={tableWindow}
        context={context}
        groups={props.groups}
        empty={props.empty}
        emptyMessage={props.emptyMessage}
        columnCount={columnCount}
        refreshing={props.refreshing === true && tableWindow.windowed.length > 0}
      />
      {options.hasNextPage ? (
        // The last 80px of the list: the next page loads as it scrolls in.
        <div
          ref={sentinelRef}
          aria-hidden="true"
          className="pointer-events-none -mt-20 h-20"
        />
      ) : null}
      <DataTableTail
        loading={options.isFetchingNextPage}
        ended={rowCount > 0 && !options.hasNextPage && props.recordsLabel !== undefined}
        recordsLabel={props.recordsLabel}
        columnCount={columnCount}
        prefix={options.prefix}
      />
    </div>
  );
}

/**
 * The shared list table (KICKOFF §3.5 Data table; `mkTable` / `dtVM`,
 * H:3729–3885, H:4093–4203): a card with a header outside the scroller, rows on
 * one grid, the fold engine that folds what does not fit into the primary
 * cell's meta line, sticky row actions, selection with a bulk bar from `md`,
 * infinite scroll with virtualisation above 60 rows and the "All <records>
 * loaded" end line. Below `md` the rows re-flow for a phone — `fold`, `wrap`
 * or `regrid` — with no header, footer or selection (D31).
 *
 * Give it a bounded height (e.g. `flex-1` in a `min-h-0` column) so the body
 * scrolls and virtualises; a table with no visible pagination passes
 * `manualPagination: true` so the row model is the whole list.
 *
 * ```tsx
 * const table = useTable({ features: dataTableFeatures, data, columns, manualPagination: true });
 * <DataTable table={table} tableId="patients" fold selectable recordsLabel="patients" />
 * ```
 */
function DataTableInner<TData extends RowData>(props: DataTableProps<TData>) {
  const { table } = props;
  const options = resolveOptions(props);
  const tier = useViewportTier();
  const isPhone = tier === 'phone';
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [measureWidth, width] = useElementWidth<HTMLDivElement>();
  const [showAll, setShowAll] = useState(false);
  const attachScroller = useCallback(
    (node: HTMLDivElement | null) => {
      scrollerRef.current = node;
      const release = measureWidth(node);
      return () => {
        release?.();
        scrollerRef.current = null;
      };
    },
    [measureWidth],
  );

  const rows = table.getRowModel().rows;
  const body = tableEntries(rows, props.groups?.keyOf);
  const columns = table.getVisibleLeafColumns();
  const selection = useTableSelection(table, rows, options.selectable && !isPhone);
  const actions = summariseRowActions(
    rows,
    props.rowActions,
    tier === 'tablet' ? 36 : 32,
  );
  const layout = planTableLayout({
    columns: columns.map(toFoldColumn),
    actions,
    width,
    isPhone,
    phoneLayout: options.phoneLayout,
    fold: options.fold,
    showAll,
    selection: selection.enabled,
    minWidth: props.minWidth,
  });
  const tableWindow = useTableWindow({
    items: body.entries,
    scrollerRef,
    sentinelRef,
    virtualizeAbove: options.virtualizeAbove,
    rowHeight: options.rowHeight,
    hasNextPage: options.hasNextPage,
    isFetchingNextPage: options.isFetchingNextPage,
    fetchNextPage: props.fetchNextPage,
  });
  const focusIndex = useRowKeyboardNav({
    enabled: options.keyboardNav,
    rows,
    onOpen: props.onRowClick,
    scrollerRef,
    scrollToIndex: (index) => tableWindow.scrollToIndex(body.entryOfRow[index] ?? index),
  });
  const context = buildRowContext({
    props,
    options,
    isPhone,
    columns,
    layout,
    hasActions: actions.track > 0,
    selection,
    focusIndex,
  });
  const columnCount =
    Number(selection.enabled) + context.keptColumns.length + Number(context.hasActions);
  const headers = new Map<string, Header<DataTableFeatures, TData, unknown>>(
    table.getLeafHeaders().map((header) => [header.column.id, header]),
  );
  const toggleShowAll = () => {
    if (scrollerRef.current) scrollerRef.current.scrollLeft = 0;
    if (headerRef.current) headerRef.current.scrollLeft = 0;
    setShowAll((current) => !current);
  };
  const gridStyle = {
    '--dt-cols': layout.template,
    '--dt-min-w': `${layout.minWidth}px`,
    '--dt-pad-top': `${tableWindow.padTop}px`,
    '--dt-pad-bottom': `${tableWindow.padBottom}px`,
  } as CSSProperties;
  const showFooter =
    !isPhone &&
    (props.countLabel !== undefined || layout.hasFoldControl || selection.enabled);

  return (
    <TooltipProvider delayDuration={160}>
      <div
        data-slot={isPhone ? 'data-table' : 'card'}
        data-testid={TABLE_TEST_IDS.table(options.prefix)}
        className={cn(
          'bg-card text-card-foreground flex min-h-0 flex-col overflow-hidden rounded-xl border max-md:rounded-none max-md:border-x-0',
          props.className,
        )}
      >
        <div
          role="table"
          aria-label={props.label ?? props.recordsLabel}
          aria-rowcount={
            options.hasNextPage ? -1 : body.entries.length + context.firstRowIndex - 1
          }
          aria-busy={props.refreshing || undefined}
          style={gridStyle}
          className="flex min-h-0 flex-1 flex-col"
        >
          {isPhone ? null : (
            <DataTableHeaderRow
              headerRef={headerRef}
              columns={context.keptColumns}
              headers={headers}
              selection={selection}
              hasActions={context.hasActions}
              prefix={options.prefix}
            />
          )}
          <TableScroller
            attachScroller={attachScroller}
            headerRef={headerRef}
            sentinelRef={sentinelRef}
            body={body}
            tableWindow={tableWindow}
            context={context}
            props={props}
            options={options}
            rowCount={rows.length}
            columnCount={columnCount}
          />
        </div>
        {showFooter ? (
          <DataTableFooter
            countLabel={props.countLabel}
            selection={selection}
            bulkActions={props.bulkActions}
            hasFoldControl={layout.hasFoldControl}
            showAll={showAll}
            foldedCount={layout.plan.folded.length}
            onToggleShowAll={toggleShowAll}
            prefix={options.prefix}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}

// memo wrapper preserving the generic type parameter.
// NOTE: Biome's linter is disabled for this file via an override in biome.json — Biome 2.5.4
// panics ("index out of bounds") while building the semantic model for `memo(<generic
// component>)`, an upstream bug (https://github.com/biomejs/biome/issues), not a code defect.
// ESLint still fully lints this file; remove the biome.json override once the upstream fix lands.
/** The shared list table — see `DataTableInner` above for the full contract. */
export const DataTable = memo(DataTableInner) as typeof DataTableInner;
