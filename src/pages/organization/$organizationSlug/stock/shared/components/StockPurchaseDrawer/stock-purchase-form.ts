import type { FieldPath } from 'react-hook-form';

import {
  MONEY_SCALE,
  numberFromText,
  paiseOfRupees,
  rupeesOfPaise,
  textFromNumber,
} from '@/lib/number-text.ts';
import { appToday } from '@/shared/api/app/app-time.ts';

import type { StockItemRow, StockPurchaseRecord } from '../../stock-contracts.ts';
import type {
  StockPurchaseChange,
  StockPurchaseInput,
} from '../../stock-records-contracts.ts';
import { fromMilli, reorderUnits, toMilli } from '../../stock-units.ts';

/*
 * The purchase drawer's form (`clinic-stock.md:142–157`) and what it hands
 * clinozy-be: the money a member types is rupees, held as the number fields
 * hold it — a line's rate in paise, the Bill and Paid as typed text — and
 * converted to the API's rupees here. What a saved purchase owes is the
 * server's; the totals below are previews of what is being typed.
 */

/** The most lines one purchase takes (the API's `items`, 1–50). */
export const PURCHASE_LINES_MAX = 50;

/**
 * Decimals a line's quantity keeps — clinozy-be stores stock as `numeric(12,3)`,
 * so a part of a unit is bought as typed (0.75 of a bottle).
 */
export const PURCHASE_QTY_PLACES = 3;

/** The least a line can buy: the API's `quantity` is above 0, to its three places. */
export const PURCHASE_QTY_MIN = 0.001;

/** An invoice number's longest text (the API's `bill_number`). */
export const BILL_NO_MAX = 30;

/** How a new purchase's "Paid" was paid (`splits[].mode`). */
export type PurchasePaymentMode = NonNullable<StockPurchaseInput['payment']>['mode'];

/** The Mode chips, in the order the design lists them: Cash · UPI · Card. */
export const PURCHASE_PAYMENT_MODES: readonly PurchasePaymentMode[] = [
  'cash',
  'upi',
  'card',
];

/** One line of the bill: the item, how many units and the rate (paise). */
export interface PurchaseLineValues {
  itemId: string | null;
  /** Units, to `PURCHASE_QTY_PLACES` decimals — a part of one is bought as typed (0.75). */
  qty: number;
  /** Paise a unit — the money cell's unit. */
  rate: number;
  /** A saved line's amount, rupees — the server's; null on a line being typed. */
  amount: number | null;
}

/** The purchase form's values: the money fields as typed rupees. */
export interface StockPurchaseFormValues {
  vendorId: string | null;
  billNo: string;
  date: string;
  lines: PurchaseLineValues[];
  /** Bill amount as typed; empty follows the lines' total. */
  bill: string;
  /** A new purchase's "Paid", as typed — a supplier-bill payment with it. */
  paid: string;
  paidMode: PurchasePaymentMode;
  /** The branch whose money paid it; null starts on the member's default branch. */
  paidBranchId: string | null;
}

/** A blank line: "+ Add item". */
export const emptyLine = (): PurchaseLineValues => ({
  itemId: null,
  qty: 1,
  rate: 0,
  amount: null,
});

/** A line with no item yet: the quick line's next add fills it. */
export const isBlankLine = (line: PurchaseLineValues) => line.itemId === null;

/**
 * An item's line as the quick line, Browse and "Reorder low items" add it
 * (H:5276 `addL`, `clinic-stock.md:154`): the typed quantity, else what fills
 * it up to its maximum (at least one); the typed rate, else none yet — the
 * rate is asked for before the save.
 */
export function lineFor(
  item: Pick<StockItemRow, 'id' | 'qtyMilli' | 'maxQty'>,
  values: { qty?: number; rate?: number } = {},
): PurchaseLineValues {
  return {
    itemId: item.id,
    qty: values.qty ?? reorderUnits(item.qtyMilli, item.maxQty),
    rate: values.rate ?? 0,
    amount: null,
  };
}

/** A line's amount, paise: a saved line's as the server worked it out, else quantity × rate. */
export function lineAmount(line: PurchaseLineValues): number {
  if (line.amount !== null) return paiseOfRupees(line.amount);
  return line.itemId ? Math.round(line.qty * line.rate) : 0;
}

/** The lines' total, paise. */
export const linesTotal = (lines: readonly PurchaseLineValues[]) =>
  lines.reduce((sum, line) => sum + lineAmount(line), 0);

/** The bill, paise: as typed, or the lines' total when nothing is (`clinic-stock.md:150`). */
export const billOf = (values: Pick<StockPurchaseFormValues, 'bill' | 'lines'>) =>
  values.bill.trim()
    ? numberFromText(values.bill, MONEY_SCALE)
    : linesTotal(values.lines);

/** What a new purchase's "Paid" pays, paise. */
export const paidOf = (values: Pick<StockPurchaseFormValues, 'paid'>) =>
  numberFromText(values.paid, MONEY_SCALE);

/**
 * "Reorder low items" (`clinic-stock.md:154`; H:5274): every item at or below
 * its minimum, ordered up to its maximum — at least one — the rates to fill.
 */
export function reorderLines(items: readonly StockItemRow[]): PurchaseLineValues[] {
  return items.filter((item) => item.level !== 'ok').map((item) => lineFor(item));
}

/** A new purchase: today's bill, nothing in it yet, paid in cash (`clinic-stock.md:148`). */
export function newPurchaseForm(
  lines: PurchaseLineValues[] = [],
): StockPurchaseFormValues {
  return {
    vendorId: null,
    billNo: '',
    date: appToday(),
    lines,
    bill: '',
    paid: '',
    paidMode: 'cash',
    paidBranchId: null,
  };
}

/** A saved purchase's form: its lines as received, its bill as the number field shows it. */
export function purchaseFormOf(purchase: StockPurchaseRecord): StockPurchaseFormValues {
  return {
    ...newPurchaseForm(),
    vendorId: purchase.vendorId,
    billNo: purchase.billNo ?? '',
    date: purchase.date,
    lines: purchase.lines.map((line) => ({
      itemId: line.itemId,
      qty: fromMilli(line.qtyMilli),
      rate: paiseOfRupees(line.rate),
      amount: line.amount,
    })),
    bill: textFromNumber(paiseOfRupees(purchase.bill), MONEY_SCALE),
  };
}

/** A line with its item picked. */
const isPicked = (
  line: PurchaseLineValues,
): line is PurchaseLineValues & { itemId: string } => line.itemId !== null;

/** The lines with an item, each with its row in the form — what a save sends, in order. */
function pickedLines(lines: readonly PurchaseLineValues[]) {
  return lines.flatMap((line, row) => (isPicked(line) ? [{ line, row }] : []));
}

/** How many lines have an item. */
export const pickedCount = (lines: readonly PurchaseLineValues[]) =>
  pickedLines(lines).length;

/** The indexes of lines with an item but no rate ("Enter the rate", validated before save, §7.3). */
export const linesMissingRate = (lines: readonly PurchaseLineValues[]) =>
  pickedLines(lines).flatMap(({ line, row }) => (line.rate <= 0 ? [row] : []));

/** Typed text without its outer spaces, or null when nothing is left. */
function textOrNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * A new purchase for the API: the lines with an item (×1000, rates in rupees),
 * the typed bill (none follows the lines' total) and — when the member may
 * pay (`payment:create`) and typed an amount — "Paid" from `branchId`, the
 * picked branch or the member's default one.
 */
export function purchaseInputOf(
  values: StockPurchaseFormValues,
  payment: { branchId: string | null } | null,
): StockPurchaseInput {
  const paid = paidOf(values);
  const branchId = values.paidBranchId ?? payment?.branchId ?? null;
  return {
    vendorId: values.vendorId ?? '',
    billNo: textOrNull(values.billNo),
    date: values.date,
    lines: pickedLines(values.lines).map(({ line }) => ({
      itemId: line.itemId,
      qtyMilli: toMilli(line.qty),
      rate: rupeesOfPaise(line.rate),
    })),
    bill: values.bill.trim() ? rupeesOfPaise(billOf(values)) : null,
    payment:
      payment && paid > 0 && branchId
        ? { branchId, mode: values.paidMode, amount: rupeesOfPaise(paid) }
        : null,
  };
}

/** An edit for the API: the bill's details — its lines stay as received. */
export function purchaseChangeOf(values: StockPurchaseFormValues): StockPurchaseChange {
  return {
    vendorId: values.vendorId ?? '',
    billNo: textOrNull(values.billNo),
    date: values.date,
    bill: rupeesOfPaise(billOf(values)),
  };
}

/** A field of the purchase form. */
type PurchaseField = FieldPath<StockPurchaseFormValues>;

/** The API's bill fields (as the shared mapper names them) by the form's. */
const BILL_SERVER_FIELDS: Readonly<Record<string, PurchaseField>> = {
  stockVendorId: 'vendorId',
  billNumber: 'billNo',
  purchaseDate: 'date',
  billAmount: 'bill',
  items: 'lines',
  payment: 'paid',
  'payment.splits': 'paid',
  'payment.splits.0': 'paid',
  'payment.splits.0.amount': 'paid',
  'payment.splits.0.mode': 'paidMode',
  'payment.branchId': 'paidBranchId',
};

/**
 * The API's fields by the form's for a save of these lines: the bill's, and
 * each sent line (`items.0.rate`) on its row in the form (`lines.2.rate`) —
 * the lines without an item are not sent, so the two counts differ.
 */
export function purchaseServerFields(
  lines: readonly PurchaseLineValues[],
): Record<string, PurchaseField> {
  const fields: Record<string, PurchaseField> = { ...BILL_SERVER_FIELDS };
  pickedLines(lines).forEach(({ row }, sent) => {
    fields[`items.${sent}`] = `lines.${row}.itemId`;
    fields[`items.${sent}.stockItemId`] = `lines.${row}.itemId`;
    fields[`items.${sent}.quantity`] = `lines.${row}.qty`;
    fields[`items.${sent}.rate`] = `lines.${row}.rate`;
  });
  return fields;
}

/** The form's fields in the drawer's order — a refused save opens the first one it names. */
export function purchaseFieldOrder(
  lines: readonly PurchaseLineValues[],
): PurchaseField[] {
  const lineFields = lines.flatMap((_line, row): PurchaseField[] => [
    `lines.${row}.itemId`,
    `lines.${row}.qty`,
    `lines.${row}.rate`,
  ]);
  return [
    'vendorId',
    'billNo',
    'date',
    ...lineFields,
    'lines',
    'bill',
    'paid',
    'paidMode',
    'paidBranchId',
  ];
}
