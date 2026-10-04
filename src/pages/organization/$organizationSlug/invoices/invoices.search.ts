/**
 * URL search-param readers for the shared Invoice drawer's routes (consumed by
 * routeTree's `validateSearch`; KICKOFF §4, `S:92–94`). A value the URL can't
 * hold is dropped, never an error. `from` — the room that opened the drawer —
 * is held as text here and checked where it is used (`safeReferrer`), so the
 * entry chunk carries no allow-list (D51). The types are declared here, not
 * imported: `routeTree.tsx` is the entry chunk.
 */
import { matchOf, oneOf, RECORD_ID, textOf } from '@/lib/routes/search-params.ts';
import type { InvoiceType } from '@/shared/api/clinic/clinic-schema.ts';

/** The invoice types a create link may name (`S:92`), in the switch's order. */
export const INVOICE_TYPE_PARAMS = [
  'clinic',
  'medical',
  'consultation',
] as const satisfies readonly InvoiceType[];

/** `/invoices/$invoiceId` and its edit: the room to go back to. */
export interface InvoiceSearch {
  from?: string;
}

/** Parse an invoice route's params. */
export function validateInvoiceSearch(search: Record<string, unknown>): InvoiceSearch {
  return { from: textOf(search.from) || undefined };
}

/** `/invoices/create` (`S:92`): the type and patient to start with, and the room to go back to. */
export interface InvoiceCreateSearch extends InvoiceSearch {
  type?: InvoiceType;
  patient?: string;
}

/** Parse New invoice's params. */
export function validateInvoiceCreateSearch(
  search: Record<string, unknown>,
): InvoiceCreateSearch {
  return {
    type: oneOf(INVOICE_TYPE_PARAMS, search.type),
    patient: matchOf(RECORD_ID, search.patient),
    from: textOf(search.from) || undefined,
  };
}
