import type { AppAction } from '@/shared/api/app/access-contracts.ts';
import { canExportRows, useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';

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
const PAYMENT_CODES: Readonly<Record<AppAction, string>> = {
  view: 'payment:read',
  create: 'payment:create',
  edit: 'payment:update',
  delete: 'payment:delete',
};

/** The ledger's export code. */
const PAYMENT_EXPORT_CODE = 'payment:export';

/**
 * The Payments gates (research §7): the `payment:*` codes in force — the member's own, or the
 * previewed role's while View-as runs. One rule for the ledger, its drawers, its row actions and
 * "Pay ₹X" in the rooms that buy.
 */
export function usePaymentAccess(): PaymentAccess {
  const access = useAppAccess();
  const can = (action: AppAction) =>
    access.isResolved && access.canCode(PAYMENT_CODES[action]);
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
