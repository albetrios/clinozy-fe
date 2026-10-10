import type { ClinicAction } from '@/shared/api/clinic/access-contracts.ts';
import { canExportRows, useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

/** What the member may do with the ledger's money — every flag `false` until access resolves. */
export interface PaymentAccess {
  /** The access answered: before, a `false` means "not known yet", never "not allowed". */
  resolved: boolean;
  /** See the ledger, an entry and its edits (`payment:read`). */
  canRead: boolean;
  /** Receive, Send, and "Pay ₹X" on a supplier bill (`payment:create`). */
  canCreate: boolean;
  /** Change an open day's entry (`payment:update`); without it an entry opens view only. */
  canEdit: boolean;
  /** Delete an open day's entry and its Undo, and Reverse a closed day's (`payment:delete`). */
  canDelete: boolean;
  /**
   * Give money back — settle a `give` credit, as money or on a bill (`payment:create` and
   * `payment:delete`: clinozy-be D83 (1), a refund is the Owner's, the Admin's and the Accountant's).
   */
  canGiveBack: boolean;
  /** The ledger's Export (`payment:export`). */
  canExport: boolean;
}

/** Each gate's clinozy-be code (api-integration §5.8; the OpenAPI `x-permission`). */
const PAYMENT_CODES: Readonly<Record<ClinicAction, string>> = {
  view: 'payment:read',
  create: 'payment:create',
  edit: 'payment:update',
  delete: 'payment:delete',
};

/** The ledger's export code. */
const PAYMENT_EXPORT_CODE = 'payment:export';

/**
 * The Payments gates (research §7): the member's own clinozy-be `payment:*` codes — the room is on
 * the API — and, while View-as previews a role, that role's clinic matrix for the Payments
 * section (a preview holds no codes). One rule for the ledger, its drawers, its row actions and
 * "Pay ₹X" in the rooms that buy.
 */
export function usePaymentAccess(): PaymentAccess {
  const access = useClinicAccess();
  const can = (action: ClinicAction) => {
    if (!access.isResolved) return false;
    return access.previewRole === null
      ? access.canCode(PAYMENT_CODES[action])
      : access.can('payments', action);
  };
  return {
    resolved: access.isResolved,
    canRead: can('view'),
    canCreate: can('create'),
    canEdit: can('edit'),
    canDelete: can('delete'),
    canGiveBack: can('create') && can('delete'),
    canExport: canExportRows(access, PAYMENT_EXPORT_CODE),
  };
}
