/**
 * URL search-param schema for the Clinic stock tabs (consumed by routeTree's
 * `validateSearch`; KICKOFF §6.8, `S:72–83`): each tab's search, filters and
 * sort; the dialog routes' prefills are `stock.dialog-search.ts`'s, off the
 * entry chunk. One reader serves every tab — each
 * reads only its own keys — so the entry chunk carries one parser. A value
 * the URL can't hold is dropped, never an error; defaults stay out of the URL.
 *
 * The contract's values are declared here, not imported: `routeTree.tsx` is
 * the entry chunk, and the generated schema module is pages of zod. The test
 * pins each list to the contract's enum.
 */
import {
  listIn,
  listOf,
  matchOf,
  oneOf,
  queryOf,
  RECORD_ID,
  sortOf,
} from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  readCreatedFilter,
} from '@/shared/api/clinic/clinic-list-filters.ts';

/** Items' Stock filter beyond All (`clinic-stock.md:39`). */
export const STOCK_LEVEL_FILTERS = ['low'] as const;

/** The contract's `stock_category` values — Items' automatic Category section. */
export const STOCK_CATEGORIES = [
  'creams_serums',
  'peels',
  'masks',
  'consumables',
  'equipment',
  'other',
] as const;

/** A purchase's status — Purchases' automatic Status section (`clinic-stock.md:55`). */
export const STOCK_PURCHASE_STATUSES = ['paid', 'partly', 'unpaid'] as const;

/**
 * A Movements row's type — the contract's `stock_movement_type` and the
 * derived Payment rows (`clinic-stock.md:71`).
 */
export const STOCK_MOVEMENT_KINDS = [
  'used',
  'received',
  'adjust',
  'damaged',
  'returned',
  'reverted',
  'payment',
] as const;

/** How long an item lasts as Items' automatic Lasts section reads it: `d5`, `w6`, `none`. */
const LASTS_VALUE = /^(?:[dw]\d{1,4}|none)$/;

/** Every tab's sortable columns — a tab reads the ones it has (`clinic-stock.md:31–80`). */
const SORT_KEYS = [
  'seq',
  'name',
  'category',
  'stock',
  'lasts',
  'vendor',
  'bill',
  'due',
  'payable',
] as const;

/** A sortable column of any Clinic stock tab. */
type StockSortKey = (typeof SORT_KEYS)[number];

/** A column sort in the URL: `bill:desc`, `name:asc` (the shared table's form). */
type StockSort = `${StockSortKey}:${'asc' | 'desc'}`;

/** Validated `?…` search params for the Clinic stock tabs. */
export interface StockSearch {
  /** The tab's search (≤ 80 characters, the contract's `q`). */
  q?: string;
  created?: CreatedFilter;
  sort?: StockSort;
  /** Items: Low stock (at or below the minimum). */
  stock?: (typeof STOCK_LEVEL_FILTERS)[number];
  /** Items: any of these categories (`S:73`). */
  category?: (typeof STOCK_CATEGORIES)[number][];
  /** Items: any of these runways (`d5` ~5 days, `w6` ~6 weeks, `none` No usage). */
  lasts?: string[];
  /** Purchases: any of these statuses. */
  status?: (typeof STOCK_PURCHASE_STATUSES)[number][];
  /** Purchases: one vendor's (`S:79`). */
  vendor?: string;
  /** Movements: any of these types. */
  type?: (typeof STOCK_MOVEMENT_KINDS)[number][];
  /** Movements: one item's (`S:77`). */
  item?: string;
}

/**
 * Parse a Clinic stock tab's search params. Every key is answered, `undefined`
 * included: the router keeps a raw value the schema omits, so dropping one
 * means saying so.
 */
export function validateStockSearch(search: Record<string, unknown>): StockSearch {
  return {
    q: queryOf(search.q, 80),
    created: readCreatedFilter(search.created),
    sort: sortOf(SORT_KEYS, search.sort),
    stock: oneOf(STOCK_LEVEL_FILTERS, search.stock),
    category: listIn(STOCK_CATEGORIES, search.category),
    lasts: listOf<string>(search.lasts, (entry) => LASTS_VALUE.test(entry)),
    status: listIn(STOCK_PURCHASE_STATUSES, search.status),
    vendor: matchOf(RECORD_ID, search.vendor),
    type: listIn(STOCK_MOVEMENT_KINDS, search.type),
    item: matchOf(RECORD_ID, search.item),
  };
}
