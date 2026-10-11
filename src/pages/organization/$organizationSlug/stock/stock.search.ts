/**
 * URL search-param schema for the Clinic stock tabs (consumed by routeTree's
 * `validateSearch`; KICKOFF §6.8, `S:72–83`): each tab's search, filters and
 * sort; the dialog routes' prefills are `stock.dialog-search.ts`'s, off the
 * entry chunk. One reader serves every tab — each
 * reads only its own keys — so the entry chunk carries one parser. A value
 * the URL can't hold is dropped, never an error; defaults stay out of the URL.
 *
 * The API's values are declared here, not imported: `routeTree.tsx` is the
 * entry chunk, and the generated schema module is pages of zod — the room's
 * other modules read them from here. The test pins each list to clinozy-be's
 * enum, and the ids are its public ids (`svnd_…`, `sitm_…`).
 */
import {
  listIn,
  matchOf,
  oneOf,
  PUBLIC_ID,
  queryOf,
  sortOf,
} from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  readCreatedFilter,
} from '@/shared/api/app/app-list-filters.ts';

/** Items' Stock filter beyond All (`clinic-stock.md:39`). */
export const STOCK_LEVEL_FILTERS = ['low'] as const;

/**
 * Items' Lasts filter: what runs out within a week or within three weeks — the
 * Lasts pill's blush and butter bands, each one upper bound (`lasts_days_to`).
 */
export const STOCK_LASTS_FILTERS = ['week', 'three_weeks'] as const;

/** The contract's `stock_category` values — Items' automatic Category section. */
export const STOCK_CATEGORIES = [
  'creams_serums',
  'peels',
  'masks',
  'consumables',
  'equipment',
  'other',
] as const;

/** A purchase's `payment_status` — Purchases' Status section (`clinic-stock.md:55`). */
export const STOCK_PURCHASE_STATUSES = ['paid', 'partial', 'unpaid'] as const;

/**
 * A movement's `type` — Movements' Type section, in the order it lists them:
 * the five a member logs, an item's opening quantity and a revert.
 */
export const STOCK_MOVEMENT_KINDS = [
  'used',
  'received',
  'adjust',
  'damaged',
  'returned',
  'opening',
  'reverted',
] as const;

/**
 * Every tab's sortable columns the API sorts by — a tab reads the ones it has
 * (`clinic-stock.md:31–80`). Purchases by supplier is not among the API's sorts.
 */
const SORT_KEYS = [
  'seq',
  'name',
  'category',
  'stock',
  'lasts',
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
  /** The tab's search (≤ 80 characters, the API's `q`) — Items, Purchases and Vendors; Movements has none. */
  q?: string;
  created?: CreatedFilter;
  sort?: StockSort;
  /** Items: Low stock (at or below the minimum). */
  stock?: (typeof STOCK_LEVEL_FILTERS)[number];
  /** Items: any of these categories (`S:73`). */
  category?: (typeof STOCK_CATEGORIES)[number][];
  /** Items: what runs out within a week or three weeks. */
  lasts?: (typeof STOCK_LASTS_FILTERS)[number];
  /** Purchases: any of these statuses. */
  status?: (typeof STOCK_PURCHASE_STATUSES)[number][];
  /** Purchases: one vendor's (`S:79`) — a public id. */
  vendor?: string;
  /** Movements: any of these types. */
  type?: (typeof STOCK_MOVEMENT_KINDS)[number][];
  /** Movements: one item's (`S:77`) — a public id. */
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
    lasts: oneOf(STOCK_LASTS_FILTERS, search.lasts),
    status: listIn(STOCK_PURCHASE_STATUSES, search.status),
    vendor: matchOf(PUBLIC_ID, search.vendor),
    type: listIn(STOCK_MOVEMENT_KINDS, search.type),
    item: matchOf(PUBLIC_ID, search.item),
  };
}
