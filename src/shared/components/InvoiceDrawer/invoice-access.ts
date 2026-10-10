import type { InvoiceRecord } from '@/shared/api/clinic/invoices-contracts.ts';
import {
  type ClinicAccess,
  useClinicAccess,
} from '@/shared/hooks/useClinicAccess/index.ts';

/*
 * Who may do what with an invoice (research-payments §7): the money codes clinozy-be checks —
 * `payment:read` to see it, `payment:create` to bill (with "Paid now"), `payment:update` to
 * change it, `payment:delete` to delete it and bring it back — the codes in force (the member's
 * own, or the previewed role's while View-as runs). A Medical sale is Medical's create.
 */

/** A money code the invoice drawer asks about. */
export type PaymentCode =
  'payment:read' | 'payment:create' | 'payment:update' | 'payment:delete';

/** Whether the codes in force hold a money code — false until access resolves ("not known yet"). */
export function canPayment(
  access: Pick<ClinicAccess, 'isResolved' | 'canCode'>,
  code: PaymentCode,
): boolean {
  return access.isResolved && access.canCode(code);
}

/** What the drawer allows on this opening. */
export interface InvoiceDrawerAccess {
  /** The access answered: before, nothing is asked of the server for the member. */
  resolved: boolean;
  /** View only: the member may not write this — or the invoice can no longer change. */
  readOnly: boolean;
  /** Why a saved invoice reads only, whatever the member holds: its day closed, a sale's. */
  locked: 'settled' | 'sale' | null;
  /** Delete — a saved, unlocked invoice, for `payment:delete`. */
  canDelete: boolean;
  /** The offering's lowest price in the "below its lowest price" words (`offering:lower_price:read`). */
  floorVisible: boolean;
  /** "New offering · “q”" in a line's picker (`offering:create`). */
  addOffering: boolean;
  /** A medicine a sale's store lacks becomes a quick draft (Q-M4): Medical's create. */
  addMedicine: boolean;
}

/** Why a saved invoice is never changed here: a payment on a closed day, or a Medical sale's. */
function lockOf(invoice: InvoiceRecord | null): InvoiceDrawerAccess['locked'] {
  if (!invoice) return null;
  if (invoice.type === 'medical') return 'sale';
  return invoice.isSettled ? 'settled' : null;
}

/**
 * The drawer's gates: a new invoice takes `payment:create`, a saved one `payment:update` — else
 * "View only"; a new Medical sale Medical's create. A settled invoice (a payment on a closed day)
 * and a Medical sale's invoice read only for everyone.
 */
export function useInvoiceAccess(
  editing: InvoiceRecord | null,
  newSale: boolean,
): InvoiceDrawerAccess {
  const access = useClinicAccess();
  const locked = lockOf(editing);
  let mayWrite = canPayment(access, editing ? 'payment:update' : 'payment:create');
  if (newSale) mayWrite = access.isResolved && access.can('medical', 'create');
  const readOnly = locked !== null || (access.isResolved && !mayWrite);
  const holds = (code: string) => access.isResolved && access.canCode(code);
  return {
    resolved: access.isResolved,
    readOnly,
    locked,
    canDelete:
      editing !== null && locked === null && canPayment(access, 'payment:delete'),
    floorVisible: holds('offering:lower_price:read'),
    addOffering: holds('offering:create'),
    addMedicine: access.isResolved && access.can('medical', 'create'),
  };
}
