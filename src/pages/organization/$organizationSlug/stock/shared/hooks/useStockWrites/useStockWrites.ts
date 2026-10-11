import type { QueryKey } from '@tanstack/react-query';

import { paymentQueryKeys } from '@/shared/api/app/payments-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { stockListReadKeys, stockQueryKeys } from '../../stock-api.ts';
import type {
  StockCountResult,
  StockItemRecord,
  StockItemRow,
  StockMovementRecord,
  StockPurchaseRecord,
  StockPurchaseRow,
  StockVendorRecord,
  StockVendorRow,
} from '../../stock-contracts.ts';
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
  type StockDeleteRequest,
  updateStockItem,
  updateStockPurchase,
  updateStockVendor,
} from '../../stock-records-api.ts';
import type {
  quickStockItemInput,
  StockCountInput,
  StockItemInput,
  StockMovementInput,
  StockPurchaseChange,
  StockPurchaseInput,
  StockRevertInput,
  StockVendorInput,
} from '../../stock-records-contracts.ts';

/*
 * Clinic stock's writes for the drawers, the Use popover, the confirms and
 * Stock check, each carrying its action's idempotency key. A write refreshes
 * the room — its rows join item and vendor names, and a movement moves an
 * item's level — and a purchase or vendor write the supplier bills Send
 * payment offers (`/payments/pay?bill=is:…`). A delete takes its row out of the
 * list at once and puts it back if the write fails.
 */

/** A record save: the record as read — its `updated_at` guards the save — and the drawer's fields. */
export interface StockUpdateVars<TRecord, TInput> {
  record: TRecord;
  input: TInput;
}

/** A record delete: the record and the reason confirm's choice. */
export type StockDeleteVars = StockDeleteRequest;

/** What every stock write refreshes; bills add Send payment's open bills. */
const ROOM_KEYS: readonly QueryKey[] = [stockQueryKeys.all];
const BILL_KEYS: readonly QueryKey[] = [stockQueryKeys.all, paymentQueryKeys.openBills()];

/** The active organization — a delete patches its lists. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

// ── Vendors ──

/** New clinic vendor. */
export function useCreateStockVendor(
  options: CrudMutationOptions<StockVendorRecord, StockVendorInput> = {},
) {
  return useAppMutation<StockVendorRecord, StockVendorInput>({
    mutationFn: (input, action) => createStockVendor({ input, ...action }),
    invalidateKeys: [...BILL_KEYS],
    ...options,
  });
}

/** Save a clinic vendor — refused when someone saved them since (`409 record_changed`). */
export function useUpdateStockVendor(
  options: CrudMutationOptions<
    StockVendorRecord,
    StockUpdateVars<StockVendorRecord, StockVendorInput>
  > = {},
) {
  return useAppMutation<
    StockVendorRecord,
    StockUpdateVars<StockVendorRecord, StockVendorInput>
  >({
    mutationFn: (vars, action) => updateStockVendor({ ...vars, ...action }),
    invalidateKeys: [...BILL_KEYS],
    ...options,
  });
}

/** Delete a clinic vendor with a reason — optimistic on the Vendors list. */
export function useDeleteStockVendor(
  options: CrudMutationOptions<void, StockDeleteVars> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, StockDeleteVars, unknown, StockVendorRow>({
    mutationFn: (vars) => deleteStockVendor(vars),
    invalidateKeys: [...stockListReadKeys(organizationId), paymentQueryKeys.openBills()],
    optimisticInfinite: {
      queryKey: stockQueryKeys.vendorLists(organizationId),
      update: (rows, { id }) => rows.filter((vendor) => vendor.id !== id),
    },
    ...options,
  });
}

/** Restore a deleted vendor — the toast's Undo. */
export function useRestoreStockVendor(
  options: CrudMutationOptions<StockVendorRecord, string> = {},
) {
  return useAppMutation<StockVendorRecord, string>({
    mutationFn: (id, action) => restoreStockVendor(id, action.idempotencyKey),
    invalidateKeys: [...BILL_KEYS],
    ...options,
  });
}

// ── Items ──

/** New item — In stock is its opening quantity. */
export function useCreateStockItem(
  options: CrudMutationOptions<StockItemRecord, StockItemInput> = {},
) {
  return useAppMutation<StockItemRecord, StockItemInput>({
    mutationFn: (input, action) => createStockItem({ input, ...action }),
    invalidateKeys: [...ROOM_KEYS],
    ...options,
  });
}

/** Save an item — its changed fields, then a changed In stock as an Adjust movement. */
export function useUpdateStockItem(
  options: CrudMutationOptions<
    StockItemRecord,
    StockUpdateVars<StockItemRecord, StockItemInput>
  > = {},
) {
  return useAppMutation<
    StockItemRecord,
    StockUpdateVars<StockItemRecord, StockItemInput>
  >({
    mutationFn: (vars, action) => updateStockItem({ ...vars, ...action }),
    invalidateKeys: [...ROOM_KEYS],
    ...options,
  });
}

/** What "add as typed" and the stacked New clinic item send. */
export type StockQuickItemVars = Parameters<typeof quickStockItemInput>[0];

/** "Not in the list · add as typed" and the stacked New clinic item. */
export function useQuickCreateStockItem(
  options: CrudMutationOptions<StockItemRecord, StockQuickItemVars> = {},
) {
  return useAppMutation<StockItemRecord, StockQuickItemVars>({
    mutationFn: (input, action) => quickCreateStockItem({ input, ...action }),
    invalidateKeys: [...ROOM_KEYS],
    ...options,
  });
}

/** Delete an item with a reason — only at zero; optimistic on the Items list. */
export function useDeleteStockItem(
  options: CrudMutationOptions<void, StockDeleteVars> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, StockDeleteVars, unknown, StockItemRow>({
    mutationFn: (vars) => deleteStockItem(vars),
    invalidateKeys: stockListReadKeys(organizationId),
    optimisticInfinite: {
      queryKey: stockQueryKeys.itemLists(organizationId),
      update: (rows, { id }) => rows.filter((item) => item.id !== id),
    },
    ...options,
  });
}

/** Restore a deleted item — the toast's Undo. */
export function useRestoreStockItem(
  options: CrudMutationOptions<StockItemRecord, string> = {},
) {
  return useAppMutation<StockItemRecord, string>({
    mutationFn: (id, action) => restoreStockItem(id, action.idempotencyKey),
    invalidateKeys: [...ROOM_KEYS],
    ...options,
  });
}

// ── Movements ──

/** A use, receipt, adjustment, damage or return — the answer's `afterMilli` is what is left. */
export function useLogStockMovement(
  options: CrudMutationOptions<StockMovementRecord, StockMovementInput> = {},
) {
  return useAppMutation<StockMovementRecord, StockMovementInput>({
    mutationFn: (input, action) => logStockMovement({ input, ...action }),
    invalidateKeys: [...ROOM_KEYS],
    ...options,
  });
}

/**
 * Revert a movement — the Revert confirm, and the Undo of a use, a receipt or
 * an adjustment (reason `mistake`): both entries stay in the history.
 */
export function useRevertStockMovement(
  options: CrudMutationOptions<StockMovementRecord, StockRevertInput> = {},
) {
  return useAppMutation<StockMovementRecord, StockRevertInput>({
    mutationFn: (input, action) => revertStockMovement({ input, ...action }),
    invalidateKeys: [...ROOM_KEYS],
    ...options,
  });
}

// ── Purchases ──

/** New purchase: its lines are received into stock; "Paid" is a supplier-bill payment. */
export function useCreateStockPurchase(
  options: CrudMutationOptions<StockPurchaseRecord, StockPurchaseInput> = {},
) {
  return useAppMutation<StockPurchaseRecord, StockPurchaseInput>({
    mutationFn: (input, action) => createStockPurchase({ input, ...action }),
    invalidateKeys: [...BILL_KEYS],
    ...options,
  });
}

/** Save a purchase's details — never its lines. */
export function useUpdateStockPurchase(
  options: CrudMutationOptions<
    StockPurchaseRecord,
    StockUpdateVars<StockPurchaseRecord, StockPurchaseChange>
  > = {},
) {
  return useAppMutation<
    StockPurchaseRecord,
    StockUpdateVars<StockPurchaseRecord, StockPurchaseChange>
  >({
    mutationFn: (vars, action) => updateStockPurchase({ ...vars, ...action }),
    invalidateKeys: [...BILL_KEYS],
    ...options,
  });
}

/** Delete a purchase with a reason — only an unpaid one; optimistic on the Purchases list. */
export function useDeleteStockPurchase(
  options: CrudMutationOptions<void, StockDeleteVars> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, StockDeleteVars, unknown, StockPurchaseRow>({
    mutationFn: (vars) => deleteStockPurchase(vars),
    invalidateKeys: [...stockListReadKeys(organizationId), paymentQueryKeys.openBills()],
    optimisticInfinite: {
      queryKey: stockQueryKeys.purchaseLists(organizationId),
      update: (rows, { id }) => rows.filter((purchase) => purchase.id !== id),
    },
    ...options,
  });
}

/** Restore a deleted purchase — the toast's Undo; its stock is received again. */
export function useRestoreStockPurchase(
  options: CrudMutationOptions<StockPurchaseRecord, string> = {},
) {
  return useAppMutation<StockPurchaseRecord, string>({
    mutationFn: (id, action) => restoreStockPurchase(id, action.idempotencyKey),
    invalidateKeys: [...BILL_KEYS],
    ...options,
  });
}

// ── Stock check ──

/** Save a Stock check — each changed count an Adjust movement noted "Stock check". */
export function useSaveStockCount(
  options: CrudMutationOptions<StockCountResult, StockCountInput> = {},
) {
  return useAppMutation<StockCountResult, StockCountInput>({
    mutationFn: (input, action) => saveStockCount({ input, ...action }),
    invalidateKeys: [...ROOM_KEYS],
    ...options,
  });
}
