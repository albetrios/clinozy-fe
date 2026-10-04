import type { ClinicAction } from '@/shared/api/clinic/access-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

/** What the member may do in Clinic stock — every flag `false` until access resolves. */
export interface StockAccess {
  /** The access answered: before, a `false` means "not known yet", never "not allowed". */
  resolved: boolean;
  /** Use stock: the Use popover and Log usage (Create — Q-K2's Therapist and Front desk). */
  canUse: boolean;
  /** Change an existing record; without it a record opens read-only. */
  canEdit: boolean;
  /**
   * Keep the stock: add items, purchases and vendors, receive and adjust, Stock
   * check — Create with Edit (Admin, Pharmacist; Q-K2).
   */
  canManage: boolean;
  /** The red actions: Delete, Revert. */
  canDelete: boolean;
}

/**
 * The Clinic stock gates (KICKOFF §6.8 Access; Q-K2, `clinic-stock.md:7`) on the
 * `stock` section of the clinic access matrix. Therapist and Front desk view
 * and use stock — Create alone; adding and changing records takes Create with
 * Edit, so a role that may only use stock never sees "New item", "New
 * purchase" or "Stock check" (AMBER: the PRD names "use" only).
 */
export function useStockAccess(): StockAccess {
  const access = useClinicAccess();
  const can = (action: ClinicAction) => access.isResolved && access.can('stock', action);
  return {
    resolved: access.isResolved,
    canUse: can('create'),
    canEdit: can('edit'),
    canManage: can('create') && can('edit'),
    canDelete: can('delete'),
  };
}

/** A record drawer's gates: view only, and whether its red Delete shows. */
export interface StockDrawerAccess {
  readOnly: boolean;
  canDelete: boolean;
}

/**
 * Who may do what in a Clinic stock drawer (`clinic-stock.md:7`): a new record
 * takes keeping the stock, a saved one Edit — else "View only · your role
 * can’t change this"; Delete with Stock Delete on a saved one.
 */
export function useStockDrawerAccess(editing: boolean): StockDrawerAccess {
  const access = useStockAccess();
  const readOnly = access.resolved && !(editing ? access.canEdit : access.canManage);
  return { readOnly, canDelete: editing && !readOnly && access.canDelete };
}
