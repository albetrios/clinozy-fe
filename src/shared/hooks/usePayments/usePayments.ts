import type { QueryKey } from '@tanstack/react-query';

import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import { commandSearchQueryKeys } from '@/shared/api/clinic/command-search-api.ts';
import { contactActivityQueryKeys } from '@/shared/api/clinic/contact-activities-api.ts';
import { creditQueryKeys } from '@/shared/api/clinic/credits-api.ts';
import { dayCloseQueryKeys } from '@/shared/api/clinic/day-close-api.ts';
import {
  fetchAllInvoices,
  invoiceQueryKeys,
  listOpenInvoices,
} from '@/shared/api/clinic/invoices-api.ts';
import type { InvoiceRecord } from '@/shared/api/clinic/invoices-contracts.ts';
import { MEDICAL_ROOM_QUERY_KEY } from '@/shared/api/clinic/medicines-api.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import {
  deletePayment,
  fetchLedgerCount,
  fetchPayment,
  listLedger,
  listOpenSupplierBills,
  listPatientPayments,
  listPaymentEdits,
  payExpense,
  paymentQueryKeys,
  receivePayment,
  restorePayment,
  reversePayment,
  updatePayment,
} from '@/shared/api/clinic/payments-api.ts';
import type {
  LedgerListParams,
  LedgerRow,
  PayExpenseInput,
  PaymentPatch,
  ReceivePaymentInput,
} from '@/shared/api/clinic/payments-contracts.ts';
import { STOCK_ROOM_QUERY_KEY } from '@/shared/api/clinic/stock-room-query-key.ts';
import { VISIT_WRITE_KEYS } from '@/shared/api/clinic/visits-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

/** The active organization — every key carries it. */
const useOrganizationId = () => useOrganizationStore((state) => state.organizationId);

/**
 * The money reads beside the ledger (KICKOFF §6.9 Data): the credits, the invoices (an entry
 * moves an invoice's due), Day close, every patient read (the plan, packages, file and treatments
 * sit under it), the person's activity (every money write adds a system entry), ⌘K, and the rooms
 * whose rows carry money (Q-M1) — Medical's and Clinic stock's.
 */
const MONEY_READ_KEYS: readonly QueryKey[] = [
  creditQueryKeys.all,
  invoiceQueryKeys.all,
  dayCloseQueryKeys.all,
  patientQueryKeys.all,
  contactActivityQueryKeys.all,
  commandSearchQueryKeys.all,
  MEDICAL_ROOM_QUERY_KEY,
  STOCK_ROOM_QUERY_KEY,
];

/** What a money write refreshes: every ledger read and the money reads beside it. */
export const MONEY_WRITE_KEYS: readonly QueryKey[] = [
  paymentQueryKeys.all,
  ...MONEY_READ_KEYS,
];

/**
 * What an entry's delete refreshes: every read of one organization but the entries' own — the
 * deleted entry's read would only answer 404 while its drawer closes.
 */
const moneyListKeys = (organizationId: string | null): QueryKey[] => [
  paymentQueryKeys.lists(organizationId),
  paymentQueryKeys.patientPaymentLists(organizationId),
  paymentQueryKeys.openBills(),
  ...MONEY_READ_KEYS,
];

// ── Reads ──

/**
 * The Payments ledger, 50 rows a page (`GET /app/payments`, each row with its author) — the
 * room's infinite scroll, for the URL's params; while new ones load the previous rows stay on
 * screen (`isRefreshing`). A failed read raises no toast here: the room keeps the last copy and
 * offers Retry (§6.0 List error).
 */
export function useLedgerList(params: LedgerListParams, enabled = true) {
  const organizationId = useOrganizationId();
  return useCursorList<LedgerRow>({
    queryKey: paymentQueryKeys.list(organizationId, params),
    queryFn: async (after) => {
      const page = await listLedger(params, after);
      return { rows: page.rows, next: page.next, hasMore: page.next !== null };
    },
    enabled: enabled && organizationId !== null,
    notifyOnError: false,
  });
}

/**
 * How many entries the ledger's params match — the API's count (`estimated_total`), the footer's
 * "13 entries"; null until it answers. A failed read raises no toast: the footer goes without.
 */
export function useLedgerCount(params: LedgerListParams, enabled = true) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: paymentQueryKeys.count(organizationId, params),
    queryFn: () => fetchLedgerCount(params),
    enabled: enabled && organizationId !== null,
    notifyOnError: false,
  });
}

/** One ledger entry by id; idle while there is no id. A deleted or unknown id fails with a 404. */
export function usePayment(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: paymentQueryKeys.detail(organizationId, id ?? ''),
    queryFn: () => fetchPayment(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
  });
}

/** An entry's changes, oldest first — the edit drawer's log; idle without an id. */
export function usePaymentEdits(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: paymentQueryKeys.edits(organizationId, id ?? ''),
    queryFn: () => listPaymentEdits(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
  });
}

/** A patient's invoices with a due, oldest first — idle without a patient (Receive's chips). */
export function useOpenInvoices(patientId: string | null) {
  const organizationId = useOrganizationId();
  return useAppQuery<InvoiceRecord[]>({
    queryKey: invoiceQueryKeys.every(organizationId, {
      patientId: patientId ?? '',
      status: ['unpaid', 'partial'],
      oldestFirst: true,
    }),
    queryFn: () => listOpenInvoices(patientId ?? ''),
    enabled: patientId !== null && organizationId !== null,
  });
}

/**
 * Every invoice of a person by their contact, newest first — idle without one (Add pending's
 * "For invoice" for a contact who is no patient).
 */
export function useContactInvoices(contactId: string | null) {
  const organizationId = useOrganizationId();
  return useAppQuery<InvoiceRecord[]>({
    queryKey: invoiceQueryKeys.every(organizationId, { contactId: contactId ?? '' }),
    queryFn: () => fetchAllInvoices({ contactId: contactId ?? '' }),
    enabled: contactId !== null && organizationId !== null,
  });
}

/**
 * A patient's entries — their receipts, refunds and the rest — newest first: the file's Payments.
 * A failed read raises no toast: the section says so in place, with Retry.
 */
export function usePatientPayments(patientId: string) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: paymentQueryKeys.patientPayments(organizationId, patientId),
    queryFn: () => listPatientPayments(patientId),
    enabled: patientId !== '' && organizationId !== null,
    notifyOnError: false,
  });
}

/**
 * The supplier bills with a balance, oldest first — Send payment's first step: Clinic stock's for
 * a member holding `stock_item:read`, Medical's for `medicine:read` (none for a Counsellor, who
 * sends expenses only).
 */
export function useOpenSupplierBills(enabled = true) {
  const organizationId = useOrganizationId();
  const access = useClinicAccess();
  const readable = {
    stock: access.canCode('stock_item:read'),
    medical: access.canCode('medicine:read'),
  };
  return useAppQuery({
    queryKey: [...paymentQueryKeys.openBillsOf(organizationId), readable],
    queryFn: () => listOpenSupplierBills(readable),
    enabled: enabled && access.isResolved && organizationId !== null,
  });
}

// ── Writes ──

/**
 * Receive payment — not optimistic (the drawer shows "Saving…"). No toast of its own: the drawer
 * says "₹8,550 received from Kiran Desai". A Checkout receipt may move the patient's open visit.
 */
export function useReceivePayment(
  options: CrudMutationOptions<LedgerRow, ReceivePaymentInput> = {},
) {
  return useAppMutation<LedgerRow, ReceivePaymentInput>({
    mutationFn: (input, action) =>
      receivePayment({ input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [...MONEY_WRITE_KEYS, ...VISIT_WRITE_KEYS],
    ...options,
  });
}

/**
 * Send payment — not optimistic. No toast of its own: the drawer says "Expense PAY-5601 added" or
 * "₹2,980 paid against Medical PO #431".
 */
export function usePayExpense(
  options: CrudMutationOptions<LedgerRow, PayExpenseInput> = {},
) {
  return useAppMutation<LedgerRow, PayExpenseInput>({
    mutationFn: (input, action) =>
      payExpense({ input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/** What an entry change sends: the entry as read and the drawer's changes. */
export interface PaymentUpdateVars {
  record: LedgerRow;
  patch: PaymentPatch;
}

/**
 * Save an open-day entry — not optimistic; refused when someone saved it meanwhile (`409
 * record_changed`) or its day closed. The drawer says "PAY-5512 updated · change logged".
 */
export function useUpdatePayment(
  options: CrudMutationOptions<LedgerRow, PaymentUpdateVars> = {},
) {
  return useAppMutation<LedgerRow, PaymentUpdateVars>({
    mutationFn: ({ record, patch }, action) =>
      updatePayment({ record, patch, idempotencyKey: action.idempotencyKey }),
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
 * Delete an open-day entry — optimistic: the row leaves every cached ledger page at once and
 * comes back if the write fails. The lists refresh, not the entry's own read. No toast of its
 * own: the Reason confirm's `reason.undo` shows "PAY-310 removed" with Undo, which runs
 * {@link useRestorePayment}.
 */
export function useDeletePayment(
  options: CrudMutationOptions<void, PaymentDeleteVars> = {},
) {
  const organizationId = useOrganizationId();
  return useAppMutation<void, PaymentDeleteVars, unknown, LedgerRow>({
    mutationFn: ({ id, reason, note }) => deletePayment({ paymentId: id, reason, note }),
    invalidateKeys: moneyListKeys(organizationId),
    optimisticInfinite: {
      queryKey: paymentQueryKeys.lists(organizationId),
      update: (rows, { id }) => rows.filter((row) => row.id !== id),
    },
    ...options,
  });
}

/** Put a deleted entry back — the Undo of its "removed" toast; silent on success. */
export function useRestorePayment(options: CrudMutationOptions<LedgerRow, string> = {}) {
  return useAppMutation<LedgerRow, string>({
    mutationFn: (id, action) => restorePayment(id, action.idempotencyKey),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}

/** What a reversal sends: the settled entry, why, and the day it is recorded on (today when left out). */
export interface PaymentReverseVars {
  id: string;
  reason: string;
  paidAt?: string;
}

/**
 * Reverse a settled entry (`payment:delete`) — not optimistic; answers the `reversal` entry. No
 * toast of its own: the dialog says "PAY-5512 reversed · PAY-5601".
 */
export function useReversePayment(
  options: CrudMutationOptions<LedgerRow, PaymentReverseVars> = {},
) {
  return useAppMutation<LedgerRow, PaymentReverseVars>({
    mutationFn: ({ id, reason, paidAt }, action) =>
      reversePayment({
        paymentId: id,
        reason,
        paidAt,
        idempotencyKey: action.idempotencyKey,
      }),
    invalidateKeys: [...MONEY_WRITE_KEYS],
    ...options,
  });
}
