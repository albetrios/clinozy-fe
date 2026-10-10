import type { QueryKey } from '@tanstack/react-query';

import { appointmentQueryKeys } from '@/shared/api/clinic/appointments-api.ts';
import type { DeleteReason } from '@/shared/api/clinic/clinic-schema.ts';
import {
  addMedicalContact,
  createInvoice,
  createSale,
  deleteInvoice,
  fetchInvoice,
  fetchInvoicePresets,
  fetchOftenBilled,
  fetchPrescriptionPreset,
  invoiceQueryKeys,
  restoreInvoice,
  setMedicalContactPhone,
  updateInvoice,
} from '@/shared/api/clinic/invoices-api.ts';
import type {
  InvoiceInput,
  InvoiceRecord,
  InvoiceSaveResult,
  OftenBilledKind,
  SaleContact,
} from '@/shared/api/clinic/invoices-contracts.ts';
import { fixturePlanQueryKeys as planQueryKeys } from '@/shared/api/clinic/plan-fixture-api.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { MEDICINE_WRITE_KEYS } from '@/shared/hooks/useMedicines/index.ts';
import { MONEY_WRITE_KEYS } from '@/shared/hooks/usePayments/index.ts';

/**
 * What an invoice write refreshes (KICKOFF §6.9 Save): every money read (the
 * ledger, credits, the invoices, the patients' dues and file — packages and
 * prescriptions sit under it — Day close and ⌘K), the plans whose rows it
 * invoiced, the appointments' plan flags and Today's floor, the tasks (a
 * balance opens "Payment due") and, for a sale, the medicines' stock and the
 * Medical room.
 */
export const INVOICE_WRITE_KEYS: readonly QueryKey[] = [
  ...MONEY_WRITE_KEYS,
  planQueryKeys.all,
  appointmentQueryKeys.all,
  taskQueryKeys.all,
  ...MEDICINE_WRITE_KEYS,
];

// ── Reads ──

/** One invoice with who it bills, its sale, its ledger entries and balance; idle without an id. */
export function useInvoice(id: string | undefined) {
  return useAppQuery({
    queryKey: invoiceQueryKeys.detail(id ?? ''),
    queryFn: () => fetchInvoice(id ?? ''),
    enabled: Boolean(id),
  });
}

/** Quick fill's reads for a patient — packages, last invoices, latest Rx; idle without one. */
export function useInvoicePresets(patientId: string | null) {
  return useAppQuery({
    queryKey: invoiceQueryKeys.presets(patientId ?? ''),
    queryFn: () => fetchInvoicePresets(patientId ?? ''),
    enabled: patientId !== null,
  });
}

/** A prescription a sale starts from (`?prescription=`); idle without one. */
export function usePrescriptionPreset(id: string | null) {
  return useAppQuery({
    queryKey: invoiceQueryKeys.prescription(id ?? ''),
    queryFn: () => fetchPrescriptionPreset(id ?? ''),
    enabled: id !== null,
  });
}

/** "Often billed" (H:5058): the five names invoiced most, medicines or offerings. */
export function useOftenBilled(kind: OftenBilledKind) {
  return useAppQuery({
    queryKey: invoiceQueryKeys.oftenBilled(kind),
    queryFn: () => fetchOftenBilled(kind),
    staleTime: 5 * 60_000,
  });
}

// ── Writes ──

/**
 * Create an invoice — a clinic or consultation one through `createInvoice`, a
 * Medical one through `createSale` (`S:1716`, `S:1666`). Not optimistic: the
 * drawer shows "Saving…" and raises its own toast ("Clinic invoice #788
 * created").
 */
export function useCreateInvoice(
  options: CrudMutationOptions<InvoiceSaveResult, InvoiceInput> = {},
) {
  return useAppMutation<InvoiceSaveResult, InvoiceInput>({
    mutationFn: (input) =>
      input.type === 'medical' ? createSale(input) : createInvoice(input),
    invalidateKeys: [...INVOICE_WRITE_KEYS],
    ...options,
  });
}

/** What an invoice change sends. */
export interface InvoiceUpdateVars {
  id: string;
  input: InvoiceInput;
}

/** Save a changed invoice — not optimistic; the drawer says "Invoice #787 saved". */
export function useUpdateInvoice(
  options: CrudMutationOptions<InvoiceSaveResult, InvoiceUpdateVars> = {},
) {
  return useAppMutation<InvoiceSaveResult, InvoiceUpdateVars>({
    mutationFn: ({ id, input }) => updateInvoice(id, input),
    invalidateKeys: [...INVOICE_WRITE_KEYS],
    ...options,
  });
}

/** What a confirmed invoice delete sends: the invoice and the Reason confirm's choice. */
export interface InvoiceDeleteVars {
  id: string;
  reason: DeleteReason;
  note: string | null;
}

/**
 * Delete an invoice (`S:1546`; the `void` ability, Q-U8). No toast of its
 * own: the Reason confirm's Undo toast names it and runs
 * {@link useRestoreInvoice}.
 */
export function useDeleteInvoice(
  options: CrudMutationOptions<InvoiceRecord, InvoiceDeleteVars> = {},
) {
  return useAppMutation<InvoiceRecord, InvoiceDeleteVars>({
    mutationFn: ({ id, reason, note }) => deleteInvoice(id, reason, note),
    invalidateKeys: [...INVOICE_WRITE_KEYS],
    ...options,
  });
}

/** Bring a deleted invoice back — the Undo of its toast (10s, D32); silent on success. */
export function useRestoreInvoice(
  options: CrudMutationOptions<InvoiceRecord, string> = {},
) {
  return useAppMutation<InvoiceRecord, string>({
    mutationFn: restoreInvoice,
    invalidateKeys: [...INVOICE_WRITE_KEYS],
    ...options,
  });
}

/**
 * "Add contact “q”" in a Medical sale's customer field — saved at once (the
 * drawer toasts "Viral Sheth saved as a Medical contact · add a mobile below").
 */
export function useAddMedicalContact(
  options: CrudMutationOptions<SaleContact, string> = {},
) {
  return useAppMutation<SaleContact, string>({
    mutationFn: addMedicalContact,
    invalidateKeys: [invoiceQueryKeys.customers()],
    ...options,
  });
}

/** What a new contact's mobile sends. */
export interface MedicalContactPhoneVars {
  id: string;
  phone: string | null;
}

/** The Mobile field under a new Medical contact — "saved on the contact". */
export function useSetMedicalContactPhone(
  options: CrudMutationOptions<SaleContact, MedicalContactPhoneVars> = {},
) {
  return useAppMutation<SaleContact, MedicalContactPhoneVars>({
    mutationFn: ({ id, phone }) => setMedicalContactPhone(id, phone),
    invalidateKeys: [invoiceQueryKeys.customers()],
    ...options,
  });
}
