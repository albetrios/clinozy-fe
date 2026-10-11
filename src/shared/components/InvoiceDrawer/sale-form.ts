import {
  balanceOf,
  type InvoiceBalance,
  type InvoiceTotals,
  invoiceTotals,
  overallDiscountFromPercent,
} from '@/shared/api/app/app-money.ts';
import type { InvoiceInput as SaleInput } from '@/shared/api/app/invoices-fixture-contracts.ts';

import {
  type InvoiceFormValues,
  namedLines,
  paidNowSplits,
  paidNowTotal,
  percentOf,
} from './invoice-form.ts';

/*
 * Medical's New sale in the shared drawer (`type: 'medical'`, D153 seam): the parked Medical
 * room sells on the fixture world, which prices its own lines — the medicines at MRP, the
 * overall percent before tax (Q-G7) — in paise. Its figures and its write live here, apart from
 * a clinic invoice's, which clinozy-be prices (`invoice-form.ts`).
 */

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

/** What a sale's save sends to the fixture sales server (`S:1666`). */
export function saleInputOf(
  values: InvoiceFormValues,
  fallbackBranchId: string,
): SaleInput {
  const lines = namedLines(values.items);
  const party = values.party;
  const remark = values.remark.trim();
  return {
    type: values.type,
    branchId: values.branchId ?? fallbackBranchId,
    patientId: party?.kind === 'patient' ? party.id : null,
    medicalContactId: party?.kind === 'contact' ? party.id : null,
    leadId: party?.kind === 'lead' ? party.id : null,
    teamIds: values.teamIds,
    items: lines.map((line) => ({
      offeringId: line.offeringId,
      medicineId: line.medicineId,
      name: line.name.trim(),
      packSize: line.packSize,
      qty: line.qty,
      rate: line.rate,
      discountPct: line.discountPct,
      gstPct: line.gstPct,
    })),
    overallDiscount: overallDiscountFromPercent(
      lines,
      percentOf(values.overallDiscountPct),
    ),
    date: values.date,
    remark: remark === '' ? null : remark,
    prescriptionId: values.prescriptionId,
    paidNow: paidNowSplits(values.paidNow),
  };
}
