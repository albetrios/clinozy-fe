import type { StockCategory, Tone } from '@/shared/api/clinic/clinic-schema.ts';

import type { STOCK_MOVEMENT_KINDS, STOCK_PURCHASE_STATUSES } from '../stock.search.ts';

/*
 * The Clinic stock arithmetic the screens still do themselves (KICKOFF §6.8
 * Data; api-integration §7): pure, so the tables, the Use popover, the
 * movement drawer and Stock check read one set of rules. What clinozy-be
 * derives — an item's level and runway, a purchase's status and due, a
 * movement's change and the balance it left — is read from the API, never
 * worked out here. The room keeps quantities ×1000 (`qtyMilli`,
 * `usagePerWeekMilli`, `sizePerUnit`; the mapper converts the API's decimals):
 * a tube and a half is 1500.
 */

/** Stored quantities are thousandths of a unit. */
export const MILLI = 1000;

/** A stored quantity in units: 1500 → 1.5. */
export const fromMilli = (milli: number): number => milli / MILLI;

/** A quantity in units as stored: 1.5 → 1500. */
export const toMilli = (quantity: number): number => Math.round(quantity * MILLI);

/** An item's stock on the list: Out at 0, Low at or below its minimum, else OK. */
export type StockLevel = 'ok' | 'low' | 'out';

/** Each level's tone — the stock bar and the row's edge (`clinic-stock.md:29`). */
export const STOCK_LEVEL_TONES: Readonly<Record<StockLevel, Tone>> = {
  ok: 'sage',
  low: 'butter',
  out: 'blush',
};

/** The bar's fill: stock ÷ the maximum, a whole percent capped at 100. */
export function stockBarPercent(qtyMilli: number, maxQty: number): number {
  if (maxQty <= 0) return qtyMilli > 0 ? 100 : 0;
  return Math.min(100, Math.round((qtyMilli / toMilli(maxQty)) * 100));
}

/** What a stock is in the item's measure ("90 g" of 3 tubes of 30 g); `null` without contents. */
export function measuredQuantity(
  qtyMilli: number,
  sizePerUnit: number | null,
): number | null {
  if (!sizePerUnit) return null;
  return (qtyMilli / MILLI) * (sizePerUnit / MILLI);
}

/** The runway as the pill says it: "~5 days" up to a week, else "~6 weeks", or "No usage". */
export type Runway =
  { kind: 'days'; count: number } | { kind: 'weeks'; count: number } | { kind: 'none' };

/** The runway of `days` (H:5253: a week or less in days, longer in weeks). */
export function runwayOf(days: number | null): Runway {
  if (days === null) return { kind: 'none' };
  return days <= 7
    ? { kind: 'days', count: days }
    : { kind: 'weeks', count: Math.round(days / 7) };
}

/**
 * The runway's tone: ≤ 7 days blush, ≤ 21 butter, else sage; `null` with no
 * usage — the plain grey pill (H:5253).
 */
export function runwayTone(days: number | null): Tone | null {
  if (days === null) return null;
  if (days <= 7) return 'blush';
  return days <= 21 ? 'butter' : 'sage';
}

/** How many to order to fill up to the maximum — at least one (`clinic-stock.md:154`). */
export function reorderUnits(qtyMilli: number, maxQty: number): number {
  return Math.max(1, Math.ceil(maxQty - fromMilli(qtyMilli)));
}

/** Each category's tone (`clinic-stock.md:29`). */
export const STOCK_CATEGORY_TONES: Readonly<Record<StockCategory, Tone>> = {
  creams_serums: 'sky',
  peels: 'blush',
  masks: 'lav',
  consumables: 'mint',
  equipment: 'butter',
  other: 'stone',
};

/**
 * A movement's type as clinozy-be names it (`type`): the five a member logs, an
 * item's `opening` quantity and a `reverted` undo.
 */
export type StockMovementKind = (typeof STOCK_MOVEMENT_KINDS)[number];

/** Each movement type's tone (`clinic-stock.md:61`); an opening reads as stock coming in. */
export const STOCK_MOVEMENT_TONES: Readonly<Record<StockMovementKind, Tone>> = {
  used: 'blush',
  received: 'sage',
  adjust: 'sky',
  damaged: 'butter',
  returned: 'lav',
  opening: 'mint',
  reverted: 'stone',
};

/** A purchase's settlement as clinozy-be names it (`payment_status`): Paid, Partly paid or Unpaid. */
export type StockPurchaseStatus = (typeof STOCK_PURCHASE_STATUSES)[number];

/** Each status's tone — the pill and the row's edge (`clinic-stock.md:45`). */
export const STOCK_PURCHASE_STATUS_TONES: Readonly<Record<StockPurchaseStatus, Tone>> = {
  paid: 'sage',
  partial: 'butter',
  unpaid: 'blush',
};
