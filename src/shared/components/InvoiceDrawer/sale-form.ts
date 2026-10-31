import { rupeesOfPaise } from '@/lib/number-text.ts';
import {
  balanceOf,
  type InvoiceBalance,
  type InvoiceTotals,
  invoiceTotals,
  overallDiscountFromPercent,
} from '@/shared/api/app/app-money.ts';
import type { MoneySplit } from '@/shared/api/app/payments-contracts.ts';
import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';

import {
  type InvoiceFormValues,
  namedLines,
  paidNowMoney,
  paidNowTotal,
  percentOf,
} from './invoice-form.ts';

/*
 * Medical's New sale in the shared drawer (`type: 'medical'`): the Medical room writes it
 * (`POST /app/medical-sales`, handed in as {@link InvoiceSaleWrite} — shared code reads no
 * room). The server draws each medicine from its batches by earliest expiry and prices it; the
 * drawer's own sums — the medicines at MRP, the overall percent before tax (Q-G7), in paise like
 * every form's money — are a guide until the sale is saved. No rate, free line or sale date is
 * sent (MD19).
 */

/**
 * The id a new customer carries until the sale saves their contact ("Add contact “q”") — not a
 * record id, so nothing reads it as one.
 */
export const NEW_CUSTOMER_ID = 'new-customer';

/** A sale's figures: the totals, and the balance once "Paid now" lands. */
export interface SaleDraftFigures {
  totals: InvoiceTotals;
  /** The overall discount the percent asks for, in paise (Q-G7). */
  overallDiscount: number;
  balance: InvoiceBalance;
  paidNow: number;
}

/** A sale's totals and balance, from its rows. */
export function draftFigures(
  values: Pick<InvoiceFormValues, 'items' | 'overallDiscountPct' | 'paidNow'>,
): SaleDraftFigures {
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
    balance: balanceOf(totals.bill, paidNow),
    paidNow,
  };
}

/**
 * A sale as the drawer hands the Medical room's write: the branch, the buyer's contact, each
 * medicine with its quantity and discount, the overall discount (rupees), the team, the
 * prescription it fills, the remark and "Paid now" (rupees).
 */
export interface SaleDraft {
  branchId: string;
  /** The buyer's contact (`con_…`). */
  contactId: string;
  /** Each medicine once; its description lands on every batch line it draws. */
  items: {
    medicineId: string;
    qty: number;
    discountPct: number;
    description: string | null;
  }[];
  /** Off the whole bill, rupees. */
  overallDiscount: number;
  memberIds: string[];
  prescriptionId: string | null;
  remark: string | null;
  payment: { splits: MoneySplit[] } | null;
}

/** What a written sale answers the drawer: its invoice, and the number its toast names. */
export interface SaleDraftOutcome {
  invoiceId: string;
  seq: number;
}

/** Medical's New sale: the room's write, handed in (`POST /app/medical-sales`). */
export interface InvoiceSaleWrite {
  create: (draft: SaleDraft) => Promise<SaleDraftOutcome>;
}

/**
 * The sale's lines, one per medicine — clinozy-be takes each medicine once (`eachMedicineOnce`),
 * while the quick line, Browse and a prescription can each add a medicine's row again. Rows of
 * one medicine add up their packs; their discount is the packs-weighted one, so the bill stays
 * what the rows showed; their description is the first one typed (trimmed), none when none is.
 */
function oneLinePerMedicine(
  lines: readonly {
    medicineId: string | null;
    qty: number;
    discountPct: number;
    description: string;
  }[],
): SaleDraft['items'] {
  const merged = new Map<
    string,
    { qty: number; discounted: number; description: string | null }
  >();
  for (const line of lines) {
    if (!line.medicineId) continue;
    const held = merged.get(line.medicineId) ?? {
      qty: 0,
      discounted: 0,
      description: null,
    };
    merged.set(line.medicineId, {
      qty: held.qty + line.qty,
      discounted: held.discounted + line.qty * line.discountPct,
      description: held.description ?? (line.description.trim() || null),
    });
  }
  return [...merged].map(([medicineId, { qty, discounted, description }]) => ({
    medicineId,
    qty,
    discountPct: qty > 0 ? Math.round((discounted / qty) * 100) / 100 : 0,
    description,
  }));
}

/** What a sale's save hands the room's write, for the buyer's contact. */
export function saleDraftOf(
  values: InvoiceFormValues,
  { contactId, fallbackBranchId }: { contactId: string; fallbackBranchId: string },
): SaleDraft {
  const lines = namedLines(values.items);
  const remark = values.remark.trim();
  const splits = paidNowMoney(values.paidNow);
  return {
    branchId: values.branchId ?? fallbackBranchId,
    contactId,
    items: oneLinePerMedicine(lines),
    overallDiscount: rupeesOfPaise(
      overallDiscountFromPercent(lines, percentOf(values.overallDiscountPct)),
    ),
    memberIds: values.teamIds,
    prescriptionId: values.prescriptionId,
    remark: remark === '' ? null : remark,
    payment: splits.length > 0 ? { splits } : null,
  };
}

/** A prescription as a sale fills it: its number, its patient and its medicines. */
export interface SalePrescription {
  id: string;
  seq: number;
  /** The patient it was written for — a sale from it bills them. */
  patientId: string;
  medicines: { medicineId: string | null; name: string; qty: number }[];
}

/** A patient's prescription (clinozy-be's) as a sale reads it. */
export function salePrescriptionOf(record: PrescriptionRecord): SalePrescription {
  return {
    id: record.id,
    seq: record.seq,
    patientId: record.patientId,
    medicines: record.items.map((item) => ({
      medicineId: item.medicineId,
      name: item.medicineName,
      qty: Math.max(1, item.qty),
    })),
  };
}
