import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table';

/** What one cell gives the meta line or the phone key column: its text and an optional dot. */
export interface DataTableFoldValue {
  value: string;
  /** Literal background class for the 6px dot, e.g. `bg-tone-sage-dot`. */
  dotClassName?: string;
  /** A default state the phone meta line drops ("Active", "All branches"). */
  quiet?: boolean;
}

/** How a column renders and folds — the same vocabulary as the fold engine. */
export type DataTableCellKind = 'text' | 'id' | 'person' | 'badges';

/**
 * Per-column layout facts every shared table reads from `columnDef.meta`
 * (KICKOFF §3.5 Data table; H:4093–4203). All optional: a column without meta
 * gets a `minmax(90px,1fr)` track, its string header as label, and the
 * accessor value as its folded text.
 */
export interface DataTableColumnMeta {
  /** Header label, meta-line label, column-chooser name and "Sort by <label>". */
  label?: string;
  /** CSS grid track, e.g. `minmax(200px,1.4fr)` or `96px`. */
  track?: string;
  kind?: DataTableCellKind;
  /** End-aligned (amount) column: the header and cell align to the inline end. */
  align?: 'start' | 'end';
  /** Explicit fold priority, 1 the most important (ranks `10 − priority`). */
  priority?: number;
  /** The column that takes the free width and carries the meta line. */
  primary?: boolean;
  /** Never folds into the meta line. */
  locked?: boolean;
  /** Hidden by default — the column chooser's recommended set hides it. */
  defaultHidden?: boolean;
  /**
   * The cell's text for the meta line and the phone key. Defaults to the
   * accessor value (a string, number or list of strings); return `null` for a
   * cell that folds to nothing.
   */
  foldValue?(original: unknown): DataTableFoldValue | string | null | undefined;
  /** `regrid` phone layout: this cell's literal grid placement classes. */
  phoneClassName?: string;
  /** `regrid` phone layout: leave this cell out on a phone. */
  phoneHidden?: boolean;
}

/**
 * The single feature set every table in the app is built from.
 *
 * TanStack Table v9 makes features opt-in for tree-shaking: a table only has
 * `getCanSort()`, `toggleVisibility()` etc. if the matching feature was passed
 * in. Declaring one shared set — rather than a per-table set — is what lets the
 * shared `DataTable*` components stay generic over `TData` alone. Generic over
 * an open `TFeatures` they could not call any feature method, because the
 * compiler cannot know the feature is present.
 *
 * Add a feature here when a table needs it; the row model that powers it goes
 * in the same object (v9 moved row models out of the table options).
 *
 * `filterFns` registers one comparator rather than the whole built-in registry:
 * registering the registry object is deprecated precisely because it opts the
 * bundle out of tree-shaking, pulling in every built-in comparator. Only
 * `includesString` is listed because only it is load-bearing — a toolbar search
 * column (`DataTableToolbar`'s `searchColumnId`) resolves to it, and dropping it
 * silently stops filtering (covered by the kit filter test in
 * `DataTable.test.tsx`). No `sortFns` slot is registered:
 * sorting resolves to a built-in default, verified by removing the slot and
 * confirming the sorting tests still pass. Register a comparator here the
 * moment a column names one.
 *
 * `columnMeta` is a type-only slot: it types `columnDef.meta` as
 * {@link DataTableColumnMeta} for every table and is stripped at runtime.
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

/** Feature set backing every shared `DataTable*` component. */
export type DataTableFeatures = typeof dataTableFeatures;
