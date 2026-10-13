/**
 * The read Clinic stock › Movements makes from the URL (KICKOFF §6.8, `S:77`).
 * Kept out of `stock.search.ts`, which rides the entry chunk; this module
 * loads with the tab. Movements never sort — newest first (`S:1682`) — and
 * have no search: clinozy-be does not search movements; the Item filter
 * (`stock_item_id`) narrows them to one item.
 */
import type { StockMovementListParams } from '../shared/stock-contracts.ts';
import type { StockSearch } from '../stock.search.ts';

/** The list read's params for the URL as it stands — what the tab hands `useStockMovementList`. */
export function movementParamsOf(search: StockSearch): StockMovementListParams {
  return {
    type: search.type,
    item: search.item,
    created: search.created,
  };
}

/** The read's filter part — any change shows the skeleton. */
export function movementFilterKey(params: StockMovementListParams): string {
  return JSON.stringify([params.type, params.item, params.created]);
}
