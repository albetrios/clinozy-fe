import { z } from 'zod';

import type { InvoiceBalance } from './clinic-money.ts';
import {
  type Branch,
  civilDateSchema,
  type Invoice,
  invoiceItemSchema,
  invoiceSchema,
  invoiceTypeSchema,
  type MedicalContact,
  type MedicalSale,
  type Organization,
  paiseSchema,
  type Payment,
  paymentSplitSchema,
} from './clinic-schema.ts';
import { PAYMENT_SPLIT_LIMIT } from './payments-contracts.ts';

/*
 * The invoices domain beyond the generated contract (KICKOFF §6.9 Invoice
 * drawer, D22): the plan-only fields the drawer writes — each a fixture field
 * until clinozy-be serves it (Appendix F, REPLACE_WITH_API) — what a client
 * sends to create or change an invoice or a Medical sale, and what the drawer,
 * its Quick fill and the preview read. Read by the shared Invoice drawer, the
 * `invoices/` routes, the patient file and Medical.
 */

// ── Limits (`S:602–636`) ──

/** At most fifty lines on an invoice (`S:610`). */
const INVOICE_ITEM_LIMIT = 50;
/** At most ten people on its "Team" / "Prescribed by" (`S:608`). */
const INVOICE_TEAM_LIMIT = 10;
/** The Remark — "Shown on the printed invoice" — 500 characters (`S:618`). */
export const INVOICE_REMARK_MAX = 500;
/** A line's quantity: the stepper's 1–999, the contract's range (`S:632`). */
export const INVOICE_QTY_MAX = 999;
/** A line's name (`S:630`). */
const INVOICE_LINE_NAME_MAX = 120;

// ── Records ──

/**
 * An invoice line as the plan stores it: the contract's `InvoiceItem`
 * (`S:624–636`) with a Disc % that keeps the precision a typed Final needs —
 * the contract's whole percent can't hold "₹10,000" on a ₹11,328 line
 * (Appendix F: a decimal discount).
 */
const invoiceItemRecordSchema = invoiceItemSchema.extend({
  discountPct: z.number().min(0).max(100),
});

/** One stored invoice line. */
type InvoiceItemRecord = z.infer<typeof invoiceItemRecordSchema>;

/**
 * An invoice as the plan stores it: the contract's, its lines per {@link invoiceItemRecordSchema}.
 * @public A contract shape the API wire-up parses with (REPLACE_WITH_API); until then only its type is read.
 */
export const invoiceRecordSchema = invoiceSchema.extend({
  items: z.array(invoiceItemRecordSchema),
});

/** A stored invoice. */
export type InvoiceRecord = z.infer<typeof invoiceRecordSchema>;

// ── Writes ──

/** "Pick a patient" — a clinic or consultation invoice is always a patient's (`payments.md:138`). */
const INVOICE_PATIENT_MESSAGE = 'Pick a patient';
/** "Pick a customer" — a Medical sale's buyer (`payments.md:138`). */
export const INVOICE_CUSTOMER_MESSAGE = 'Pick a customer';
/** "Add at least one item" (`payments.md:146`). */
const INVOICE_ITEMS_MESSAGE = 'Add at least one item';

/**
 * One line as the drawer sends it (`S:624–636`): an offering's (clinic,
 * consultation) or a medicine's (Medical) — or a free line with only a name —
 * its quantity 1–999, the rate in paise, the Disc % to the precision the Final
 * needs and the GST percent. The batch is the server's (earliest expiry).
 */
const invoiceLineInputSchema = invoiceItemRecordSchema.omit({ batchNo: true }).extend({
  name: z.string().trim().min(1, INVOICE_ITEMS_MESSAGE).max(INVOICE_LINE_NAME_MAX),
  packSize: z.string().trim().max(30).nullable(),
  qty: z.number().int().min(1).max(INVOICE_QTY_MAX),
  gstPct: z.number().min(0).max(100),
});

/** One line of an invoice write. */
export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;

/**
 * "Paid now": the drawer's Mode · Amount rows, each above zero, one per mode —
 * what the save records as one receipt against the invoice (Appendix F: the
 * contract's `createInvoice` takes no payment; `createSale` takes `mode` and
 * `paidNow`, `S:1666`).
 */
const paidNowSchema = z
  .array(paymentSplitSchema.extend({ amount: paiseSchema.positive() }))
  .max(PAYMENT_SPLIT_LIMIT);

/** Every field an invoice write sends — `createInvoice` / `updateInvoice` (`S:1716`). */
const invoiceFieldsSchema = z.object({
  type: invoiceTypeSchema,
  branchId: z.uuid(),
  /** The patient billed; a Medical sale may bill a Medical contact instead. */
  patientId: z.uuid().nullable(),
  medicalContactId: z.uuid().nullable(),
  /**
   * A lead picked as a Medical sale's customer: the server saves them as a
   * Medical contact (C24; AMBER, Appendix F). Never set otherwise.
   */
  leadId: z.uuid().nullable(),
  teamIds: z.array(z.uuid()).max(INVOICE_TEAM_LIMIT),
  items: z
    .array(invoiceLineInputSchema)
    .min(1, INVOICE_ITEMS_MESSAGE)
    .max(INVOICE_ITEM_LIMIT),
  /** Q-G7: the overall discount in paise — the drawer's percent of the subtotal after line discounts. */
  overallDiscount: paiseSchema,
  date: civilDateSchema,
  remark: z.string().trim().max(INVOICE_REMARK_MAX).nullable(),
  prescriptionId: z.uuid().nullable(),
  paidNow: paidNowSchema,
});

/**
 * An invoice write (`S:1716`, `S:1666`): a clinic or consultation invoice is a
 * patient's; a Medical one is a patient's, a Medical contact's or a lead's
 * (saved as a contact) — "Pick a patient" / "Pick a customer" otherwise —
 * and its lines are medicines.
 */
export const invoiceInputSchema = invoiceFieldsSchema.superRefine((input, ctx) => {
  const medical = input.type === 'medical';
  const buyer =
    input.patientId ?? (medical ? (input.medicalContactId ?? input.leadId) : null);
  if (!buyer) {
    ctx.addIssue({
      code: 'custom',
      path: ['patientId'],
      message: medical ? INVOICE_CUSTOMER_MESSAGE : INVOICE_PATIENT_MESSAGE,
    });
  }
  input.items.forEach((line, index) => {
    if (medical && !line.medicineId) {
      ctx.addIssue({
        code: 'custom',
        path: ['items', index, 'medicineId'],
        message: 'Pick a medicine',
      });
    }
  });
});

/** What the drawer sends to create or change an invoice, or to create a sale. */
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

/** A Medical contact the Customer picker adds ("Add contact “q”", `payments.md:138`). */
export const medicalContactInputSchema = z.object({
  name: z.string().trim().min(1, INVOICE_CUSTOMER_MESSAGE).max(120),
});

// ── Reads ──

/** Who an invoice bills, as the drawer, the preview and the print name them. */
export type InvoiceParty =
  | {
      kind: 'patient';
      id: string;
      seq: number;
      name: string;
      firstName: string;
      lastName: string | null;
      phone: string;
    }
  | { kind: 'contact'; id: string; name: string; phone: string | null };

/**
 * One invoice as the drawer and the preview read it (`getInvoice`, `S:1704`):
 * the record, who it bills, its sale, the ledger entries against it (receipts
 * less refunds give what is paid; the print reads them) and its balance.
 */
export interface InvoiceDetail {
  invoice: InvoiceRecord;
  party: InvoiceParty | null;
  sale: Pick<MedicalSale, 'id' | 'seq'> | null;
  payments: Payment[];
  balance: InvoiceBalance;
  /** What the A4 sheet prints beyond the invoice: the clinic, and its branch's phone and GSTIN. */
  sheet: {
    organization: Pick<Organization, 'name' | 'specialties' | 'currency'>;
    branch: Pick<Branch, 'phone' | 'gstNumber'>;
  };
}

/** What a save answers: the invoice as read back, and how many plan rows it invoiced. */
export interface InvoiceSaveResult {
  detail: InvoiceDetail;
  /** Offering suggestions the lines invoice ("· 2 offering suggestions items marked invoiced"). */
  planLinked: number;
}

/** A patient's earlier invoice the drawer offers to repeat ("⚡ Repeat #785"). */
export interface InvoiceRepeatSource {
  id: string;
  seq: number;
  type: Invoice['type'];
  items: InvoiceItemRecord[];
  teamIds: string[];
}

/** A package the patient holds ("⚡ Package · <offering>"). */
interface InvoicePackagePreset {
  offeringId: string;
}

/** The patient's latest prescription ("⚡ From Rx #500"): its medicines by name and quantity. */
export interface InvoiceRxPreset {
  id: string;
  seq: number;
  /** The patient it was written for — a sale from it bills them. */
  patientId: string;
  medicines: { medicineId: string | null; name: string; qty: number }[];
}

/**
 * What the drawer's Quick fill reads for a patient (KICKOFF §6.9 Quick fill,
 * H:5066) — the packages they hold, their last invoice of each type and their
 * latest prescription — and the team their last invoice named ("from Rhea’s
 * team"). REPLACE_WITH_API: the patient's packages, invoices and
 * prescriptions reads, composed here.
 */
export interface InvoicePresets {
  packages: InvoicePackagePreset[];
  lastByType: Partial<Record<Invoice['type'], InvoiceRepeatSource>>;
  latestRx: InvoiceRxPreset | null;
  recentTeamIds: string[];
}

/** "Often billed": the item names invoiced most, medicines apart from the rest (H:5058). */
export type OftenBilledKind = 'medical' | 'clinic';

/** One Medical customer the picker lists: a patient, a lead (not a patient yet) or a Medical contact. */
export type SaleCustomerRow =
  | { kind: 'patient'; id: string; seq: number; name: string; phone: string | null }
  | { kind: 'lead'; id: string; seq: number; name: string; phone: string | null }
  | { kind: 'contact'; id: string; name: string; phone: string | null };

/** A Medical contact as the customer field reads it back after "Add contact". */
export type SaleContact = Pick<MedicalContact, 'id' | 'name' | 'phone'>;
