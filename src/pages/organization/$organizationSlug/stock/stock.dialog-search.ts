/**
 * The search schemas of the Clinic stock room — the create drawers' prefills: New
 * item, New purchase and New clinic vendor (`S:74, S:79, S:82`). Kept out of
 * `stock.search.ts` on purpose: `routeTree.tsx` (the entry chunk) imports that
 * module for the page's `validateSearch`, so a dialog's schema there ships on
 * every first paint. The dialog route only types its search from here
 * (`dialogSearch` in `routeTree.tsx`); the page that opens the drawer parses it,
 * and this module loads with the room.
 */
import { oneOf, textOf } from '@/lib/routes/search-params.ts';

/** The dialog routes' prefills: New purchase's `?reorder=low` (`S:79`). */
export interface StockCreateSearch {
  /** "Reorder low items": every item at or below its minimum. */
  reorder?: 'low';
  /** A typed name (≤ 120 characters) — New item, New clinic vendor. */
  name?: string;
}

/** Parse a Clinic stock dialog route's prefill. */
export function validateStockCreateSearch(
  search: Record<string, unknown>,
): StockCreateSearch {
  const name = textOf(search.name);
  return {
    reorder: oneOf(['low'] as const, search.reorder),
    name: name && name.length <= 120 ? name : undefined,
  };
}
