import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The Offerings room's i18n namespace (both tabs and their drawers). */
export const OFFERINGS_NS = I18N_NAMESPACES.offerings;

/**
 * The Offerings tab's copy, verbatim from `offerings.md` › Copy (KICKOFF
 * §6.11). The categories, offer kinds and states are the shared clinic
 * vocabulary (`APP_KEYS.offerings`); the toolbar's and the cells both tabs
 * share sit with their units in `shared/`.
 */
export const OFFERINGS_KEYS = {
  manifest: { title: 'manifest.title' },
  /** "Offering" — the record a stale link names: "Offering not found · it may have been deleted". */
  record: 'record',
  /** Column headers — also the meta line's labels and the Filters sections'. */
  columns: {
    seq: 'columns.seq',
    name: 'columns.name',
    category: 'columns.category',
    price: 'columns.price',
    offer: 'columns.offer',
    branches: 'columns.branches',
    duration: 'columns.duration',
    sessions: 'columns.sessions',
    status: 'columns.status',
    updated: 'columns.updated',
  },
  table: {
    /** "All offerings loaded" — the plural noun the end line names. */
    records: 'table.records',
  },
  cells: {
    /** "Valid 60 days" — the Offering cell's sub-line (plural). */
    validDays: 'cells.validDays',
    /** "valid 180 days" — the Sessions cell's sub-line (plural). */
    validFor: 'cells.validFor',
    /** "was ₹1,500 · 20% off" — the Price cell's sub-line below the list price. */
    wasPrice: 'cells.wasPrice',
    /** "list price". */
    listPrice: 'cells.listPrice',
    /** "45 min". */
    minutes: 'cells.minutes',
    /** "6 sessions" / "1 session" (plural). */
    sessions: 'cells.sessions',
    /** "6 sessions + 1 free" (plural on the free count). */
    sessionsFree: 'cells.sessionsFree',
    active: 'cells.active',
    inactive: 'cells.inactive',
  },
  rowActions: { edit: 'rowActions.edit', delete: 'rowActions.delete' },
  bulk: {
    export: 'bulk.export',
    /** "3 rows exported as CSV" (plural). */
    exported: 'bulk.exported',
  },
  empty: {
    /** No offerings at all (the prototype's unreachable copy, H:4129; Q-U5). */
    title: 'empty.title',
    description: 'empty.description',
    /** A search with no hit. */
    noMatchTitle: 'empty.noMatchTitle',
    noMatchDescription: 'empty.noMatchDescription',
  },
} as const;

/** The Offerings table's id: the test-id prefix and the device prefs' key (KICKOFF §6.11 Test ids). */
export const OFFERINGS_TABLE_ID = 'offerings';
