/**
 * The search schemas of the shared Invoice drawer — New invoice's type, patient
 * and referrer on `create/` (`S:92`). Kept out of `invoices.search.ts` on purpose:
 * `routeTree.tsx` (the entry chunk) imports that module for the page's
 * `validateSearch`, so a dialog's schema there ships on every first paint. The
 * dialog route only types its search from here (`dialogSearch` in
 * `routeTree.tsx`); the page that opens the drawer parses it, and this module
 * loads with the room.
 */
import { matchOf, oneOf, PUBLIC_ID, textOf } from '@/lib/routes/search-params.ts';
import type { InvoiceType } from '@/shared/api/app/app-schema.ts';

import type { InvoiceSearch } from './invoices.search.ts';

/** The invoice types a create link may name (`S:92`), in the switch's order. */
export const INVOICE_TYPE_PARAMS = [
  'clinic',
  'medical',
  'consultation',
] as const satisfies readonly InvoiceType[];

/** `/invoices/create` (`S:92`): the type and patient to start with, and the room to go back to. */
export interface InvoiceCreateSearch extends InvoiceSearch {
  type?: InvoiceType;
  patient?: string;
  /** The patient file's "Copy invoice": the saved invoice a new one starts as. */
  copyOf?: string;
  /** The visit flow's "Create invoice from visit": the visit (`appt_…`) whose sessions it bills. */
  appointment?: string;
}

/** Parse New invoice's params. */
export function validateInvoiceCreateSearch(
  search: Record<string, unknown>,
): InvoiceCreateSearch {
  return {
    type: oneOf(INVOICE_TYPE_PARAMS, search.type),
    patient: matchOf(PUBLIC_ID, search.patient),
    copyOf: matchOf(PUBLIC_ID, search.copyOf),
    appointment: matchOf(PUBLIC_ID, search.appointment),
    from: textOf(search.from) || undefined,
  };
}
