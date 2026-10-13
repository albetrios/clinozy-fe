import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** Table chrome copy lives in `common` — every room's list shares it. */
export const TABLE_NS = I18N_NAMESPACES.common;

/** Generic table chrome copy — shared by every DataTable surface. */
export const TABLE_KEYS = {
  searchPlaceholder: 'table.searchPlaceholder',
  empty: 'table.empty',
  sortBy: 'table.sortBy',
  actions: 'table.actions',
  moreActions: 'table.moreActions',
  columns: {
    trigger: 'table.columns.trigger',
    title: 'table.columns.title',
    showAll: 'table.columns.showAll',
    recommendedHides: 'table.columns.recommendedHides',
    tapForRecommended: 'table.columns.tapForRecommended',
    allShown: 'table.columns.allShown',
    hiddenCount: 'table.columns.hiddenCount',
    search: 'table.columns.search',
    shown: 'table.columns.shown',
    viewGroup: 'table.columns.viewGroup',
    columnsGroup: 'table.columns.columnsGroup',
  },
  fold: {
    showAll: 'table.fold.showAll',
    showAllHint: 'table.fold.showAllHint',
    fitToWidth: 'table.fold.fitToWidth',
    fitToWidthHint: 'table.fold.fitToWidthHint',
  },
  selection: {
    selectRow: 'table.selection.selectRow',
    selected: 'table.selection.selected',
    selectAllCount: 'table.selection.selectAllCount',
    clear: 'table.selection.clear',
    clearHint: 'table.selection.clearHint',
    escape: 'table.selection.escape',
    bulkActions: 'table.selection.bulkActions',
  },
  length: {
    allLoaded: 'table.length.allLoaded',
    loadingMore: 'table.length.loadingMore',
  },
  savedViews: {
    label: 'table.savedViews.label',
    apply: 'table.savedViews.apply',
    remove: 'table.savedViews.remove',
    removed: 'table.savedViews.removed',
    defaultName: 'table.savedViews.defaultName',
  },
} as const;

/** The Columns picker's "Show all columns" row — a key no column id takes. */
export const COLUMNS_SHOW_ALL_KEY = 'show-all';

/** `data-testid`s of the shared table chrome, prefixed per table. */
export const TABLE_TEST_IDS = {
  table: (prefix: string) => `${prefix}-table`,
  header: (prefix: string) => `${prefix}-table-header`,
  row: (prefix: string) => `${prefix}-table-row`,
  selectAll: (prefix: string) => `${prefix}-table-select-all`,
  selectRow: (prefix: string) => `${prefix}-table-select-row`,
  footer: (prefix: string) => `${prefix}-table-footer`,
  foldToggle: (prefix: string) => `${prefix}-table-fold-toggle`,
  bulkBar: (prefix: string) => `${prefix}-table-bulk-bar`,
  bulkSelectAll: (prefix: string) => `${prefix}-table-bulk-select-all`,
  bulkClear: (prefix: string) => `${prefix}-table-bulk-clear`,
  loadingMore: (prefix: string) => `${prefix}-table-loading-more`,
  end: (prefix: string) => `${prefix}-table-end`,
  columnsTrigger: (prefix: string) => `${prefix}-columns-trigger`,
  /** The Columns picker's base id: its panel, search and `-option-<columnId>` rows. */
  columns: (prefix: string) => `${prefix}-columns`,
  columnsShowAll: (prefix: string) => `${prefix}-columns-option-${COLUMNS_SHOW_ALL_KEY}`,
  savedViews: (prefix: string) => `${prefix}-saved-views`,
} as const;

/** Test-id prefix of a table without a `tableId`. */
export const DEFAULT_TABLE_TEST_PREFIX = 'data';
