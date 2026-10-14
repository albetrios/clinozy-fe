import { MONEY_SCALE, numberFromText, rupeesOfPaise } from '@/lib/number-text.ts';
import type { InvoiceType } from '@/shared/api/app/app-schema.ts';
import type {
  ClinicInvoiceType,
  InvoiceDetail,
  InvoiceInput,
  InvoiceLineInput,
  InvoiceRecord,
} from '@/shared/api/app/invoices-contracts.ts';
import {
  EXPENSE_MODE_VALUES,
  type MoneySplit,
} from '@/shared/api/app/payments-contracts.ts';

/*
 * The Invoice drawer's form (KICKOFF §6.9): what each field holds, what a new or an existing
 * invoice starts with, and what an invoice's save sends. One form serves both of the drawer's
 * modes — a clinic or consultation invoice on clinozy-be, priced by the server, and Medical's
 * New sale, the room's write on clinozy-be (`sale-form.ts`). The money fields hold paise, as every form's do
 * (W0); the write turns them into the API's rupees.
 */

/**
 * The modes "Paid now" offers, in its order (`PY_MODES`, H:3612): the ones a person pays with —
 * Credit is only ever a pending credit's.
 */
export const PAID_NOW_MODES = EXPENSE_MODE_VALUES;

/** One "Paid now" mode. */
export type PaidNowMode = (typeof PAID_NOW_MODES)[number];

/**
 * One item row. An invoice's line is an offering, its quantity and its discount — the server
 * prices it; a kept line carries its saved id, the plan row it bills and the treatments it pays
 * for. A sale's line is a medicine at its MRP (paise) — a guide: the server prices the sale.
 */
export interface InvoiceLineForm {
  /** A saved line's id (`iitm_…`) — an edit keeps the line by it; null for a new one. */
  id: string | null;
  offeringId: string | null;
  medicineId: string | null;
  /** What the row bills, as the picker named it — empty for a blank row. */
  name: string;
  packSize: string | null;
  qty: number;
  /** A sale's rate, in paise; an invoice's is the server's (0 here). */
  rate: number;
  /** The line's own discount, two places. */
  discountPct: number;
  /** A sale's GST; an invoice's is the server's (0 here). */
  gstPct: number;
  batchNo: string | null;
  /** The plan row the line bills (`patient_offering_suggestion_id`). */
  suggestionId: string | null;
  /** The done treatments it pays for. */
  treatmentIds: string[];
}

/** One "Paid now" row (H:5063): a mode and its amount in paise, 0 while empty. */
export interface PaidNowRow {
  mode: PaidNowMode;
  amount: number;
}

/**
 * Who the invoice bills: a patient — the only party of a clinic or consultation invoice, named
 * by their file (`pat_…`) and billed through their contact (`con_…`) — or, for a Medical sale,
 * a lead (saved as a Medical contact) or a Medical contact (`payments.md:138`).
 */
export interface InvoicePartyForm {
  kind: 'patient' | 'lead' | 'contact';
  id: string;
  /** The contact an invoice bills; null until a prefilled patient is read (and on a sale). */
  contactId: string | null;
  name: string;
  phone: string | null;
}

/** The drawer's form values. */
export interface InvoiceFormValues {
  type: InvoiceType;
  branchId: string | null;
  party: InvoicePartyForm | null;
  teamIds: string[];
  items: InvoiceLineForm[];
  /** A sale's overall discount as typed: a percent ("5", "12.5", ""; Q-G7). */
  overallDiscountPct: string;
  /** An invoice's overall discount as typed: rupees off the bill before tax ("500", ""). */
  overallDiscount: string;
  paidNow: PaidNowRow[];
  remark: string;
  /** The invoice's calendar date — today for a new one. */
  date: string;
  prescriptionId: string | null;
}

/** A blank item row — the table keeps one (H:5059). */
export function blankLine(): InvoiceLineForm {
  return {
    id: null,
    offeringId: null,
    medicineId: null,
    name: '',
    packSize: null,
    qty: 1,
    rate: 0,
    discountPct: 0,
    gstPct: 0,
    batchNo: null,
    suggestionId: null,
    treatmentIds: [],
  };
}

/** The rows a new invoice's "Paid now" starts with: one UPI row, empty (H:5051). */
export function blankPaidNow(mode: PaidNowMode = 'upi'): PaidNowRow[] {
  return [{ mode, amount: 0 }];
}

/** What a new invoice opens with: the URL's type and patient, the screen's branch. */
export interface InvoicePrefill {
  type?: InvoiceType;
  party?: InvoicePartyForm | null;
  branchId?: string | null;
  prescriptionId?: string | null;
  remark?: string;
  items?: InvoiceLineForm[];
}

/** A new invoice's form: one blank row, nothing paid, today. */
export function emptyInvoiceForm(
  today: string,
  prefill: InvoicePrefill = {},
): InvoiceFormValues {
  return {
    type: prefill.type ?? 'clinic',
    branchId: prefill.branchId ?? null,
    party: prefill.party ?? null,
    teamIds: [],
    items: prefill.items && prefill.items.length > 0 ? prefill.items : [blankLine()],
    overallDiscountPct: '',
    overallDiscount: '',
    paidNow: blankPaidNow(),
    remark: prefill.remark ?? '',
    date: today,
    prescriptionId: prefill.prescriptionId ?? null,
  };
}

/** The money field's text for rupees: empty for none. */
function rupeesText(rupees: number): string {
  return rupees > 0 ? String(rupees) : '';
}

/** A saved line as a row: what it bills, how many, its discount and its links. */
function rowOfLine(line: InvoiceRecord['items'][number]): InvoiceLineForm {
  return {
    ...blankLine(),
    id: line.id,
    offeringId: line.offeringId,
    medicineId: line.medicineId,
    name: line.name,
    packSize: line.packSize,
    qty: line.qty,
    discountPct: line.discountPct,
    batchNo: line.batchNo,
    suggestionId: line.suggestionId,
    treatmentIds: [...line.treatmentIds],
  };
}

/** The form a saved invoice opens with — "Paid now" empty: what is paid is the ledger's. */
export function invoiceFormOf(detail: InvoiceDetail): InvoiceFormValues {
  const { invoice, party } = detail;
  const items = invoice.items.map(rowOfLine);
  return {
    type: invoice.type,
    branchId: invoice.branchId,
    party: party
      ? {
          kind: party.patientId ? 'patient' : 'contact',
          id: party.patientId ?? party.contactId,
          contactId: party.contactId,
          name: party.name,
          phone: party.phone,
        }
      : null,
    teamIds: [...invoice.teamIds],
    items: items.length > 0 ? items : [blankLine()],
    overallDiscountPct: '',
    overallDiscount: rupeesText(invoice.overallDiscount),
    paidNow: blankPaidNow(),
    remark: invoice.remark ?? '',
    date: invoice.date,
    prescriptionId: invoice.prescriptionId,
  };
}

/**
 * A copy of a saved invoice — the patient file's "Copy invoice" (`patient-file.md:43`, H:5017
 * `copyInv`): what the bill says — its type, party, team, lines (offerings, quantities,
 * discounts), overall discount and remark — dated today with nothing paid, filed like any new
 * invoice under the screen's branch. What belonged to the original alone stays with it: its
 * number and status, its payments, its lines' ids, the plan rows and treatments they billed and
 * the prescription. A Medical sale's invoice is the Medical room's — the Invoices room bills no
 * medicine (MD28) — so its copy starts a blank clinic invoice.
 */
export function copiedInvoiceForm(
  detail: InvoiceDetail,
  today: string,
  branchId: string | null,
): InvoiceFormValues {
  if (detail.invoice.type === 'medical') return emptyInvoiceForm(today, { branchId });
  const form = invoiceFormOf(detail);
  return {
    ...form,
    branchId,
    items: form.items.map((item) => ({
      ...item,
      id: null,
      batchNo: null,
      suggestionId: null,
      treatmentIds: [],
    })),
    date: today,
    prescriptionId: null,
  };
}

/** The percent the field's text holds — 0 for nothing or a stray point, at most 100. */
export function percentOf(text: string): number {
  const value = Number.parseFloat(text);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

/** The rows that bill something: a row with a name. */
export function namedLines(items: readonly InvoiceLineForm[]): InvoiceLineForm[] {
  return items.filter((item) => item.name.trim() !== '');
}

/** "Paid now" as it is recorded: rows above zero, one per mode, in paise. */
export function paidNowSplits(
  rows: readonly PaidNowRow[],
): { mode: PaidNowMode; amount: number }[] {
  const byMode = new Map<PaidNowMode, number>();
  for (const row of rows) {
    if (row.amount > 0) byMode.set(row.mode, (byMode.get(row.mode) ?? 0) + row.amount);
  }
  return [...byMode].map(([mode, amount]) => ({ mode, amount }));
}

/** Σ of the "Paid now" rows, in paise. */
export function paidNowTotal(rows: readonly PaidNowRow[]): number {
  return rows.reduce((sum, row) => sum + Math.max(0, row.amount), 0);
}

/** An invoice's overall discount as the field holds it, in paise. */
export function overallDiscountPaise(values: Pick<InvoiceFormValues, 'overallDiscount'>) {
  return numberFromText(values.overallDiscount, MONEY_SCALE);
}

/**
 * The rows an invoice sends, with each one's place in the form: every row with an offering
 * picked, in order. `items/<n>` in a refusal names the n-th of these.
 */
export function sentLines(
  items: readonly InvoiceLineForm[],
): { row: number; line: InvoiceLineForm & { offeringId: string } }[] {
  return items.flatMap((line, row) =>
    line.offeringId !== null && line.name.trim() !== ''
      ? [{ row, line: { ...line, offeringId: line.offeringId } }]
      : [],
  );
}

/** One row as an invoice sends it: the offering, how many, the discount and its links. */
function lineInputOf(line: InvoiceLineForm & { offeringId: string }): InvoiceLineInput {
  return {
    id: line.id,
    offeringId: line.offeringId,
    qty: line.qty,
    discountPct: line.discountPct,
    suggestionId: line.suggestionId,
    treatmentIds: line.treatmentIds,
  };
}

/** "Paid now" as an invoice's or a sale's create sends it: one split per mode, in rupees. */
export function paidNowMoney(rows: readonly PaidNowRow[]): MoneySplit[] {
  return paidNowSplits(rows).map(({ mode, amount }) => ({
    mode,
    amount: rupeesOfPaise(amount),
  }));
}

/**
 * What a clinic or consultation invoice's save — or its preview — sends (`POST
 * /app/invoices`, `PATCH /app/invoices/:id`): the branch, the patient's contact, the team, the
 * lines by offering with their discount, the overall discount and "Paid now" in rupees, the day,
 * the remark and the prescription. The rates, GST and amounts are the server's.
 */
export function invoiceInputOf(
  values: InvoiceFormValues,
  fallbackBranchId: string,
): InvoiceInput {
  const type: ClinicInvoiceType =
    values.type === 'consultation' ? 'consultation' : 'clinic';
  return {
    type,
    branchId: values.branchId ?? fallbackBranchId,
    contactId: values.party?.contactId ?? null,
    teamIds: values.teamIds,
    items: sentLines(values.items).map(({ line }) => lineInputOf(line)),
    overallDiscount: rupeesOfPaise(overallDiscountPaise(values)),
    date: values.date,
    remark: values.remark,
    prescriptionId: values.prescriptionId,
    paidNow: paidNowMoney(values.paidNow),
  };
}
