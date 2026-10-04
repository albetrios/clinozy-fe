import { MONEY_SCALE, numberFromText, textFromNumber } from '@/lib/number-text.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';

import type { StockItemRow, StockPurchaseRow } from '../../stock-contracts.ts';
import type { StockPurchaseInput } from '../../stock-records-contracts.ts';
import { MILLI, reorderUnits } from '../../stock-units.ts';

/** One line of the bill: the item, how many units and the rate (paise). */
export interface PurchaseLineValues {
  itemId: string | null;
  qty: number;
  rate: number;
}

/** The purchase form's values: the money fields as typed rupees. */
export interface StockPurchaseFormValues {
  vendorId: string | null;
  billNo: string;
  date: string;
  lines: PurchaseLineValues[];
  /** Bill amount as typed; empty follows the lines' total. */
  bill: string;
  /** Paid as typed. */
  paid: string;
}

/** A blank line: "+ Add item". */
export const emptyLine = (): PurchaseLineValues => ({ itemId: null, qty: 1, rate: 0 });

/** The lines' total, paise. */
export const linesTotal = (lines: readonly PurchaseLineValues[]) =>
  lines.reduce((sum, line) => sum + (line.itemId ? line.qty * line.rate : 0), 0);

/** The bill: as typed, or the lines' total when nothing is (`clinic-stock.md:150`). */
export const billOf = (values: Pick<StockPurchaseFormValues, 'bill' | 'lines'>) =>
  values.bill.trim()
    ? numberFromText(values.bill, MONEY_SCALE)
    : linesTotal(values.lines);

/** What is still due on the form's bill. */
export const dueOf = (values: StockPurchaseFormValues) =>
  Math.max(0, billOf(values) - numberFromText(values.paid, MONEY_SCALE));

/**
 * "Reorder low items" (`clinic-stock.md:154`; H:5274): every item at or below
 * its minimum, ordered up to its maximum — at least one — the rates to fill.
 */
export function reorderLines(items: readonly StockItemRow[]): PurchaseLineValues[] {
  return items
    .filter((item) => item.level !== 'ok')
    .map((item) => ({
      itemId: item.id,
      qty: reorderUnits(item.qtyMilli, item.maxQty),
      rate: 0,
    }));
}

/** A new purchase: today's bill, nothing in it yet (`clinic-stock.md:148`). */
export function newPurchaseForm(
  lines: PurchaseLineValues[] = [],
): StockPurchaseFormValues {
  return { vendorId: null, billNo: '', date: clinicToday(), lines, bill: '', paid: '' };
}

/** A saved purchase's form. */
export function purchaseFormOf(purchase: StockPurchaseRow): StockPurchaseFormValues {
  return {
    vendorId: purchase.vendorId,
    billNo: purchase.billNo ?? '',
    date: purchase.date,
    lines: purchase.lines.map((line) => ({
      itemId: line.itemId,
      qty: Math.max(1, Math.round(line.qtyMilli / MILLI)),
      rate: line.rate,
    })),
    bill: textFromNumber(purchase.bill, MONEY_SCALE),
    paid: textFromNumber(purchase.paid, MONEY_SCALE),
  };
}

/** The indexes of lines with an item but no rate ("Enter the rate", validated before save, §7.3). */
export const linesMissingRate = (lines: readonly PurchaseLineValues[]) =>
  lines.flatMap((line, index) => (line.itemId && line.rate <= 0 ? [index] : []));

/** The contract's fields for a form; lines without an item are left out. */
export function purchaseInputOf(values: StockPurchaseFormValues): StockPurchaseInput {
  const lines = values.lines.filter(
    (line): line is PurchaseLineValues & { itemId: string } => line.itemId !== null,
  );
  return {
    vendorId: values.vendorId ?? '',
    billNo: values.billNo.trim() || null,
    date: values.date,
    lines: lines.map((line) => ({
      itemId: line.itemId,
      qtyMilli: line.qty * MILLI,
      rate: line.rate,
    })),
    bill: billOf(values),
    paid: numberFromText(values.paid, MONEY_SCALE),
  };
}
