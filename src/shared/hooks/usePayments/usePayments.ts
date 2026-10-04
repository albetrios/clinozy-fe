import type { QueryKey } from '@tanstack/react-query';

import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import { commandSearchQueryKeys } from '@/shared/api/clinic/command-search-api.ts';
import { creditQueryKeys } from '@/shared/api/clinic/credits-api.ts';
import { dayCloseQueryKeys } from '@/shared/api/clinic/day-close-api.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import {
  deletePayment,
  fetchPayment,
  listLedger,
  listOpenInvoices,
  listOpenSupplierBills,
  listPatientInvoices,
  payExpense,
  paymentQueryKeys,
  receivePayment,
  restorePayment,
  updatePayment,
} from '@/shared/api/clinic/payments-api.ts';
import type {
  LedgerListParams,
  LedgerRow,
  PayExpenseInput,
  PaymentPatch,
  PaymentRecord,
  ReceivePaymentInput,
} from '@/shared/api/clinic/payments-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';

/**
 * What a money write refreshes (KICKOFF §6.9 Data): the ledger, the credits,
 * every patient read (their dues), ⌘K's invoice results — an entry moves an
 * invoice's balance — and Day close (its entries, totals and locks). Invoice
 * reads join as their rows land.
 */
export const MONEY_WRITE_KEYS: readonly QueryKey[] = [
  paymentQueryKeys.all,
  creditQueryKeys.all,
  patientQueryKeys.all,
  commandSearchQueryKeys.all,
  dayCloseQueryKeys.all,
];

// ── Reads ──

/**
 * The Payments ledger, a cursor page of 50 at a time (D7, `S:1699`) — the
 * room's infinite scroll. The params come from the URL; while new ones load,
 * the previous rows stay on screen (`isRefreshing`). A failed read raises no
 * toast here: the room keeps the last copy and offers Retry (§6.0 List error).
 */
export function useLedgerList(params: LedgerListParams, enabled = true) {
  return useCursorList<LedgerRow>({
    queryKey: paymentQueryKeys.list(params),
    queryFn: async (after) => {
      const page = await listLedger(params, after ?? null);
      return {
        rows: page.items,
        next: page.nextCursor,
        hasMore: page.nextCursor !== null,
      };
    },
    enabled,
    notifyOnError: false,
  });
}

/** One ledger entry by id; idle while there is no id. A deleted or unknown id fails with a 404. */
export function usePayment(id: string | undefined) {
  return useAppQuery({
    queryKey: paymentQueryKeys.detail(id ?? ''),
    queryFn: () => fetchPayment(id ?? ''),
    enabled: Boolean(id),
  });
}

/** A patient's invoices with a due, oldest first — idle without a patient (`S:1702`). */
export function useOpenInvoices(patientId: string | null) {
  return useAppQuery({
    queryKey: paymentQueryKeys.openInvoices(patientId ?? ''),
    queryFn: () => listOpenInvoices(patientId ?? ''),
    enabled: patientId !== null,
  });
}

/** Every invoice of a patient, newest first — idle without a patient (Add pending's "For invoice"). */
export function usePatientInvoices(patientId: string | null) {
  return useAppQuery({
    queryKey: paymentQueryKeys.patientInvoices(patientId ?? ''),
    queryFn: () => listPatientInvoices(patientId ?? ''),
    enabled: patientId !== null,
  });
}

/** The supplier bills with a balance, oldest first (`S:1701`) — Send payment's first step. */
export function useOpenSupplierBills(enabled = true) {
  return useAppQuery({
    queryKey: paymentQueryKeys.openBills(),
    queryFn: listOpenSupplierBills,
    enabled,
  });
}

// ── Writes ──

/**
 * Receive payment — not optimistic (the drawer shows "Saving…"). No toast of
 * its own: the drawer says "₹8,550 received from Kiran Desai".
 */
export function useReceivePayment(
  options: CrudMutationOptions<LedgerRow, ReceivePaymentInput> = {},
) {
  return useAppMutation<LedgerRow, ReceivePaymentInput>({
    mutationFn: receivePayment,
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/**
 * Send payment — not optimistic. No toast of its own: the drawer says "Expense
 * PAY-5601 added" or "₹2,980 paid against Medical PO #431".
 */
export function usePayExpense(
  options: CrudMutationOptions<LedgerRow, PayExpenseInput> = {},
) {
  return useAppMutation<LedgerRow, PayExpenseInput>({
    mutationFn: payExpense,
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/** What an entry change sends. */
export interface PaymentUpdateVars {
  id: string;
  patch: PaymentPatch;
}

/** Save an open-day entry — not optimistic; the drawer says "PAY-5512 updated · change logged". */
export function useUpdatePayment(
  options: CrudMutationOptions<LedgerRow, PaymentUpdateVars> = {},
) {
  return useAppMutation<LedgerRow, PaymentUpdateVars>({
    mutationFn: ({ id, patch }) => updatePayment(id, patch),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/** What a confirmed entry delete sends: the entry and the Reason confirm's choice. */
export interface PaymentDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete an open-day entry (`S:1546`) — optimistic: the row leaves every cached
 * ledger page at once and comes back if the write fails. No toast of its own:
 * the Reason confirm's `reason.undo` shows "PAY-310 removed" with Undo, which
 * runs {@link useRestorePayment}.
 */
export function useDeletePayment(
  options: CrudMutationOptions<PaymentRecord, PaymentDeleteVars> = {},
) {
  return useAppMutation<PaymentRecord, PaymentDeleteVars, unknown, LedgerRow>({
    mutationFn: ({ id, reason, note }) => deletePayment(id, reason, note),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    optimisticInfinite: {
      queryKey: paymentQueryKeys.lists(),
      update: (rows, { id }) => rows.filter((row) => row.id !== id),
    },
    ...options,
  });
}

/** Put a deleted entry back — the Undo of its "removed" toast (10s, D32); silent on success. */
export function useRestorePayment(
  options: CrudMutationOptions<PaymentRecord, string> = {},
) {
  return useAppMutation<PaymentRecord, string>({
    mutationFn: restorePayment,
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}
