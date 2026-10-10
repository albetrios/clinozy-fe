import type { ClinicAction } from '@/shared/api/clinic/access-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

/** What the member may do in Clinic stock — every flag `false` until access resolves. */
export interface StockAccess {
  /** The access answered: before, a `false` means "not known yet", never "not allowed". */
  resolved: boolean;
  /** New item, New purchase, New clinic vendor (`stock_item:create`). */
  canCreate: boolean;
  /**
   * Change a record and move stock — Edit, Use, Log usage, Receive, Adjust,
   * Revert and Stock check (`stock_item:update`); without it a record opens
   * read-only.
   */
  canEdit: boolean;
  /** The red Delete and its Undo (`stock_item:delete`). */
  canDelete: boolean;
  /** "Paid" on a new purchase and "Pay ₹X" (`payment:create`). */
  canPay: boolean;
}

/**
 * The Clinic stock gates (api-integration §5.6 Roles): the stock section's
 * actions — the member's clinozy-be `stock_item:*` codes (the room is on the
 * API), the previewed role's clinic matrix under View-as — and `payment:create`
 * for paying a bill, the member's own code (the previewed role's matrix during
 * View-as). The codes give Therapist and Front desk every keeping control, not
 * the design's "use" alone (Q-S1); Export is the table's (`stock_item:export`).
 */
export function useStockAccess(): StockAccess {
  const access = useClinicAccess();
  const can = (action: ClinicAction) => access.isResolved && access.can('stock', action);
  const canPay =
    access.previewRole === null
      ? access.canCode('payment:create')
      : access.can('payments', 'create');
  return {
    resolved: access.isResolved,
    canCreate: can('create'),
    canEdit: can('edit'),
    canDelete: can('delete'),
    canPay: access.isResolved && canPay,
  };
}

/** A record drawer's gates: view only, and whether its red Delete shows. */
export interface StockDrawerAccess {
  readOnly: boolean;
  canDelete: boolean;
}

/**
 * Who may do what in a Clinic stock drawer (`clinic-stock.md:7`): a new record
 * takes Create, a saved one Edit — else "View only · your role can’t change
 * this"; Delete with Stock Delete on a saved one.
 */
export function useStockDrawerAccess(editing: boolean): StockDrawerAccess {
  const access = useStockAccess();
  const readOnly = access.resolved && !(editing ? access.canEdit : access.canCreate);
  return { readOnly, canDelete: editing && !readOnly && access.canDelete };
}
