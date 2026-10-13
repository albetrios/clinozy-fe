import { rupeesOfPaise } from '@/lib/number-text.ts';

import { displayId } from './app-display-id.ts';
import type { CursorPage } from './app-fixture-store.ts';
import { invoiceLineAmounts, invoiceTotals } from './app-money.ts';
import type { InvoiceDetail, InvoiceLine, InvoiceRecord } from './invoices-contracts.ts';
import type {
  InvoiceDetail as FixtureInvoiceDetail,
  InvoiceInput as SaleInput,
  InvoicePresets as SalePresets,
  InvoiceRxPreset,
  InvoiceSaveResult as SaleSaveResult,
  OftenBilledKind,
  SaleContact,
  SaleCustomerRow,
} from './invoices-fixture-contracts.ts';
import { fixtureLedgerRows } from './payments-fixture-api.ts';

/*
 * The parked Medical room's sales on the fixture invoices server (D153 seam): what the shared
 * Invoice drawer reads and writes in sale mode (`type: 'medical'`) — the customer field, a new
 * Medical contact and its mobile, a prescription to sell from, "Often billed", Quick fill's latest
 * prescription, the sale itself — and a sale's invoice for its print, in the live invoice's shape
 * (rupees) so the shared print draws it. Clinic and consultation invoices are clinozy-be's
 * (`invoices-api.ts`); this goes with the Medical room's move.
 */

const server = () => import('./fixtures/invoices-server.fixtures.ts');

/** TanStack Query keys for the fixture sales — all under `['app', 'fixture-invoices']`. */
export const fixtureInvoiceQueryKeys = {
  all: ['app', 'fixture-invoices'] as const,
  /** A sale's invoice, for its print. */
  sale: (invoiceId: string) =>
    [...fixtureInvoiceQueryKeys.all, 'sale', invoiceId] as const,
  /** Quick fill's reads for a sale's patient: their latest prescription. */
  presets: (patientId: string) =>
    [...fixtureInvoiceQueryKeys.all, 'presets', patientId] as const,
  /** A prescription a sale starts from. */
  prescription: (id: string) =>
    [...fixtureInvoiceQueryKeys.all, 'prescription', id] as const,
  /** "Often billed": medicines, or offerings. */
  oftenBilled: (kind: OftenBilledKind) =>
    [...fixtureInvoiceQueryKeys.all, 'often-billed', kind] as const,
  /** The Medical customer field's pages. */
  customers: () => [...fixtureInvoiceQueryKeys.all, 'customers'] as const,
};

/** A fixture invoice's lines as the live invoice's: each line's amounts, in rupees. */
function linesOf(invoice: FixtureInvoiceDetail['invoice']): InvoiceLine[] {
  return invoice.items.map((item, index) => {
    const amounts = invoiceLineAmounts(item);
    return {
      id: `${invoice.id}:${index + 1}`,
      lineNumber: index + 1,
      offeringId: item.offeringId,
      medicineId: item.medicineId,
      name: item.name,
      packSize: item.packSize,
      qty: item.qty,
      rate: rupeesOfPaise(item.rate),
      discountPct: item.discountPct,
      discountAmount: rupeesOfPaise(amounts.discount),
      gstPct: item.gstPct,
      isGstInclusive: false,
      taxableAmount: rupeesOfPaise(amounts.base - amounts.discount),
      gstAmount: rupeesOfPaise(amounts.gst),
      amount: rupeesOfPaise(amounts.net),
      suggestionId: null,
      patientOfferingId: null,
      treatmentIds: [],
      batchNo: item.batchNo,
    };
  });
}

/** A fixture invoice as the live invoice record: its figures from the fixture's money, in rupees. */
function invoiceOf(detail: FixtureInvoiceDetail): InvoiceRecord {
  const { invoice, party, balance } = detail;
  const totals = invoiceTotals(invoice);
  return {
    id: invoice.id,
    seq: invoice.seq,
    number: displayId.invoice(invoice.seq),
    financialYear: '',
    type: invoice.type,
    branchId: invoice.branchId,
    contactId: party?.id ?? null,
    contact: party ? { id: party.id, name: party.name, phone: party.phone ?? '' } : null,
    patientId: invoice.patientId,
    teamIds: invoice.teamIds,
    items: linesOf(invoice),
    overallDiscount: rupeesOfPaise(invoice.overallDiscount),
    subtotal: rupeesOfPaise(totals.subtotal),
    discountTotal: rupeesOfPaise(totals.lineDiscount + totals.overallDiscount),
    taxableTotal: rupeesOfPaise(totals.subtotal - totals.lineDiscount),
    gstTotal: rupeesOfPaise(totals.gst),
    total: rupeesOfPaise(balance.bill),
    paid: rupeesOfPaise(balance.paid),
    due: rupeesOfPaise(balance.due),
    status: balance.status,
    isSettled: false,
    date: invoice.date,
    remark: invoice.remark,
    prescriptionId: invoice.prescriptionId,
    createdById: invoice.createdById,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

/**
 * A Medical sale's invoice for its print — the fixture invoice in the live invoice's shape
 * (rupees), its ledger entries as live rows, the clinic and the branch, and the sale it belongs to.
 */
export async function fetchSaleInvoice(invoiceId: string): Promise<InvoiceDetail> {
  const detail = await (await server()).getInvoice(invoiceId);
  const invoice = invoiceOf(detail);
  const { organization, branch } = detail.sheet;
  return {
    invoice,
    party: invoice.contact
      ? {
          contactId: invoice.contact.id,
          patientId: invoice.patientId,
          name: invoice.contact.name,
          phone: invoice.contact.phone,
        }
      : null,
    sale: detail.sale,
    payments: await fixtureLedgerRows(
      detail.payments.map((payment) => ({
        ...payment,
        reference: null,
        edits: [],
        attachmentKeys: [],
      })),
    ),
    sheet: {
      organization: {
        name: organization.name,
        specialties: organization.specialties,
        currency: organization.currency,
      },
      branch: {
        id: invoice.branchId,
        name: '',
        phone: branch.phone,
        gstNumber: branch.gstNumber,
        address: {
          lineOne: '',
          lineTwo: null,
          area: '',
          city: '',
          state: '',
          postalCode: '',
        },
      },
    },
  };
}

/** Quick fill's reads for a sale's patient (H:5066) — their latest prescription among them. */
export async function fetchSalePresets(patientId: string): Promise<SalePresets> {
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

/** A Medical sale: its invoice, the stock drawn by earliest expiry, the receipt. */
export async function createSale(input: SaleInput): Promise<SaleSaveResult> {
  return (await server()).createSale(input);
}
