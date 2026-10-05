import {
  balanceOf,
  type InvoiceBalance,
  type InvoiceTotals,
  invoiceTotals,
  overallDiscountFromPercent,
  overallDiscountPercent,
} from '@/shared/api/clinic/clinic-money.ts';
import type { InvoiceType, PaymentMode } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  InvoiceDetail,
  InvoiceInput,
  InvoiceLineInput,
} from '@/shared/api/clinic/invoices-contracts.ts';
import { EXPENSE_MODE_VALUES } from '@/shared/api/clinic/payments-contracts.ts';

/*
 * The Invoice drawer's form (KICKOFF §6.9): what each field holds, what a new
 * or an existing invoice starts with, the draft's figures, and the write a
 * save sends. Money is in integer paise throughout; the overall discount is
 * the drawer's percent (Q-G7) until the write turns it into paise.
 */

/**
 * The modes "Paid now" offers, in its order (`PY_MODES`, H:3612): the ones a
 * person pays with — Credit is only ever a pending credit's.
 */
export const PAID_NOW_MODES = EXPENSE_MODE_VALUES;

/** One "Paid now" mode. */
export type PaidNowMode = (typeof PAID_NOW_MODES)[number];

/** One item row: the contract's line fields, the batch read-only (a sale's). */
export interface InvoiceLineForm extends InvoiceLineInput {
  batchNo: string | null;
}

/** One "Paid now" row (H:5063): a mode and its amount, 0 while empty. */
export interface PaidNowRow {
  mode: PaidNowMode;
  amount: number;
}

/**
 * Who the invoice bills: a patient — the only party of a clinic or
 * consultation invoice — or, for a Medical sale, a lead (saved as a Medical
 * contact) or a Medical contact (`payments.md:138`).
 */
export interface InvoicePartyForm {
  kind: 'patient' | 'lead' | 'contact';
  id: string;
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
  /** The overall discount as typed in its field: a percent ("5", "12.5", ""; Q-G7). */
  overallDiscountPct: string;
  paidNow: PaidNowRow[];
  remark: string;
  /** The invoice's calendar date — today for a new one. */
  date: string;
  prescriptionId: string | null;
}

/** A blank item row — the table keeps one (H:5059). */
export function blankLine(): InvoiceLineForm {
  return {
    offeringId: null,
    medicineId: null,
    name: '',
    packSize: null,
    qty: 1,
    rate: 0,
    discountPct: 0,
    gstPct: 0,
    batchNo: null,
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
    paidNow: blankPaidNow(),
    remark: prefill.remark ?? '',
    date: today,
    prescriptionId: prefill.prescriptionId ?? null,
  };
}

/** The form a saved invoice opens with — "Paid now" empty: what is paid is the ledger's. */
export function invoiceFormOf(detail: InvoiceDetail): InvoiceFormValues {
  const { invoice, party } = detail;
  const items = invoice.items.map((item) => ({ ...item }));
  return {
    type: invoice.type,
    branchId: invoice.branchId,
    party: party
      ? {
          kind: party.kind,
          id: party.id,
          name: party.name,
          phone: party.phone,
        }
      : null,
    teamIds: [...invoice.teamIds],
    items: items.length > 0 ? items : [blankLine()],
    overallDiscountPct: percentText(
      overallDiscountPercent(items, invoice.overallDiscount),
    ),
    paidNow: blankPaidNow(),
    remark: invoice.remark ?? '',
    date: invoice.date,
    prescriptionId: invoice.prescriptionId,
  };
}

/**
 * A copy of a saved invoice — the patient file's "Copy invoice"
 * (`patient-file.md:43`, H:5017 `copyInv`): what the bill says — its type,
 * party, team, lines (quantities, prices, discounts), overall discount and
 * remark — dated today with nothing paid, filed like any new invoice under
 * the screen's branch (`branchId`, where a sale's stock is drawn). What
 * belonged to the original alone stays with it: its number and status, its
 * payments, the batches its sale drew and the prescription it dispensed.
 */
export function copiedInvoiceForm(
  detail: InvoiceDetail,
  today: string,
  branchId: string | null,
): InvoiceFormValues {
  const form = invoiceFormOf(detail);
  return {
    ...form,
    branchId,
    items: form.items.map((item) => ({ ...item, batchNo: null })),
    date: today,
    prescriptionId: null,
  };
}

/** The percent field's text for a number: empty for none. */
function percentText(percent: number): string {
  return percent > 0 ? String(percent) : '';
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

/** "Paid now" as it is recorded: rows above zero, one per mode. */
export function paidNowSplits(
  rows: readonly PaidNowRow[],
): { mode: PaymentMode; amount: number }[] {
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

/** The draft's figures: the totals, and the balance once "Paid now" lands. */
export interface InvoiceDraftFigures {
  totals: InvoiceTotals;
  /** The overall discount the percent asks for, in paise (Q-G7). */
  overallDiscount: number;
  /** Paid before (the ledger's) and paid now, against the bill. */
  balance: InvoiceBalance;
  paidNow: number;
}

/** The draft's totals and balance — `alreadyPaid` is what an edited invoice has received. */
export function draftFigures(
  values: Pick<InvoiceFormValues, 'items' | 'overallDiscountPct' | 'paidNow'>,
  alreadyPaid = 0,
): InvoiceDraftFigures {
  const lines = namedLines(values.items);
  const overallDiscount = overallDiscountFromPercent(
    lines,
    percentOf(values.overallDiscountPct),
  );
  const totals = invoiceTotals({ items: lines, overallDiscount });
  const paidNow = paidNowTotal(values.paidNow);
  return {
    totals,
    overallDiscount,
    balance: balanceOf(totals.bill, alreadyPaid + paidNow),
    paidNow,
  };
}

/** The write a save sends (`S:1716`, `S:1666`). */
export function invoiceInputOf(
  values: InvoiceFormValues,
  fallbackBranchId: string,
): InvoiceInput {
  const lines = namedLines(values.items);
  const party = values.party;
  return {
    type: values.type,
    branchId: values.branchId ?? fallbackBranchId,
    patientId: party?.kind === 'patient' ? party.id : null,
    medicalContactId: party?.kind === 'contact' ? party.id : null,
    leadId: party?.kind === 'lead' ? party.id : null,
    teamIds: values.teamIds,
    items: lines.map(({ batchNo: _batch, ...line }) => ({
      ...line,
      name: line.name.trim(),
    })),
    overallDiscount: overallDiscountFromPercent(
      lines,
      percentOf(values.overallDiscountPct),
    ),
    date: values.date,
    remark: values.remark.trim() || null,
    prescriptionId: values.prescriptionId,
    paidNow: paidNowSplits(values.paidNow),
  };
}
