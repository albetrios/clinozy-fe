/**
 * URL search-param schema for the Medical room's tabs (consumed by
 * routeTree's `validateSearch`; KICKOFF §6.7, `S:49–71`): each tab's search,
 * filters and sort; the dialog routes' prefills are
 * `medical.dialog-search.ts`'s, off the entry chunk. One reader serves every
 * tab — each tab reads only its own keys — so the entry chunk carries one
 * parser, not seven. A value the URL can't hold is dropped, never an error;
 * defaults stay out of the URL.
 *
 * The contract's values are declared here, not imported: `routeTree.tsx` is
 * the entry chunk, and the generated schema module is pages of zod. The test
 * pins each list to the contract's enum.
 */
import {
  listIn,
  listOf,
  oneOf,
  PUBLIC_ID,
  queryOf,
  sortOf,
  textOf,
} from '@/lib/routes/search-params.ts';
import {
  type CreatedFilter,
  readCreatedFilter,
} from '@/shared/api/app/app-list-filters.ts';
import type { PaymentMode } from '@/shared/api/app/app-schema.ts';
import { LEDGER_FILTER_VALUES } from '@/shared/api/app/ledger-filter-values.ts';
import type { LedgerKindFilter } from '@/shared/api/app/payments-contracts.ts';

/** Sales' Status filter beyond All (`medical.md:39`; the API's `status`, voided aside). */
export const SALE_STATUSES = ['unpaid', 'paid', 'returned'] as const;
/** Medicines' Stock filter beyond All. */
export const MEDICINE_STOCK_FILTERS = ['low'] as const;
/** Medicines' Nearest expiry windows beyond Any, in days. */
export const MEDICINE_EXPIRY_FILTERS = ['30', '60', '90'] as const;
/** Purchases' Stage filter beyond All — cancelled orders leave the list. */
export const PURCHASE_STAGES = ['ordered', 'received', 'paid'] as const;
/** Suppliers' Payable filter beyond All: owed something (`has_payable`) — where "Pay all received" lands. */
export const SUPPLIER_PAYABLE_FILTERS = ['owed'] as const;

/** Every tab's sortable columns — a tab reads the ones it has (`medical.md:31–111`). */
const SORT_KEYS = [
  'seq',
  'customer',
  'bill',
  'name',
  'manufacturer',
  'stock',
  'mrp',
  'margin',
  'supplier',
  'date',
  'total',
  'stage',
  'payable',
] as const;

/** A sortable column of any Medical tab. */
type MedicalSortKey = (typeof SORT_KEYS)[number];

/** A column sort in the URL: `bill:desc`, `name:asc` (the shared table's form). */
type MedicalSort = `${MedicalSortKey}:${'asc' | 'desc'}`;

/** Validated `?…` search params for the Medical tabs and their dialog routes. */
export interface MedicalSearch {
  /** The tab's search (≤ 80 characters, the contract's `q`). */
  q?: string;
  created?: CreatedFilter;
  sort?: MedicalSort;
  /** Sales: Unpaid, Paid or Returned. */
  status?: (typeof SALE_STATUSES)[number];
  /** Medicines: Low stock. */
  stock?: (typeof MEDICINE_STOCK_FILTERS)[number];
  /** Medicines: a batch expiring within 30 / 60 / 90 days. */
  expiry?: (typeof MEDICINE_EXPIRY_FILTERS)[number];
  /** Medicines: any of these manufacturers; Suppliers: the first. */
  manufacturer?: string[];
  /** Suppliers: only those owed something. */
  payable?: (typeof SUPPLIER_PAYABLE_FILTERS)[number];
  /** Purchases: the stage. */
  stage?: (typeof PURCHASE_STAGES)[number];
  /** Manufacturers: a supplier (the first). */
  suppliers?: string[];
  /** Manufacturers: an MR (the first). */
  mrs?: string[];
}

/** Record ids as the URL holds them — clinozy-be public ids (`mfr_…`, `sup_…`, `mrep_…`). */
const ids = (value: unknown) => listOf<string>(value, (entry) => PUBLIC_ID.test(entry));

/**
 * Parse a Medical tab's search params. Every key is answered, `undefined`
 * included: the router keeps a raw value the schema omits, so dropping one
 * means saying so.
 */
export function validateMedicalSearch(search: Record<string, unknown>): MedicalSearch {
  return {
    q: queryOf(search.q, 80),
    created: readCreatedFilter(search.created),
    sort: sortOf(SORT_KEYS, search.sort),
    status: oneOf(SALE_STATUSES, search.status),
    stock: oneOf(MEDICINE_STOCK_FILTERS, search.stock),
    expiry: oneOf(MEDICINE_EXPIRY_FILTERS, textOf(search.expiry)),
    manufacturer: ids(search.manufacturer),
    payable: oneOf(SUPPLIER_PAYABLE_FILTERS, search.payable),
    stage: oneOf(PURCHASE_STAGES, search.stage),
    suppliers: ids(search.suppliers),
    mrs: ids(search.mrs),
  };
}

/**
 * Medical › Payments' params (`S:71`): the Payments ledger's What, Mode,
 * Created and search — its Medical scope is fixed, not in the URL — and no
 * "Show" (`medical.md:135`).
 */
export interface MedicalPaymentsSearch {
  /** A PAY- number, the party or an invoice number (≤ 80 characters). */
  q?: string;
  /** What: any of these kinds. */
  kind?: LedgerKindFilter[];
  /** Mode: any entry with a split in these modes. */
  mode?: PaymentMode[];
  created?: CreatedFilter;
}

/** Parse Medical › Payments' search params. */
export function validateMedicalPaymentsSearch(
  search: Record<string, unknown>,
): MedicalPaymentsSearch {
  return {
    q: queryOf(search.q, 80),
    kind: listIn(LEDGER_FILTER_VALUES.kind, search.kind),
    mode: listIn(LEDGER_FILTER_VALUES.mode, search.mode),
    created: readCreatedFilter(search.created),
  };
}

/** Medical › Credits' two sides: from suppliers (by default, out of the URL) and with customers. */
export const MEDICAL_CREDIT_SIDES = ['suppliers', 'customers'] as const;
/** A supplier credit's state: open until set against the supplier's orders in full. */
export const SUPPLIER_CREDIT_STATES = ['open', 'adjusted'] as const;
/** A customer credit's way: the store owes it back, or is owed it. */
export const CUSTOMER_CREDIT_WAYS = ['give', 'take'] as const;
/** A customer credit's state (Pending's). */
export const CUSTOMER_CREDIT_STATES = ['open', 'given_back', 'got_back', 'used'] as const;

/**
 * Medical › Credits' params (clinozy-be D90): the side; from suppliers, the State; with
 * customers, the search, Which way, State and Created — the Payments room's Pending filters.
 */
export interface MedicalCreditsSearch {
  side?: (typeof MEDICAL_CREDIT_SIDES)[number];
  /** With customers: the person or a CR- number (≤ 80 characters). */
  q?: string;
  /** From suppliers: Open or Adjusted. */
  state?: (typeof SUPPLIER_CREDIT_STATES)[number];
  /** With customers: any of these ways. */
  direction?: (typeof CUSTOMER_CREDIT_WAYS)[number][];
  /** With customers: any of these states. */
  status?: (typeof CUSTOMER_CREDIT_STATES)[number][];
  created?: CreatedFilter;
}

/** Parse Medical › Credits' search params; "From suppliers" stays out of the URL. */
export function validateMedicalCreditsSearch(
  search: Record<string, unknown>,
): MedicalCreditsSearch {
  const side = oneOf(MEDICAL_CREDIT_SIDES, search.side);
  return {
    side: side === 'suppliers' ? undefined : side,
    q: queryOf(search.q, 80),
    state: oneOf(SUPPLIER_CREDIT_STATES, search.state),
    direction: listIn(CUSTOMER_CREDIT_WAYS, search.direction),
    status: listIn(CUSTOMER_CREDIT_STATES, search.status),
    created: readCreatedFilter(search.created),
  };
}
