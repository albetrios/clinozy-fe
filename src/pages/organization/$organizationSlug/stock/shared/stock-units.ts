import type {
  StockCategory,
  StockMovementType,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';

/*
 * The Clinic stock arithmetic (KICKOFF §6.8 Data): pure, so the tables, the
 * Use popover, the movement drawer and Stock check read one set of rules —
 * and clinozy-be mirrors them. Quantities are stored ×1000 (`qtyMilli`,
 * `usagePerWeekMilli`, `sizePerUnit`; `S:886`): a tube and a half is 1500.
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

/** The level of `qtyMilli` against the whole-unit minimum. */
export function stockLevel(qtyMilli: number, minQty: number): StockLevel {
  if (qtyMilli <= 0) return 'out';
  return qtyMilli <= toMilli(minQty) ? 'low' : 'ok';
}

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

/**
 * How many days the stock lasts at its weekly use: ⌊stock ÷ weekly use × 7⌋
 * (`clinic-stock.md:29`); `null` when nothing is used ("No usage").
 */
export function lastsDays(qtyMilli: number, usagePerWeekMilli: number): number | null {
  if (usagePerWeekMilli <= 0) return null;
  return Math.floor((qtyMilli / usagePerWeekMilli) * 7);
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

/** A runway as the URL's Lasts filter keeps it: `d5`, `w6`, `none`. */
export function runwayKey(runway: Runway): string {
  if (runway.kind === 'none') return 'none';
  return `${runway.kind === 'days' ? 'd' : 'w'}${runway.count}`;
}

/** The runway a Lasts key names — `null` for a key the filter cannot hold. */
export function runwayFromKey(key: string): Runway | null {
  if (key === 'none') return { kind: 'none' };
  const match = /^([dw])(\d{1,4})$/.exec(key);
  if (!match) return null;
  return { kind: match[1] === 'd' ? 'days' : 'weeks', count: Number(match[2]) };
}

/** A runway's length in days — a week counts seven; `null` with no usage. */
export function runwayDays(runway: Runway): number | null {
  if (runway.kind === 'none') return null;
  return runway.kind === 'days' ? runway.count : runway.count * 7;
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

/** A Movements row's type: the contract's, or a payment on a purchase. */
export type StockMovementKind = StockMovementType | 'payment';

/** Each movement type's tone (`clinic-stock.md:61`). */
export const STOCK_MOVEMENT_TONES: Readonly<Record<StockMovementKind, Tone>> = {
  used: 'blush',
  received: 'sage',
  adjust: 'sky',
  damaged: 'butter',
  returned: 'lav',
  reverted: 'stone',
  payment: 'sky',
};

/** A purchase's settlement: Paid, Partly paid or Unpaid. */
export type StockPurchaseStatus = 'paid' | 'partly' | 'unpaid';

/** Each status's tone — the pill and the row's edge (`clinic-stock.md:45`). */
export const STOCK_PURCHASE_STATUS_TONES: Readonly<Record<StockPurchaseStatus, Tone>> = {
  paid: 'sage',
  partly: 'butter',
  unpaid: 'blush',
};

/** A purchase's status from its bill and what was paid. */
export function purchaseStatus(bill: number, paid: number): StockPurchaseStatus {
  if (bill - paid <= 0) return 'paid';
  return paid > 0 ? 'partly' : 'unpaid';
}
