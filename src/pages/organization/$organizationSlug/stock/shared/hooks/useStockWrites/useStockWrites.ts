import type { QueryKey } from '@tanstack/react-query';

import type {
  DeleteReason,
  StockItem,
  StockPurchase,
  StockVendor,
} from '@/shared/api/clinic/clinic-schema.ts';
import { paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

import { stockQueryKeys } from '../../stock-api.ts';
import {
  createStockItem,
  createStockPurchase,
  createStockVendor,
  deleteStockItem,
  deleteStockPurchase,
  deleteStockVendor,
  logStockMovement,
  quickCreateStockItem,
  restoreStockItem,
  restoreStockPurchase,
  restoreStockVendor,
  revertStockMovement,
  saveStockCount,
  undoStockMovement,
  updateStockItem,
  updateStockPurchase,
  updateStockVendor,
} from '../../stock-records-api.ts';
import type {
  StockCountInput,
  StockCountResult,
  StockItemInput,
  StockMovementInput,
  StockMovementResult,
  StockPurchaseInput,
  StockRevertInput,
  StockVendorInput,
} from '../../stock-records-contracts.ts';

/*
 * Clinic stock's writes for the drawers, the Use popover and Stock check
 * (KICKOFF §6.8): every write refreshes the room — its lists join item, vendor
 * and staff names — and a purchase or vendor write the supplier bills Send
 * payment offers (`/payments/pay?bill=is:…`).
 */

/** A record save: the record and its fields. */
export interface StockUpdateVars<TInput> {
  id: string;
  patch: TInput;
}

/** A record delete: the record and the reason confirm's choice. */
export interface StockDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/** What every stock write refreshes; bills add Send payment's open bills. */
const ROOM_KEYS: readonly QueryKey[] = [stockQueryKeys.all];
const BILL_KEYS: readonly QueryKey[] = [stockQueryKeys.all, paymentQueryKeys.openBills()];

/** One write of the room, refreshing what it joins. */
function useStockWrite<TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options: CrudMutationOptions<TData, TVars>,
  keys: readonly QueryKey[] = ROOM_KEYS,
) {
  return useAppMutation<TData, TVars>({
    mutationFn,
    invalidateKeys: [...keys],
    ...options,
  });
}

// ── Vendors ──

/** New clinic vendor (`S:1693`). */
export function useCreateStockVendor(
  options: CrudMutationOptions<StockVendor, StockVendorInput> = {},
) {
  return useStockWrite(createStockVendor, options, BILL_KEYS);
}

/** Save a clinic vendor (`S:1693`). */
export function useUpdateStockVendor(
  options: CrudMutationOptions<StockVendor, StockUpdateVars<StockVendorInput>> = {},
) {
  return useStockWrite(
    ({ id, patch }: StockUpdateVars<StockVendorInput>) => updateStockVendor(id, patch),
    options,
    BILL_KEYS,
  );
}

/** Delete a clinic vendor with a reason (`S:1546`). */
export function useDeleteStockVendor(
  options: CrudMutationOptions<StockVendor, StockDeleteVars> = {},
) {
  return useStockWrite(
    ({ id, reason, note }: StockDeleteVars) => deleteStockVendor(id, reason, note),
    options,
    BILL_KEYS,
  );
}

/** Restore a deleted vendor — the toast's Undo. */
export function useRestoreStockVendor(
  options: CrudMutationOptions<StockVendor, string> = {},
) {
  return useStockWrite(restoreStockVendor, options, BILL_KEYS);
}

// ── Items ──

/** New item (`S:1685`). */
export function useCreateStockItem(
  options: CrudMutationOptions<StockItem, StockItemInput> = {},
) {
  return useStockWrite(createStockItem, options);
}

/** Save an item (`S:1685`); a changed In stock is an Adjust movement. */
export function useUpdateStockItem(
  options: CrudMutationOptions<StockItem, StockUpdateVars<StockItemInput>> = {},
) {
  return useStockWrite(
    ({ id, patch }: StockUpdateVars<StockItemInput>) => updateStockItem(id, patch),
    options,
  );
}

/** "Not in the list · add as typed" and the stacked New clinic item. */
export function useQuickCreateStockItem(
  options: CrudMutationOptions<
    StockItem,
    Parameters<typeof quickCreateStockItem>[0]
  > = {},
) {
  return useStockWrite(quickCreateStockItem, options);
}

/** Delete an item with a reason (`S:1546`). */
export function useDeleteStockItem(
  options: CrudMutationOptions<StockItem, StockDeleteVars> = {},
) {
  return useStockWrite(
    ({ id, reason, note }: StockDeleteVars) => deleteStockItem(id, reason, note),
    options,
  );
}

/** Restore a deleted item — the toast's Undo. */
export function useRestoreStockItem(
  options: CrudMutationOptions<StockItem, string> = {},
) {
  return useStockWrite(restoreStockItem, options);
}

// ── Movements ──

/** A use, receipt, adjustment, damage or return (`useStock`, `S:1688`). */
export function useLogStockMovement(
  options: CrudMutationOptions<StockMovementResult, StockMovementInput> = {},
) {
  return useStockWrite(logStockMovement, options);
}

/** The Undo of a use, a movement or a revert: it goes, the stock comes back. */
export function useUndoStockMovement(
  options: CrudMutationOptions<StockItem, string> = {},
) {
  return useStockWrite(undoStockMovement, options);
}

/** Revert a movement (`revertMovement`, `S:1689`). */
export function useRevertStockMovement(
  options: CrudMutationOptions<StockMovementResult, StockRevertInput> = {},
) {
  return useStockWrite(revertStockMovement, options);
}

// ── Purchases ──

/** New purchase (`S:1686`): its lines are received into stock. */
export function useCreateStockPurchase(
  options: CrudMutationOptions<StockPurchase, StockPurchaseInput> = {},
) {
  return useStockWrite(createStockPurchase, options, BILL_KEYS);
}

/** Save a purchase (`S:1686`). */
export function useUpdateStockPurchase(
  options: CrudMutationOptions<StockPurchase, StockUpdateVars<StockPurchaseInput>> = {},
) {
  return useStockWrite(
    ({ id, patch }: StockUpdateVars<StockPurchaseInput>) =>
      updateStockPurchase(id, patch),
    options,
    BILL_KEYS,
  );
}

/** Delete a purchase with a reason (`S:1546`). */
export function useDeleteStockPurchase(
  options: CrudMutationOptions<StockPurchase, StockDeleteVars> = {},
) {
  return useStockWrite(
    ({ id, reason, note }: StockDeleteVars) => deleteStockPurchase(id, reason, note),
    options,
    BILL_KEYS,
  );
}

/** Restore a deleted purchase — the toast's Undo. */
export function useRestoreStockPurchase(
  options: CrudMutationOptions<StockPurchase, string> = {},
) {
  return useStockWrite(restoreStockPurchase, options, BILL_KEYS);
}

// ── Stock check ──

/** Save a Stock check (`saveStockCount`, `S:1690`). */
export function useSaveStockCount(
  options: CrudMutationOptions<StockCountResult, StockCountInput> = {},
) {
  return useStockWrite(saveStockCount, options);
}
