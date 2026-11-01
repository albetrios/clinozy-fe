import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import type { operations } from '@/core/http/openapi-types.d.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { apiErrorReason } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import { readValidationEntries } from '@/shared/errors/map-validation-errors.ts';

import {
  civilDateSchema,
  type InvoiceType,
  invoiceTypeSchema,
  type OfferingSpecialty,
  offeringSpecialtySchema,
} from './app-schema.ts';
import type { LedgerRow, MoneySplit } from './payments-contracts.ts';

/*
 * Invoices on clinozy-be (`/app/invoices`, api-integration §5.8): a bill — clinic, consultation
 * or medical — its lines as the server prices them (the rate, the best live offer, the GST and
 * every amount are the server's, M26), its totals, what is paid and due, its payment status and
 * the day's lock. What the drawer sends to bill, change or preview (lines by offering, quantity
 * and discount only — B9), and what the preview, the print and Quick fill read. Money is rupees
 * as the API sends it.
 */

// ── Limits ──

/** The Remark — "Shown on the printed invoice" — 500 characters. */
export const INVOICE_REMARK_MAX = 500;
/** A line's quantity: the stepper's 1–999. */
export const INVOICE_QTY_MAX = 999;
/** A line's description — the free text under its name — 280 characters (BD1). */
export const INVOICE_LINE_DESCRIPTION_MAX = 280;

// ── Records ──

/** An invoice's payment status — the server's (`payment_status`). */
const INVOICE_PAYMENT_STATUS_VALUES = ['paid', 'partial', 'unpaid'] as const;
/** One payment status. */
type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUS_VALUES)[number];

/** The GST rates a line can carry (the offering's or the medicine's). */
const gstPercentSchema = z.union([
  z.literal(0),
  z.literal(5),
  z.literal(12),
  z.literal(18),
  z.literal(28),
]);

/** One line of an invoice as the server priced it. Money in rupees. */
export interface InvoiceLine {
  /** `iitm_…` — a change keeps a line by it. */
  id: string;
  lineNumber: number;
  offeringId: string | null;
  medicineId: string | null;
  /** The offering's or medicine's name as billed. */
  name: string;
  /** The free text under the name ("+2 sessions free"), up to 280; null for none. */
  description: string | null;
  /** A medicine line's pack label when billed ("1*10"). */
  packSize: string | null;
  /** A medicine line's HSN code when billed (change-pharmacy-record-fields D3). */
  hsnCode: string | null;
  qty: number;
  /** The rate billed — the offering's price, its live offer's, never below the lowest price. */
  rate: number;
  /** The line's discount, two places. */
  discountPct: number;
  discountAmount: number;
  gstPct: number;
  isGstInclusive: boolean;
  taxableAmount: number;
  gstAmount: number;
  /** The line's net. */
  amount: number;
  /** The plan row it bills (`patient_offering_suggestion_id`). */
  suggestionId: string | null;
  /** The package it sold. */
  patientOfferingId: string | null;
  /** The done treatments it pays for. */
  treatmentIds: string[];
  batchNo: string | null;
}

/** The person an invoice bills — the contact it names. */
interface InvoiceContact {
  /** `con_…`. */
  id: string;
  name: string;
  /** Their primary number, E.164. */
  phone: string;
}

/** An invoice as the rooms read it. Money in rupees, every figure the server's. */
export interface InvoiceRecord {
  /** `invc_…`. */
  id: string;
  /** "#5" — the invoice's number on screen. */
  seq: number;
  /** The statutory number, "2026-27/0005" — the print's. */
  number: string;
  financialYear: string;
  type: InvoiceType;
  branchId: string;
  contactId: string | null;
  contact: InvoiceContact | null;
  patientId: string | null;
  /** The people on its "Team" (`mem_…`). */
  teamIds: string[];
  items: InvoiceLine[];
  overallDiscount: number;
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  gstTotal: number;
  /** What the invoice bills. */
  total: number;
  paid: number;
  /** What its refunds gave back — moved out of `paid`, so `due` (total − paid − refunded) never
   *  rises with a refund (clinozy-be D93). */
  refunded: number;
  due: number;
  status: InvoicePaymentStatus;
  /** Its day is closed — read-only. */
  isSettled: boolean;
  /** The invoice's day. */
  date: string;
  remark: string | null;
  prescriptionId: string | null;
  /** Who billed it (`mem_…`); null for an API key. */
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── The wire ──

/**
 * An answer with lines, plus the HSN code change-pharmacy-record-fields snapshots on each line
 * (D3), which clinozy-be's OpenAPI response map does not list yet (F1). Once `pnpm api:types`
 * carries it, this is the documented shape again.
 */
type WithLineHsn<Api extends { items?: readonly object[] }> = Omit<Api, 'items'> & {
  items?: (NonNullable<Api['items']>[number] & { hsn_code?: string | null })[];
};
type ApiInvoiceRow = WithLineHsn<NonNullable<ApiData<'/app/invoices', 'get'>>[number]>;
type ApiInvoice = WithLineHsn<NonNullable<ApiData<'/app/invoices/{invoice_id}', 'get'>>>;
type ApiInvoicePreview = WithLineHsn<
  NonNullable<ApiData<'/app/invoices/preview', 'post'>>
>;
type ApiInvoiceListMeta = NonNullable<
  operations['getAppInvoices']['responses'][200]['content']['application/json']['meta']
>;
type ApiOrganization = NonNullable<ApiData<'/tenancy/organization', 'get'>>;
type ApiMyBranch = NonNullable<ApiData<'/app/branches/my', 'get'>>[number];
/** A bill as `POST /app/invoices` takes it. */
export type ApiInvoiceCreate = ApiBody<'/app/invoices', 'post'>;
/** A change as `PATCH /app/invoices/:invoice_id` takes it. */
export type ApiInvoiceChange = ApiBody<'/app/invoices/{invoice_id}', 'patch'>;
/** A bill as `POST /app/invoices/preview` takes it — the create body without "Paid now". */
type ApiInvoicePreviewBody = ApiBody<'/app/invoices/preview', 'post'>;

const invoiceLineFieldsWire = {
  line_number: z.number().int(),
  offering_id: z.string().nullable(),
  medicine_id: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  pack_size: z.string().nullable(),
  hsn_code: z.string().nullable(),
  quantity: z.number().int(),
  rate: z.number(),
  discount_percent: z.number(),
  discount_amount: z.number(),
  gst_percent: gstPercentSchema,
  is_gst_inclusive: z.boolean(),
  taxable_amount: z.number(),
  gst_amount: z.number(),
  amount: z.number(),
  patient_offering_suggestion_id: z.string().nullable(),
  batch_number: z.string().nullable(),
};

const invoiceFieldsWire = {
  id: z.string(),
  invoice_sequence: z.number().int(),
  invoice_number: z.string(),
  financial_year: z.string(),
  type: invoiceTypeSchema,
  branch_id: z.string(),
  contact: z
    .object({ id: z.string(), name: z.string(), primary_phone: z.string() })
    .nullable(),
  patient_id: z.string().nullable(),
  member_ids: z.array(z.string()),
  items: z.array(
    z.object({
      ...invoiceLineFieldsWire,
      id: z.string(),
      patient_offering_id: z.string().nullable(),
      patient_treatment_ids: z.array(z.string()),
    }),
  ),
  overall_discount: z.number(),
  subtotal: z.number(),
  discount_total: z.number(),
  taxable_total: z.number(),
  gst_total: z.number(),
  total: z.number(),
  paid_amount: z.number(),
  refunded_amount: z.number(),
  due_amount: z.number(),
  payment_status: z.enum(INVOICE_PAYMENT_STATUS_VALUES),
  is_settled: z.boolean(),
  invoice_date: civilDateSchema,
  remark: z.string().nullable(),
  patient_prescription_id: z.string().nullable(),
  created_by_membership_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** An invoice list row (`GET /app/invoices`). */
export const invoiceRowWire = wireSchema<ApiInvoiceRow>()(z.object(invoiceFieldsWire));

/** One invoice (`GET /app/invoices/:invoice_id`, and every write's answer). */
export const invoiceWire = wireSchema<ApiInvoice>()(z.object(invoiceFieldsWire));

/** The invoice list's own `meta`: what is due and paid over every page its filters match (D81). */
export const invoiceListMetaWire = wireSchema<
  Pick<ApiInvoiceListMeta, 'due_total' | 'paid_total'>
>()(z.object({ due_total: z.number(), paid_total: z.number() }));

/** An invoice as the API sends it. */
type InvoiceWire = z.output<typeof invoiceRowWire>;

/** An invoice as the rooms read it. */
export function toInvoiceRecord(row: InvoiceWire): InvoiceRecord {
  return {
    id: row.id,
    seq: row.invoice_sequence,
    number: row.invoice_number,
    financialYear: row.financial_year,
    type: row.type,
    branchId: row.branch_id,
    contactId: row.contact?.id ?? null,
    contact: row.contact
      ? { id: row.contact.id, name: row.contact.name, phone: row.contact.primary_phone }
      : null,
    patientId: row.patient_id,
    teamIds: row.member_ids,
    items: row.items.map((line) => ({
      id: line.id,
      lineNumber: line.line_number,
      offeringId: line.offering_id,
      medicineId: line.medicine_id,
      name: line.name,
      description: line.description,
      packSize: line.pack_size,
      hsnCode: line.hsn_code,
      qty: line.quantity,
      rate: line.rate,
      discountPct: line.discount_percent,
      discountAmount: line.discount_amount,
      gstPct: line.gst_percent,
      isGstInclusive: line.is_gst_inclusive,
      taxableAmount: line.taxable_amount,
      gstAmount: line.gst_amount,
      amount: line.amount,
      suggestionId: line.patient_offering_suggestion_id,
      patientOfferingId: line.patient_offering_id,
      treatmentIds: line.patient_treatment_ids,
      batchNo: line.batch_number,
    })),
    overallDiscount: row.overall_discount,
    subtotal: row.subtotal,
    discountTotal: row.discount_total,
    taxableTotal: row.taxable_total,
    gstTotal: row.gst_total,
    total: row.total,
    paid: row.paid_amount,
    refunded: row.refunded_amount,
    due: row.due_amount,
    status: row.payment_status,
    isSettled: row.is_settled,
    date: row.invoice_date,
    remark: row.remark,
    prescriptionId: row.patient_prescription_id,
    createdById: row.created_by_membership_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── The preview ──

/** One line of a preview — as the save would write it; a new line has no id yet. */
interface InvoicePreviewLine extends Omit<
  InvoiceLine,
  'id' | 'patientOfferingId' | 'treatmentIds'
> {
  id: string | null;
  /** The live offers its rate came from. */
  offerIds: string[];
  /** The sessions it buys (an extra-sessions offer adds its free ones); null for no package. */
  sessionsTotal: number | null;
}

/**
 * What a bill or a change would come to — the server's lines and totals, nothing written (`POST
 * /app/invoices/preview`, `POST /app/invoices/:invoice_id/preview`, D81 Q2). Money in rupees.
 */
export interface InvoicePreview {
  type: InvoiceType;
  date: string;
  items: InvoicePreviewLine[];
  overallDiscount: number;
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  gstTotal: number;
  total: number;
  paid: number;
  refunded: number;
  due: number;
}

/** A preview (`POST /app/invoices/preview`; the change preview answers the same shape). */
export const invoicePreviewWire = wireSchema<ApiInvoicePreview>()(
  z.object({
    type: invoiceTypeSchema,
    invoice_date: civilDateSchema,
    items: z.array(
      z.object({
        ...invoiceLineFieldsWire,
        id: z.string().nullable(),
        offer_ids: z.array(z.string()),
        sessions_total: z.number().int().nullable(),
      }),
    ),
    overall_discount: z.number(),
    subtotal: z.number(),
    discount_total: z.number(),
    taxable_total: z.number(),
    gst_total: z.number(),
    total: z.number(),
    paid_amount: z.number(),
    refunded_amount: z.number(),
    due_amount: z.number(),
  }),
);

/** A preview as the drawer reads it. */
export function toInvoicePreview(
  row: z.output<typeof invoicePreviewWire>,
): InvoicePreview {
  return {
    type: row.type,
    date: row.invoice_date,
    items: row.items.map((line) => ({
      id: line.id,
      lineNumber: line.line_number,
      offeringId: line.offering_id,
      medicineId: line.medicine_id,
      name: line.name,
      description: line.description,
      packSize: line.pack_size,
      hsnCode: line.hsn_code,
      qty: line.quantity,
      rate: line.rate,
      discountPct: line.discount_percent,
      discountAmount: line.discount_amount,
      gstPct: line.gst_percent,
      isGstInclusive: line.is_gst_inclusive,
      taxableAmount: line.taxable_amount,
      gstAmount: line.gst_amount,
      amount: line.amount,
      suggestionId: line.patient_offering_suggestion_id,
      batchNo: line.batch_number,
      offerIds: line.offer_ids,
      sessionsTotal: line.sessions_total,
    })),
    overallDiscount: row.overall_discount,
    subtotal: row.subtotal,
    discountTotal: row.discount_total,
    taxableTotal: row.taxable_total,
    gstTotal: row.gst_total,
    total: row.total,
    paid: row.paid_amount,
    refunded: row.refunded_amount,
    due: row.due_amount,
  };
}

// ── The printed sheet ──

/** The clinic the printed sheet names: its name and specialties for the footer, its currency. */
export const invoiceSheetOrganizationWire = wireSchema<ApiOrganization>()(
  z.object({
    name: z.string(),
    specialties: z.array(offeringSpecialtySchema),
    currency: z.string(),
  }),
);

/** A branch's print header — every member reads it (`GET /app/branches/my`, D81 (7)). */
export const invoiceSheetBranchWire = wireSchema<ApiMyBranch>()(
  z.object({
    id: z.string(),
    name: z.string(),
    phone: z.string(),
    gst_number: z.string().nullable(),
    address_line_one: z.string(),
    address_line_two: z.string().nullable(),
    area: z.string(),
    city: z.string(),
    state: z.string(),
    postal_code: z.string(),
  }),
);

/** The branch the sheet's header and footer name. */
export interface InvoiceSheetBranch {
  id: string;
  name: string;
  phone: string;
  /** The GSTIN a GST invoice carries. */
  gstNumber: string | null;
  address: {
    lineOne: string;
    lineTwo: string | null;
    area: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

/** A branch's print header as the sheet reads it. */
export function toInvoiceSheetBranch(
  row: z.output<typeof invoiceSheetBranchWire>,
): InvoiceSheetBranch {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    gstNumber: row.gst_number,
    address: {
      lineOne: row.address_line_one,
      lineTwo: row.address_line_two,
      area: row.area,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
    },
  };
}

/** What the A4 sheet prints beyond the invoice: the clinic and its branch. */
export interface InvoiceSheet {
  organization: { name: string; specialties: OfferingSpecialty[]; currency: string };
  /** The invoice's branch; null for a branch the member's list no longer has. */
  branch: InvoiceSheetBranch | null;
}

// ── The invoice as the drawer, the preview and the print read it ──

/** Who an invoice bills, as the drawer, the preview and the print name them. */
export interface InvoiceParty {
  contactId: string;
  /** Their patient file; null for a contact without one (a Medical walk-in). */
  patientId: string | null;
  name: string;
  phone: string;
}

/**
 * One invoice with what reads beside it: who it bills, the ledger entries against it (receipts,
 * refunds with their credit notes, newest first) and the sheet's clinic and branch.
 */
export interface InvoiceDetail {
  invoice: InvoiceRecord;
  party: InvoiceParty | null;
  payments: LedgerRow[];
  sheet: InvoiceSheet;
  /** The Medical sale the invoice belongs to, when the reader knows it — the sale print's "S-983". */
  sale?: { seq: number } | null;
}

/** What a save answers: the invoice as read back, and how many of its lines bill plan rows. */
export interface InvoiceSaveResult {
  detail: InvoiceDetail;
  /** Plan rows the lines invoice ("· 2 offering suggestions items marked invoiced"). */
  planLinked: number;
}

/** The party an invoice names, from its contact. */
export function invoicePartyOf(invoice: InvoiceRecord): InvoiceParty | null {
  return invoice.contact
    ? {
        contactId: invoice.contact.id,
        patientId: invoice.patientId,
        name: invoice.contact.name,
        phone: invoice.contact.phone,
      }
    : null;
}

/** How many of an invoice's lines bill a plan row. */
export function planLinkedLines(invoice: Pick<InvoiceRecord, 'items'>): number {
  return invoice.items.filter((line) => line.suggestionId !== null).length;
}

// ── Writes ──

/** The invoice types the clinic bills here — a Medical sale is the Medical room's. */
export type ClinicInvoiceType = Exclude<InvoiceType, 'medical'>;

/**
 * One line as the drawer sends it: an offering, how many, the discount (two places) — the rate,
 * GST and name are the server's (B9) — the plan row it bills and the done treatments it pays for.
 */
export interface InvoiceLineInput {
  /** A kept line's id on a change; null for a new line. */
  id: string | null;
  offeringId: string;
  qty: number;
  discountPct: number;
  /** The free text under the line's name; blank or null sends none (a kept line's is cleared). */
  description: string | null;
  suggestionId: string | null;
  treatmentIds: string[];
}

/**
 * What the drawer sends to bill, change or preview a clinic or consultation invoice: the branch,
 * the person (their contact; a preview may go before the patient is picked), the team, the lines,
 * the overall discount, the day, the remark, the prescription and "Paid now" (a create only).
 * Money in rupees.
 */
export interface InvoiceInput {
  type: ClinicInvoiceType;
  branchId: string;
  contactId: string | null;
  teamIds: string[];
  items: InvoiceLineInput[];
  overallDiscount: number;
  date: string;
  remark: string | null;
  prescriptionId: string | null;
  /** "Paid now": one receipt recorded with the bill, its splits one per mode. */
  paidNow: MoneySplit[];
}

/** A percentage to the two places the API takes. */
const twoPlaces = (value: number) => Math.round(value * 100) / 100;

/** A remark or a line's description as a write sends it: trimmed, a blank one as none. */
const textOrNull = (text: string | null) => {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

type ApiInvoiceLine = NonNullable<ApiInvoiceChange['items']>[number];

/**
 * One line as a write sends it — with its id when it is kept. A kept line always carries its
 * description (null clears it; omitted the server would keep the saved one); a new line only
 * when it has one.
 */
function lineBodyOf(line: InvoiceLineInput): ApiInvoiceLine {
  const description = textOrNull(line.description);
  return {
    ...(line.id ? { id: line.id } : {}),
    offering_id: line.offeringId,
    quantity: line.qty,
    discount_percent: twoPlaces(line.discountPct),
    ...(line.id || description !== null ? { description } : {}),
    patient_offering_suggestion_id: line.suggestionId,
    patient_treatment_ids: line.treatmentIds,
  };
}

/** A new bill's lines: none carries an id. */
const newLineBodyOf = (line: InvoiceLineInput) => lineBodyOf({ ...line, id: null });

/**
 * A bill as `POST /app/invoices/preview` takes it — the create body without "Paid now"; the
 * person only once they are picked.
 */
export function invoicePreviewBodyOf(input: InvoiceInput): ApiInvoicePreviewBody {
  return {
    branch_id: input.branchId,
    ...(input.contactId ? { contact_id: input.contactId } : {}),
    type: input.type,
    invoice_date: input.date,
    member_ids: input.teamIds,
    items: input.items.map(newLineBodyOf),
    overall_discount: input.overallDiscount,
    remark: textOrNull(input.remark),
    patient_prescription_id: input.prescriptionId,
  };
}

/** A bill as `POST /app/invoices` takes it, with "Paid now" when the drawer took money. */
export function invoiceCreateBodyOf(input: InvoiceInput): ApiInvoiceCreate {
  const body: ApiInvoiceCreate = invoicePreviewBodyOf(input);
  if (input.paidNow.length > 0) {
    body.payment = {
      splits: input.paidNow.map(({ mode, amount }) => ({ mode, amount })),
    };
  }
  return body;
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

/** Whether a line is the saved line it names, unchanged. */
function sameLine(line: InvoiceLineInput, saved: InvoiceLine | undefined): boolean {
  return (
    saved !== undefined &&
    line.offeringId === saved.offeringId &&
    line.qty === saved.qty &&
    twoPlaces(line.discountPct) === saved.discountPct &&
    textOrNull(line.description) === saved.description &&
    line.suggestionId === saved.suggestionId &&
    sameSet(line.treatmentIds, saved.treatmentIds)
  );
}

/** Whether the drawer's lines are the invoice's, in order, each unchanged. */
function sameLines(lines: readonly InvoiceLineInput[], invoice: InvoiceRecord): boolean {
  if (lines.length !== invoice.items.length) return false;
  const saved = new Map(invoice.items.map((line) => [line.id, line]));
  return lines.every(
    (line, index) =>
      line.id === invoice.items[index]?.id &&
      sameLine(line, line.id ? saved.get(line.id) : undefined),
  );
}

/**
 * A change of an invoice as `PATCH /app/invoices/:invoice_id` (and its preview) takes it — only
 * what differs from the record (no `expected_updated_at`; the api adds it). When any line moved,
 * every line goes, the kept ones by id (B12). The branch and the type never change.
 */
export function invoiceChangeOf(
  invoice: InvoiceRecord,
  input: InvoiceInput,
): Omit<ApiInvoiceChange, 'expected_updated_at'> {
  const change: Omit<ApiInvoiceChange, 'expected_updated_at'> = {};
  if (input.contactId !== null && input.contactId !== invoice.contactId) {
    change.contact_id = input.contactId;
  }
  if (input.date !== invoice.date) change.invoice_date = input.date;
  if (!sameList(input.teamIds, invoice.teamIds)) change.member_ids = input.teamIds;
  if (!sameLines(input.items, invoice)) change.items = input.items.map(lineBodyOf);
  if (input.overallDiscount !== invoice.overallDiscount) {
    change.overall_discount = input.overallDiscount;
  }
  if (textOrNull(input.remark) !== invoice.remark)
    change.remark = textOrNull(input.remark);
  if (input.prescriptionId !== invoice.prescriptionId) {
    change.patient_prescription_id = input.prescriptionId;
  }
  return change;
}

// ── Refusals ──

/** A line under its offering's lowest price (`400 below_lowest_price`, the only floor — §6 #11). */
const BELOW_LOWEST_PRICE = 'below_lowest_price';

/** A validation field naming a line: `items/2`, `body.items/2`. */
const LINE_FIELD = /(?:^|\.)items\/(\d+)$/;

/**
 * The lines (by index) a save was refused for — each under its lowest price (`400
 * below_lowest_price`, `errors[].field = items/<n>`, D81 PAY-M1); empty for any other refusal.
 */
export function belowLowestPriceLines(error: unknown): number[] {
  if (!isHttpError(error) || error.status !== 400) return [];
  if (apiErrorReason(error) !== BELOW_LOWEST_PRICE) return [];
  return readValidationEntries(error.data).flatMap(({ field }) => {
    const match = LINE_FIELD.exec(field);
    return match?.[1] === undefined ? [] : [Number(match[1])];
  });
}

// ── Reads ──

/**
 * The invoice list's params: one person's invoices (their patient file or their contact), the
 * payment statuses, the order — the newest first, or the oldest first (the Receive drawer's
 * "Against invoice") — and the page size.
 */
export interface InvoiceListParams {
  patientId?: string;
  contactId?: string;
  status?: InvoicePaymentStatus[];
  /** Oldest first, by the invoice's day; the newest first by default. */
  oldestFirst?: boolean;
  /** The branches billed at (`branch_id`, several); every branch when absent. */
  branchIds?: string[];
  /** One invoice day (`invoice_date_from` = `_to`) — Today's checkout reads today's. */
  day?: string;
}

/** What is due and paid over every invoice a list's filters match (rupees). */
export interface InvoiceTotals {
  due: number;
  paid: number;
  /**
   * How many invoices the filters match — the API's count (`estimated_total`, exact under
   * 10,000), on the totals read alone; absent when the answer leaves it out.
   */
  count?: number;
}

/** A page of invoices: the rows, the next cursor, the API's estimated count and the totals. */
export interface InvoicePage {
  rows: InvoiceRecord[];
  next: string | null;
  total: number | null;
  totals: InvoiceTotals | null;
}

/** A patient's earlier invoice the drawer offers to repeat ("⚡ Repeat #785"). */
export interface InvoiceRepeatSource {
  id: string;
  seq: number;
  type: ClinicInvoiceType;
  items: InvoiceLine[];
  teamIds: string[];
}

/**
 * What the drawer's Quick fill reads for a patient (KICKOFF §6.9 Quick fill): the packages they
 * hold with sessions left, their last invoice of each type and the team the last one named.
 */
export interface InvoicePresets {
  packages: { offeringId: string }[];
  lastByType: Partial<Record<ClinicInvoiceType, InvoiceRepeatSource>>;
  recentTeamIds: string[];
}
