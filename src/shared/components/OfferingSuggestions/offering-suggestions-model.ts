/**
 * The Offering suggestions card's line rules (PK9, H:4339–4377). Pure — money in paise; a
 * line's price is the whole line's. The plan's total, what is invoiced and the lowest-price
 * flag are the server's (`meta.plan_total`, `invoiced_quantity`, `is_below_lowest_price`, §7).
 */
import type { SuggestionLine } from './offering-suggestions.types.ts';

/** The quantity's range (PK7: 1–99). */
export const SUGGESTION_QTY = { min: 1, max: 99 } as const;

/** A line at its billed price: one unit's × qty — what the server bills a line without its own price at. */
export const lineListPrice = (line: Pick<SuggestionLine, 'listPrice' | 'qty'>): number =>
  line.listPrice * line.qty;

/** A line's final price: its own, else its billed price × qty. */
export const lineFinalPrice = (
  line: Pick<SuggestionLine, 'price' | 'listPrice' | 'qty'>,
): number => line.price ?? lineListPrice(line);

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

/**
 * A quantity step (H:4343): the new quantity, and a typed price scaled with it so the discount
 * per unit holds; a line at its billed price stays at it.
 */
export function withQty(
  line: Pick<SuggestionLine, 'price' | 'qty'>,
  qty: number,
): { qty: number; price: number | null } {
  const next = Math.min(SUGGESTION_QTY.max, Math.max(SUGGESTION_QTY.min, qty));
  if (line.price === null) return { qty: next, price: null };
  return { qty: next, price: Math.round((line.price / Math.max(1, line.qty)) * next) };
}
