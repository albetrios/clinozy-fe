import type { QueryKey } from '@tanstack/react-query';

import { creditQueryKeys } from '@/shared/api/app/credits-api.ts';
import { paymentQueryKeys } from '@/shared/api/app/payments-api.ts';
import type { LedgerRow, MoneyMode } from '@/shared/api/app/payments-contracts.ts';
import { todayQueryKeys } from '@/shared/api/app/today-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { MEDICINE_WRITE_KEYS } from '@/shared/hooks/useMedicines/index.ts';
import { MONEY_WRITE_KEYS } from '@/shared/hooks/usePayments/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

import { listPrescriptionsToFill, medicalQueryKeys } from '../../medical-api.ts';
import type {
  PurchaseCancelReason,
  PurchaseOrderRow,
  SaleRow,
  SaleVoidReason,
  SupplierCreditRow,
  SupplierCreditVoidReason,
} from '../../medical-contracts.ts';
import {
  cancelPurchaseOrder,
  collectSale,
  createPurchaseOrder,
  createSale,
  createSupplierCredit,
  receivePurchaseOrder,
  restorePurchaseOrder,
  restoreSale,
  restoreSupplierCredit,
  returnSale,
  updatePurchaseOrder,
  voidSale,
  voidSupplierCredit,
} from '../../medical-records-api.ts';
import type {
  ExpiringReturnInput,
  PurchaseOrderInput,
  ReceiveInput,
  SaleInput,
  SaleReturnInput,
} from '../../medical-records-contracts.ts';

/*
 * The Medical store's flows for the drawers and row actions (api-integration §5.5), each carrying
 * its action's idempotency key: purchase orders and their receipt, sales — create, Collect, a
 * return, the void and its Undo — and supplier credits. Every write refreshes the room and the
 * medicines it moves; a receipt adds Send payment's open bills, and a sale's money writes refresh
 * the ledger and its readers (invoices, Day close, patients) and the credits a store-credit return
 * leaves (MD33).
 */

/** An order's save: the order as read — its `updated_at` guards the save — and the drawer's fields. */
export interface OrderUpdateVars {
  record: PurchaseOrderRow;
  input: PurchaseOrderInput;
}

/** Receive goods: the order and what arrived. */
export interface ReceiveVars {
  id: string;
  input: ReceiveInput;
}

/** A sale's return: the sale and what comes back. */
export interface SaleReturnVars {
  saleId: string;
  input: SaleReturnInput;
}

/** A cancel or a void: the record and the reason confirm's choice. */
export interface FlowReasonVars<TReason extends string> {
  id: string;
  reason: TReason;
  note: string | null;
}

/** A supplier credit's void or its Undo: the supplier and the credit. */
export interface SupplierCreditRef {
  supplierId: string;
  creditId: string;
}

/** Collect: the sale as read and how it is paid. */
export interface CollectVars {
  sale: SaleRow;
  mode: MoneyMode;
}

/** What a stock write refreshes: the room and its medicines. */
const STOCK_KEYS: readonly QueryKey[] = MEDICINE_WRITE_KEYS;

/** A receipt makes a bill Send payment can settle. */
const BILL_KEYS: readonly QueryKey[] = [
  ...MEDICINE_WRITE_KEYS,
  paymentQueryKeys.openBills(),
];

/**
 * A sale's money and stock: the ledger and its readers, the credits, the room and its medicines —
 * and Today's floor, whose pharmacy cards offer Dispense on the prescriptions still to fill, which a
 * sale fills and a void empties again (as a prescription write refreshes it, `usePrescriptions`).
 */
const SALE_KEYS: readonly QueryKey[] = [
  ...MEDICINE_WRITE_KEYS,
  ...MONEY_WRITE_KEYS,
  creditQueryKeys.all,
  todayQueryKeys.floors(),
];

/** A supplier credit moves stock and what the supplier is owed — the bills Send payment offers. */
const CREDIT_KEYS: readonly QueryKey[] = BILL_KEYS;

// ── Purchase orders ──

/** New purchase order. */
export function useCreatePurchaseOrder(
  options: CrudMutationOptions<PurchaseOrderRow, PurchaseOrderInput> = {},
) {
  return useAppMutation<PurchaseOrderRow, PurchaseOrderInput>({
    mutationFn: (input, action) => createPurchaseOrder({ input, ...action }),
    invalidateKeys: [...STOCK_KEYS],
    ...options,
  });
}

/** Save an Ordered purchase order — refused when someone saved it since (`409 record_changed`). */
export function useUpdatePurchaseOrder(
  options: CrudMutationOptions<PurchaseOrderRow, OrderUpdateVars> = {},
) {
  return useAppMutation<PurchaseOrderRow, OrderUpdateVars>({
    mutationFn: (vars, action) => updatePurchaseOrder({ ...vars, ...action }),
    invalidateKeys: [...STOCK_KEYS],
    ...options,
  });
}

/** Cancel an Ordered purchase order with why. */
export function useCancelPurchaseOrder(
  options: CrudMutationOptions<void, FlowReasonVars<PurchaseCancelReason>> = {},
) {
  return useAppMutation<void, FlowReasonVars<PurchaseCancelReason>>({
    mutationFn: ({ id, reason, note }) => cancelPurchaseOrder(id, reason, note),
    invalidateKeys: [...STOCK_KEYS],
    ...options,
  });
}

/** Put a cancelled order back to Ordered — the Undo of "PO #430 cancelled" (10s, D32); silent. */
export function useRestorePurchaseOrder(
  options: CrudMutationOptions<PurchaseOrderRow, string> = {},
) {
  return useAppMutation<PurchaseOrderRow, string>({
    mutationFn: (id, action) => restorePurchaseOrder(id, action.idempotencyKey),
    invalidateKeys: [...STOCK_KEYS],
    ...options,
  });
}

/** Receive goods: stock in, and the order becomes a bill to pay. */
export function useReceivePurchaseOrder(
  options: CrudMutationOptions<PurchaseOrderRow, ReceiveVars> = {},
) {
  return useAppMutation<PurchaseOrderRow, ReceiveVars>({
    mutationFn: (vars, action) => receivePurchaseOrder({ ...vars, ...action }),
    invalidateKeys: [...BILL_KEYS],
    ...options,
  });
}

// ── Sales ──

/** New sale — the server draws the batches and prices the lines; "Paid now" is a receipt. */
export function useCreateSale(options: CrudMutationOptions<SaleRow, SaleInput> = {}) {
  return useAppMutation<SaleRow, SaleInput>({
    mutationFn: (input, action) => createSale({ input, ...action }),
    invalidateKeys: [...SALE_KEYS],
    ...options,
  });
}

/** Collect: the sale's whole due as one receipt on the ledger. */
export function useCollectSale(
  options: CrudMutationOptions<LedgerRow, CollectVars> = {},
) {
  return useAppMutation<LedgerRow, CollectVars>({
    mutationFn: (vars, action) => collectSale({ ...vars, ...action }),
    invalidateKeys: [...SALE_KEYS],
    ...options,
  });
}

/** Return from patient — refund or store credit. */
export function useReturnSale(
  options: CrudMutationOptions<SaleRow, SaleReturnVars> = {},
) {
  return useAppMutation<SaleRow, SaleReturnVars>({
    mutationFn: ({ saleId, input }, action) =>
      returnSale({ id: saleId, input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [...SALE_KEYS],
    ...options,
  });
}

/** Void a sale with why. */
export function useVoidSale(
  options: CrudMutationOptions<void, FlowReasonVars<SaleVoidReason>> = {},
) {
  return useAppMutation<void, FlowReasonVars<SaleVoidReason>>({
    mutationFn: ({ id, reason, note }) => voidSale(id, reason, note),
    invalidateKeys: [...SALE_KEYS],
    ...options,
  });
}

/** Bring a voided sale back — its invoice and stock too — the Undo of "Sale #978 voided" (10s, D32); silent. */
export function useRestoreSale(options: CrudMutationOptions<SaleRow, string> = {}) {
  return useAppMutation<SaleRow, string>({
    mutationFn: (id, action) => restoreSale(id, action.idempotencyKey),
    invalidateKeys: [...SALE_KEYS],
    ...options,
  });
}

// ── Stock back to a supplier ──

/** Return expiring stock: the batch drops, the supplier owes it back. */
export function useReturnExpiringStock(
  options: CrudMutationOptions<SupplierCreditRow, ExpiringReturnInput> = {},
) {
  return useAppMutation<SupplierCreditRow, ExpiringReturnInput>({
    mutationFn: (input, action) => createSupplierCredit({ input, ...action }),
    invalidateKeys: [...CREDIT_KEYS],
    ...options,
  });
}

/** Void a supplier credit with why (MD32): its packs back, the supplier's dues up. */
export function useVoidSupplierCredit(
  options: CrudMutationOptions<
    void,
    SupplierCreditRef & { reason: SupplierCreditVoidReason; note: string | null }
  > = {},
) {
  return useAppMutation<
    void,
    SupplierCreditRef & { reason: SupplierCreditVoidReason; note: string | null }
  >({
    mutationFn: (vars) => voidSupplierCredit(vars),
    invalidateKeys: [...CREDIT_KEYS],
    ...options,
  });
}

/** Undo a supplier credit's void — the toast's Undo; silent. */
export function useRestoreSupplierCredit(
  options: CrudMutationOptions<SupplierCreditRow, SupplierCreditRef> = {},
) {
  return useAppMutation<SupplierCreditRow, SupplierCreditRef>({
    mutationFn: (vars, action) => restoreSupplierCredit({ ...vars, ...action }),
    invalidateKeys: [...CREDIT_KEYS],
    ...options,
  });
}

// ── Prescriptions to fill ──

/** The approved prescriptions no sale has filled yet; idle until asked for. */
export function usePrescriptionsToFill(enabled = true) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicalQueryKeys.prescriptionsToFill(organizationId),
    queryFn: listPrescriptionsToFill,
    enabled: enabled && organizationId !== null,
    notifyOnError: false,
  });
}
