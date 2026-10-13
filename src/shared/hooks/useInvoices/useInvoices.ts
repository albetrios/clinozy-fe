import { keepPreviousData, type QueryKey } from '@tanstack/react-query';

import type { DeleteReason } from '@/shared/api/app/app-schema.ts';
import { appointmentQueryKeys } from '@/shared/api/app/appointments-api.ts';
import {
  createInvoice,
  deleteInvoice,
  fetchInvoice,
  fetchInvoicePresets,
  fetchInvoiceTotals,
  invoiceQueryKeys,
  listInvoices,
  previewInvoice,
  previewInvoiceChange,
  restoreInvoice,
  updateInvoice,
} from '@/shared/api/app/invoices-api.ts';
import type {
  InvoiceInput,
  InvoiceListParams,
  InvoicePreview,
  InvoiceRecord,
  InvoiceSaveResult,
} from '@/shared/api/app/invoices-contracts.ts';
import {
  addMedicalContact,
  createSale,
  fetchOftenBilled,
  fetchPrescriptionPreset,
  fetchSalePresets,
  fixtureInvoiceQueryKeys,
  setMedicalContactPhone,
} from '@/shared/api/app/invoices-fixture-api.ts';
import type {
  InvoiceInput as SaleInput,
  InvoiceSaveResult as SaleSaveResult,
  OftenBilledKind,
  SaleContact,
} from '@/shared/api/app/invoices-fixture-contracts.ts';
import { taskQueryKeys } from '@/shared/api/app/tasks-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { FIXTURE_MONEY_WRITE_KEYS } from '@/shared/hooks/useFixtureLedger/index.ts';
import { MEDICINE_WRITE_KEYS } from '@/shared/hooks/useMedicines/index.ts';
import { MONEY_WRITE_KEYS } from '@/shared/hooks/usePayments/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

/**
 * What an invoice write refreshes (KICKOFF §6.9 Save): every money read (the ledger, credits,
 * the invoices, Day close, ⌘K, every patient read — the plan rows it billed, the packages it
 * sold, the file — and the person's activity), the appointments' plan flags and Today's floor,
 * and the tasks (a balance opens "Payment due").
 */
export const INVOICE_WRITE_KEYS: readonly QueryKey[] = [
  ...MONEY_WRITE_KEYS,
  appointmentQueryKeys.all,
  taskQueryKeys.all,
];

// ── Reads ──

/**
 * One invoice with who it bills, its ledger entries and the sheet's clinic and branch; idle
 * without an id.
 */
export function useInvoice(id: string | undefined) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: invoiceQueryKeys.detail(organizationId, id ?? ''),
    queryFn: () => fetchInvoice(id ?? ''),
    enabled: Boolean(id) && organizationId !== null,
  });
}

/**
 * A person's invoices, 50 a page, newest first (the patient file's Invoices) — the totals over
 * all of them read separately ({@link useInvoiceTotals}). A failed read raises no toast here.
 */
export function useInvoiceList(params: InvoiceListParams, enabled = true) {
  const organizationId = useOrganizationId();
  return useCursorList<InvoiceRecord>({
    queryKey: invoiceQueryKeys.list(organizationId, params),
    queryFn: async (after) => {
      const page = await listInvoices(params, after);
      return { rows: page.rows, next: page.next, hasMore: page.next !== null };
    },
    enabled: enabled && organizationId !== null,
    notifyOnError: false,
  });
}

/**
 * What a person still owes and has paid over all their invoices (`meta.due_total`,
 * `meta.paid_total`) — the rail's Due, the Billing card, the picked patient's dues; idle without
 * a person. A failed read (no `payment:read`) raises no toast.
 */
export function useInvoiceTotals(
  params: Pick<InvoiceListParams, 'patientId' | 'contactId'> | null,
) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: invoiceQueryKeys.totals(organizationId, params ?? {}),
    queryFn: () => fetchInvoiceTotals(params ?? {}),
    enabled: params !== null && organizationId !== null,
    notifyOnError: false,
  });
}

/**
 * Quick fill's reads for a patient — their packages with sessions left, their last clinic and
 * consultation invoices, the last team; idle without one.
 */
export function useInvoicePresets(patientId: string | null) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: invoiceQueryKeys.presets(organizationId, patientId ?? ''),
    queryFn: () => fetchInvoicePresets(patientId ?? ''),
    enabled: patientId !== null && organizationId !== null,
  });
}

/**
 * The server's lines and totals for what the drawer holds — a bill (`invoice` null) or a change
 * of `invoice` — nothing written (D81 Q2); idle while `input` is null (debounce it while typing).
 * While a new answer is on its way the last one stays (`isPlaceholderData`), so the totals never
 * blank between keystrokes. A refused preview (a line under its lowest price, a settled invoice)
 * raises no toast: the drawer reads the error.
 */
export function useInvoicePreview(
  input: InvoiceInput | null,
  invoice: InvoiceRecord | null = null,
) {
  const organizationId = useOrganizationId();
  return useAppQuery<InvoicePreview>({
    queryKey: invoiceQueryKeys.preview(organizationId, invoice?.id ?? null, input ?? {}),
    queryFn: () => {
      if (input === null) throw new Error('invoices: a preview needs a bill');
      return invoice ? previewInvoiceChange({ invoice, input }) : previewInvoice(input);
    },
    enabled: input !== null && organizationId !== null,
    placeholderData: keepPreviousData,
    notifyOnError: false,
  });
}

// ── Writes ──

/**
 * Bill a clinic or consultation invoice — not optimistic: the drawer shows "Saving…" and raises
 * its own toast ("Clinic invoice #788 created"). A Medical sale goes through
 * {@link useCreateSale}.
 */
export function useCreateInvoice(
  options: CrudMutationOptions<InvoiceSaveResult, InvoiceInput> = {},
) {
  return useAppMutation<InvoiceSaveResult, InvoiceInput>({
    mutationFn: (input, action) =>
      createInvoice({ input, idempotencyKey: action.idempotencyKey }),
    invalidateKeys: [...INVOICE_WRITE_KEYS],
    ...options,
  });
}

/** What an invoice change sends: the invoice as read and the drawer's invoice. */
export interface InvoiceUpdateVars {
  invoice: InvoiceRecord;
  input: InvoiceInput;
}

/**
 * Save a changed invoice — not optimistic; refused when someone saved it meanwhile (`409
 * record_changed`). The drawer says "Invoice #787 saved".
 */
export function useUpdateInvoice(
  options: CrudMutationOptions<InvoiceSaveResult, InvoiceUpdateVars> = {},
) {
  return useAppMutation<InvoiceSaveResult, InvoiceUpdateVars>({
    mutationFn: ({ invoice, input }, action) =>
      updateInvoice({ invoice, input, idempotencyKey: action.idempotencyKey }),
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
 * Delete an unpaid invoice (`payment:delete`). No toast of its own: the Reason confirm's Undo
 * toast names it and runs {@link useRestoreInvoice}.
 */
export function useDeleteInvoice(
  options: CrudMutationOptions<void, InvoiceDeleteVars> = {},
) {
  return useAppMutation<void, InvoiceDeleteVars>({
    mutationFn: ({ id, reason, note }) => deleteInvoice({ invoiceId: id, reason, note }),
    invalidateKeys: [...INVOICE_WRITE_KEYS],
    ...options,
  });
}

/** Bring a deleted invoice back — the Undo of its toast; silent on success. */
export function useRestoreInvoice(
  options: CrudMutationOptions<InvoiceRecord, string> = {},
) {
  return useAppMutation<InvoiceRecord, string>({
    mutationFn: (id, action) => restoreInvoice(id, action.idempotencyKey),
    invalidateKeys: [...INVOICE_WRITE_KEYS],
    ...options,
  });
}

// ── A Medical sale (the parked Medical room's, on the fixture world — D153 seam) ──

/**
 * What a fixture sale refreshes: the fixture money reads, the tasks, and the medicines' stock and
 * the Medical room.
 */
const SALE_WRITE_KEYS: readonly QueryKey[] = [
  ...FIXTURE_MONEY_WRITE_KEYS,
  fixtureInvoiceQueryKeys.all,
  taskQueryKeys.all,
  ...MEDICINE_WRITE_KEYS,
];

/** Quick fill's reads for a sale's patient — their latest prescription; idle without one. */
export function useSalePresets(patientId: string | null) {
  return useAppQuery({
    queryKey: fixtureInvoiceQueryKeys.presets(patientId ?? ''),
    queryFn: () => fetchSalePresets(patientId ?? ''),
    enabled: patientId !== null,
  });
}

/** A prescription a sale starts from (`?prescription=`); idle without one. */
export function usePrescriptionPreset(id: string | null) {
  return useAppQuery({
    queryKey: fixtureInvoiceQueryKeys.prescription(id ?? ''),
    queryFn: () => fetchPrescriptionPreset(id ?? ''),
    enabled: id !== null,
  });
}

/** "Often billed" (H:5058): the five names a sale bills most, medicines or offerings. */
export function useOftenBilled(kind: OftenBilledKind) {
  return useAppQuery({
    queryKey: fixtureInvoiceQueryKeys.oftenBilled(kind),
    queryFn: () => fetchOftenBilled(kind),
    staleTime: 5 * 60_000,
  });
}

/**
 * Create a Medical sale — its invoice, the stock drawn by earliest expiry, the receipt — not
 * optimistic; the drawer raises its own toast.
 */
export function useCreateSale(
  options: CrudMutationOptions<SaleSaveResult, SaleInput> = {},
) {
  return useAppMutation<SaleSaveResult, SaleInput>({
    mutationFn: createSale,
    invalidateKeys: [...SALE_WRITE_KEYS],
    ...options,
  });
}

/**
 * "Add contact “q”" in a Medical sale's customer field — saved at once (the drawer toasts "Viral
 * Sheth saved as a Medical contact · add a mobile below").
 */
export function useAddMedicalContact(
  options: CrudMutationOptions<SaleContact, string> = {},
) {
  return useAppMutation<SaleContact, string>({
    mutationFn: addMedicalContact,
    invalidateKeys: [fixtureInvoiceQueryKeys.customers()],
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
    invalidateKeys: [fixtureInvoiceQueryKeys.customers()],
    ...options,
  });
}
