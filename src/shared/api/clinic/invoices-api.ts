import type { CursorPage } from './clinic-fixture-store.ts';
import type { DeleteReason } from './clinic-schema.ts';
import type {
  InvoiceDetail,
  InvoiceInput,
  InvoicePresets,
  InvoiceRecord,
  InvoiceRxPreset,
  InvoiceSaveResult,
  OftenBilledKind,
  SaleContact,
  SaleCustomerRow,
} from './invoices-contracts.ts';

/*
 * The invoices' reads and writes (`getInvoice`, `createInvoice` /
 * `updateInvoice`, `S:1704, 1716`; `createSale`, `S:1666`) — the shared Invoice
 * drawer's, the preview's and the print's. REPLACE_WITH_API: every call runs
 * on the fixture server, loaded on demand so the seed data never lands in a
 * route chunk (D6).
 */

const server = () => import('./fixtures/invoices-server.fixtures.ts');

/** TanStack Query keys for invoices — all under `['clinic', 'invoices']`. */
export const invoiceQueryKeys = {
  all: ['clinic', 'invoices'] as const,
  detail: (id: string) => [...invoiceQueryKeys.all, 'detail', id] as const,
  /** Quick fill's reads for a patient: packages, last invoices, latest Rx. */
  presets: (patientId: string) =>
    [...invoiceQueryKeys.all, 'presets', patientId] as const,
  /** A prescription a sale starts from. */
  prescription: (id: string) => [...invoiceQueryKeys.all, 'prescription', id] as const,
  /** "Often billed": medicines, or offerings. */
  oftenBilled: (kind: OftenBilledKind) =>
    [...invoiceQueryKeys.all, 'often-billed', kind] as const,
  /** The Medical customer field's pages. */
  customers: () => [...invoiceQueryKeys.all, 'customers'] as const,
};

/** One invoice with who it bills, its sale, its ledger entries and balance (`S:1704`). */
export async function fetchInvoice(id: string): Promise<InvoiceDetail> {
  return (await server()).getInvoice(id);
}

/** Quick fill's reads for a patient (H:5066). */
export async function fetchInvoicePresets(patientId: string): Promise<InvoicePresets> {
  return (await server()).getInvoicePresets(patientId);
}

/** A prescription to sell from (`?prescription=`, `S:50`): its patient and medicines. */
export async function fetchPrescriptionPreset(id: string): Promise<InvoiceRxPreset> {
  return (await server()).getPrescriptionPreset(id);
}

/** "Often billed": the names invoiced most, most first (H:5058). */
export async function fetchOftenBilled(kind: OftenBilledKind): Promise<string[]> {
  return (await server()).getOftenBilled(kind);
}

/** One page of the Medical customer field: patients, leads, Medical contacts. */
export async function searchSaleCustomers(
  query: string,
  cursor: string | null = null,
): Promise<CursorPage<SaleCustomerRow>> {
  return (await server()).searchSaleCustomers(query, cursor);
}

/** "Add contact “q”": a Medical contact with the typed name. */
export async function addMedicalContact(name: string): Promise<SaleContact> {
  return (await server()).addMedicalContact({ name });
}

/** A new contact's mobile, saved on the contact. */
export async function setMedicalContactPhone(
  id: string,
  phone: string | null,
): Promise<SaleContact> {
  return (await server()).setMedicalContactPhone(id, phone);
}

/** Create a clinic or consultation invoice — a Medical one goes through {@link createSale}. */
export async function createInvoice(input: InvoiceInput): Promise<InvoiceSaveResult> {
  return (await server()).createInvoice(input);
}

/** Create a Medical sale: its invoice, the stock drawn by earliest expiry, the receipt. */
export async function createSale(input: InvoiceInput): Promise<InvoiceSaveResult> {
  return (await server()).createSale(input);
}

/** Change an invoice; a sale keeps its medicines. */
export async function updateInvoice(
  id: string,
  input: InvoiceInput,
): Promise<InvoiceSaveResult> {
  return (await server()).updateInvoice(id, input);
}

/** Delete an invoice with the confirm's reason (`S:1546`). */
export async function deleteInvoice(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<InvoiceRecord> {
  return (await server()).deleteInvoice(id, reason, note);
}

/** Bring a deleted invoice back — the Undo (D32). */
export async function restoreInvoice(id: string): Promise<InvoiceRecord> {
  return (await server()).restoreInvoice(id);
}
