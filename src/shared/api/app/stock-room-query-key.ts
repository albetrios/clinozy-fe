/**
 * The prefix of Clinic stock's own reads (items, purchases, movements, vendors
 * — the room's `stockQueryKeys`). Shared so a ledger write can refresh them: a
 * payment against a stock purchase moves its "due" and its vendor's payable.
 */
export const STOCK_ROOM_QUERY_KEY = ['app', 'stock'] as const;
