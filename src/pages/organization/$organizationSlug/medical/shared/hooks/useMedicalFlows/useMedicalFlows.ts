import type { QueryKey } from '@tanstack/react-query';

import type {
  DeleteReason,
  MedicalPurchaseOrder,
  MedicalSale,
} from '@/shared/api/clinic/clinic-schema.ts';
import { paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';
import type { PaymentRecord } from '@/shared/api/clinic/payments-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { MEDICINE_WRITE_KEYS } from '@/shared/hooks/useMedicines/index.ts';
import { MONEY_WRITE_KEYS } from '@/shared/hooks/usePayments/index.ts';

import { medicalQueryKeys } from '../../medical-api.ts';
import {
  cancelPurchaseOrder,
  collectSale,
  createPurchaseOrder,
  listPrescriptionsToFill,
  receivePurchaseOrder,
  restorePurchaseOrder,
  restoreSale,
  returnExpiringStock,
  returnSale,
  updatePurchaseOrder,
  voidSale,
} from '../../medical-flows-api.ts';
import type {
  ExpiringReturnInput,
  ExpiringReturnResult,
  PurchaseOrderInput,
  ReceiveInput,
  SaleReturnInput,
  SaleReturnResult,
} from '../../medical-flows-contracts.ts';

/*
 * The Medical flows' writes for the drawers and row actions (KICKOFF §6.7):
 * every one refreshes the room and the medicines it moves; a receipt adds
 * Send payment's open bills, and the sale's money writes refresh the ledger,
 * its patients and Day close (Q-M1).
 */

/** A record's save: the record and its fields. */
export interface FlowUpdateVars<TInput> {
  id: string;
  input: TInput;
}

/** A sale's return: the sale and what comes back. */
export interface SaleReturnVars {
  saleId: string;
  input: SaleReturnInput;
}

/** A cancel or a void: the record and the reason confirm's choice. */
export interface FlowReasonVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/** What a stock write refreshes: the room and its medicines. */
const STOCK_KEYS: readonly QueryKey[] = MEDICINE_WRITE_KEYS;

/** A receipt makes a bill Send payment can settle. */
const BILL_KEYS: readonly QueryKey[] = [
  ...MEDICINE_WRITE_KEYS,
  paymentQueryKeys.openBills(),
];

/** A sale's money and stock: the ledger and its readers, the room and its medicines. */
const SALE_KEYS: readonly QueryKey[] = [...MEDICINE_WRITE_KEYS, ...MONEY_WRITE_KEYS];

/** One write of the room, refreshing what it joins. */
function useFlowWrite<TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options: CrudMutationOptions<TData, TVars>,
  keys: readonly QueryKey[],
) {
  return useAppMutation<TData, TVars>({
    mutationFn,
    invalidateKeys: [...keys],
    ...options,
  });
}

// ── Purchase orders ──

/** New purchase order (`S:1670`). */
export function useCreatePurchaseOrder(
  options: CrudMutationOptions<MedicalPurchaseOrder, PurchaseOrderInput> = {},
) {
  return useFlowWrite(createPurchaseOrder, options, STOCK_KEYS);
}

/** Save an Ordered purchase order (`S:1671`). */
export function useUpdatePurchaseOrder(
  options: CrudMutationOptions<
    MedicalPurchaseOrder,
    FlowUpdateVars<PurchaseOrderInput>
  > = {},
) {
  return useFlowWrite(
    ({ id, input }: FlowUpdateVars<PurchaseOrderInput>) => updatePurchaseOrder(id, input),
    options,
    STOCK_KEYS,
  );
}

/** Cancel an Ordered purchase order (`S:1673`). */
export function useCancelPurchaseOrder(
  options: CrudMutationOptions<MedicalPurchaseOrder, FlowReasonVars> = {},
) {
  return useFlowWrite(
    ({ id, reason }: FlowReasonVars) => cancelPurchaseOrder(id, reason),
    options,
    STOCK_KEYS,
  );
}

/** Put a cancelled order back to Ordered — the Undo of "PO #430 cancelled" (10s, D32); silent. */
export function useRestorePurchaseOrder(
  options: CrudMutationOptions<MedicalPurchaseOrder, string> = {},
) {
  return useFlowWrite(restorePurchaseOrder, options, STOCK_KEYS);
}

/** Receive goods (`S:1672`): stock in, and the order becomes a bill to pay. */
export function useReceivePurchaseOrder(
  options: CrudMutationOptions<MedicalPurchaseOrder, FlowUpdateVars<ReceiveInput>> = {},
) {
  return useFlowWrite(
    ({ id, input }: FlowUpdateVars<ReceiveInput>) => receivePurchaseOrder(id, input),
    options,
    BILL_KEYS,
  );
}

// ── Sales ──

/** Collect: the sale's full due as one receipt on the ledger. */
export function useCollectSale(options: CrudMutationOptions<PaymentRecord, string> = {}) {
  return useFlowWrite((saleId: string) => collectSale(saleId), options, SALE_KEYS);
}

/** Return from patient (`S:1667`). */
export function useReturnSale(
  options: CrudMutationOptions<SaleReturnResult, SaleReturnVars> = {},
) {
  return useFlowWrite(
    ({ saleId, input }: SaleReturnVars) => returnSale(saleId, input),
    options,
    SALE_KEYS,
  );
}

/** Void a sale (`S:1668`; Q-M2). */
export function useVoidSale(
  options: CrudMutationOptions<MedicalSale, FlowReasonVars> = {},
) {
  return useFlowWrite(
    ({ id, reason, note }: FlowReasonVars) => voidSale(id, reason, note),
    options,
    SALE_KEYS,
  );
}

/** Bring a voided sale back — its invoice and stock too — the Undo of "Sale #978 voided" (10s, D32); silent. */
export function useRestoreSale(options: CrudMutationOptions<MedicalSale, string> = {}) {
  return useFlowWrite(restoreSale, options, SALE_KEYS);
}

// ── Stock back to a supplier ──

/** Return expiring stock (Appendix F): the batch drops, the supplier's payable too. */
export function useReturnExpiringStock(
  options: CrudMutationOptions<ExpiringReturnResult, ExpiringReturnInput> = {},
) {
  return useFlowWrite(returnExpiringStock, options, STOCK_KEYS);
}

// ── Prescriptions to fill ──

/** The prescriptions no sale has filled yet (`S:1658`); idle until asked for. */
export function usePrescriptionsToFill(enabled = true) {
  return useAppQuery({
    queryKey: [...medicalQueryKeys.all, 'prescriptions-to-fill'],
    queryFn: listPrescriptionsToFill,
    enabled,
    notifyOnError: false,
  });
}
