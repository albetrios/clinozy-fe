import type { SortDirection } from '@/lib/routes/search-params.ts';
import type { CreatedFilter } from '@/shared/api/clinic/clinic-list-filters.ts';
import type {
  RevertReason,
  StockCategory,
  StockItem,
  StockMovement,
  StockPurchase,
  StockVendor,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';

import type {
  StockLevel,
  StockMovementKind,
  StockPurchaseStatus,
} from './stock-units.ts';

/*
 * The Clinic stock family's read shapes (KICKOFF §6.8 Data): each list row is
 * the contract record (`S:860–937`) plus what the server derives for the
 * list — a backend request (Appendix F), served by the fixture server until
 * then (REPLACE_WITH_API).
 */

/** A vendor as a row names them: the person chip's name and phone. */
export interface StockVendorRef {
  id: string;
  name: string;
  phone: string | null;
}

/** A member as the Movements "By" cell shows them: avatar and short name. */
export interface StockStaffRef {
  id: string;
  name: string;
  initials: string;
  tone: Tone;
}

// ── Items ──

/** One Items row (`clinic-stock.md:29`): the item, its vendor, its level and runway. */
export interface StockItemRow extends StockItem {
  vendor: StockVendorRef | null;
  level: StockLevel;
  /** Days the stock lasts at its weekly use; `null` with no usage. */
  lastsDays: number | null;
}

/** The Items columns the server sorts by (`clinic-stock.md:31`). */
type StockItemSortKey = 'seq' | 'name' | 'category' | 'stock' | 'lasts';

/** `listStockItems`' params (`S:1680`): search, Low stock, categories, runways, Created, sort. */
export interface StockItemListParams {
  q?: string;
  stock?: 'low';
  category?: readonly StockCategory[];
  /** Runway keys (`d5`, `w6`, `none`) — the automatic Lasts section. */
  lasts?: readonly string[];
  created?: CreatedFilter;
  sort?: StockItemSortKey;
  order?: SortDirection;
}

// ── Purchases ──

/** One Purchases row (`clinic-stock.md:45`): the bill, its vendor, what is due, its status. */
export interface StockPurchaseRow extends StockPurchase {
  vendor: StockVendorRef | null;
  /** Bill − paid, never below 0. */
  due: number;
  status: StockPurchaseStatus;
}

/** The Purchases columns the server sorts by (`clinic-stock.md:47`). */
type StockPurchaseSortKey = 'seq' | 'vendor' | 'bill' | 'due';

/** `listStockPurchases`' params (`S:1682`): search, statuses, one vendor, Created, sort. */
export interface StockPurchaseListParams {
  q?: string;
  status?: readonly StockPurchaseStatus[];
  vendor?: string;
  created?: CreatedFilter;
  sort?: StockPurchaseSortKey;
  order?: SortDirection;
}

// ── Movements ──

/** A movement row's item: what the Change cell measures in. */
interface StockMovementItem {
  id: string;
  name: string;
  unit: StockItem['unit'];
  sizePerUnit: number | null;
  measureUnit: StockItem['measureUnit'];
}

/**
 * A Movements row that is a stock change (`clinic-stock.md:61`): its type,
 * item, note and signed change, struck through once reverted.
 */
export interface StockChangeRow {
  id: string;
  kind: Exclude<StockMovementKind, 'payment'>;
  movement: StockMovement;
  item: StockMovementItem;
  /** Its "used for" — "LHR · Dharti Galani", a bill number. */
  note: string | null;
  /** When it happened (the movement's `createdAt`). */
  at: string;
  by: StockStaffRef | null;
  deltaMilli: number;
  /** A later movement reverted this one. */
  reverted: boolean;
  /** A Reverted entry's original — "Reverts used of Today 11:05 · Logged by mistake". */
  reverts: {
    kind: Exclude<StockMovementKind, 'payment'>;
    /** When the original happened. */
    at: string;
    reason: RevertReason | null;
  } | null;
}

/**
 * A Movements row for a payment on a purchase — one per purchase with money
 * paid (`clinic-stock.md:71`), derived from it until `listMovements` serves
 * them (Appendix F).
 */
interface StockPaymentRow {
  id: string;
  kind: 'payment';
  purchase: { id: string; seq: number; billNo: string | null };
  vendorName: string;
  /** The purchase's bill date. */
  date: string;
  /** When the purchase was recorded — the row's place in the newest-first order. */
  createdAt: string;
  by: StockStaffRef | null;
  /** What was paid, paise. */
  amount: number;
}

/** One Movements row: a stock change or a payment. */
export type StockMovementRow = StockChangeRow | StockPaymentRow;

/** `listMovements`' params (`S:1681`): search, types, one item, Created; newest first. */
export interface StockMovementListParams {
  q?: string;
  type?: readonly StockMovementKind[];
  item?: string;
  created?: CreatedFilter;
}

// ── Vendors ──

/** One Vendors row (Q-K1): the vendor, their purchases and what they are owed. */
export interface StockVendorRow extends StockVendor {
  purchaseCount: number;
  payable: number;
  /** The oldest purchase not paid in full — where "Pay ₹X" opens. */
  oldestOpenPurchase: { id: string; seq: number; due: number } | null;
}

/** The Vendors columns the server sorts by. */
type StockVendorSortKey = 'name' | 'payable';

/** `listVendors`' params (`S:1683`): search, sort. */
export interface StockVendorListParams {
  q?: string;
  sort?: StockVendorSortKey;
  order?: SortDirection;
}

/** A list's footer figures: how many rows match and what is due on them. */
export interface StockListSummary {
  total: number;
  due: number;
}
