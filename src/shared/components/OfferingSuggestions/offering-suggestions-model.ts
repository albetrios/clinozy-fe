/**
 * The Offering suggestions card's sums and price rule (`S:480–499`, H:4339–4377).
 * Pure — money in paise; a line's price is the whole line's.
 */
import type { SuggestionStatus } from '@/shared/api/clinic/clinic-schema.ts';

import type { SuggestionLine } from './offering-suggestions.types.ts';

/** The quantity's range (`S:489`). */
export const SUGGESTION_QTY = { min: 1, max: 99 } as const;

/** The statuses the plan total counts (`S:499`): Next time and Declined are not in it. */
const IN_TOTAL: ReadonlySet<SuggestionStatus> = new Set(['planned', 'accepted']);

/** A line at list price: the unit's list price × qty. */
export const lineListPrice = (line: Pick<SuggestionLine, 'listPrice' | 'qty'>): number =>
  line.listPrice * line.qty;

/** A line's final price: its own, else list × qty. */
export const lineFinalPrice = (
  line: Pick<SuggestionLine, 'price' | 'listPrice' | 'qty'>,
): number => line.price ?? lineListPrice(line);

/** The header's sums. */
export interface SuggestionTotals {
  /** The plan total: the final prices of the Planned and Accepted lines. */
  total: number;
  /** What those lines save on list (0 at list price). */
  saved: number;
  /** What the linked invoice lines come to. */
  invoiced: number;
}

/**
 * The plan total (`S:499`: Σ final price over Planned and Accepted), what it
 * saves on list, and what is invoiced (Σ the linked lines' amounts).
 */
export function suggestionTotals(lines: readonly SuggestionLine[]): SuggestionTotals {
  let total = 0;
  let list = 0;
  let invoiced = 0;
  for (const line of lines) {
    invoiced += line.invoicedAmount;
    if (!IN_TOTAL.has(line.status)) continue;
    total += lineFinalPrice(line);
    list += lineListPrice(line);
  }
  return { total, saved: Math.max(0, list - total), invoiced };
}

/** The header's counts: lines not declined ("<n> suggested" / "<n> planned") and accepted. */
export function suggestionCounts(lines: readonly SuggestionLine[]): {
  live: number;
  accepted: number;
} {
  return {
    live: lines.filter((line) => line.status !== 'declined').length,
    accepted: lines.filter((line) => line.status === 'accepted').length,
  };
}

/** A line's lowest price: the unit's floor × qty; `null` without a floor. */
export const lineFloorPrice = (
  line: Pick<SuggestionLine, 'floorPrice' | 'qty'>,
): number | null => (line.floorPrice === null ? null : line.floorPrice * line.qty);

/**
 * Whether a line's own price goes below its floor — the red edge (`S:490`,
 * "warns, not blocks", `S:1646`). An emptied price (0) is not flagged while
 * the member types (H:4344).
 */
export function belowFloor(
  line: Pick<SuggestionLine, 'price' | 'floorPrice' | 'qty'>,
): boolean {
  const floor = lineFloorPrice(line);
  return line.price !== null && line.price > 0 && floor !== null && line.price < floor;
}

/**
 * A quantity step (H:4343): the new quantity, and a typed price scaled with it
 * so the discount per unit holds; a list-priced line stays list-priced.
 */
export function withQty(
  line: Pick<SuggestionLine, 'price' | 'qty'>,
  qty: number,
): { qty: number; price: number | null } {
  const next = Math.min(SUGGESTION_QTY.max, Math.max(SUGGESTION_QTY.min, qty));
  if (line.price === null) return { qty: next, price: null };
  return { qty: next, price: Math.round((line.price / Math.max(1, line.qty)) * next) };
}

/** A line every unit of which is invoiced — "✓ Invoiced", its controls gone. */
export const fullyInvoiced = (
  line: Pick<SuggestionLine, 'qty' | 'invoicedQty'>,
): boolean => line.qty > 0 && line.invoicedQty >= line.qty;
