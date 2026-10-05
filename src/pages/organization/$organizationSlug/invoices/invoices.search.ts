/**
 * URL search-param reader for the shared Invoice drawer's routes (consumed by
 * routeTree's `validateSearch`; KICKOFF §4, `S:92–94`). A value the URL can't
 * hold is dropped, never an error. `from` — the room that opened the drawer —
 * is held as text here and checked where it is used (`safeReferrer`), so the
 * entry chunk carries no allow-list (D51). New invoice's `?type=&patient=` are
 * `invoices.dialog-search.ts`'s, off the entry chunk.
 */
import { textOf } from '@/lib/routes/search-params.ts';

/** `/invoices/$invoiceId` and its edit: the room to go back to. */
export interface InvoiceSearch {
  from?: string;
}

/** Parse an invoice route's params. */
export function validateInvoiceSearch(search: Record<string, unknown>): InvoiceSearch {
  return { from: textOf(search.from) || undefined };
}
