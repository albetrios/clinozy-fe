import { purchaseOrderTotal } from '@/shared/api/clinic/clinic-money.ts';
import { expiryMonthSchema } from '@/shared/api/clinic/clinic-schema.ts';

import type { PurchaseOrderRow } from '../../../shared/medical-contracts.ts';
import type { ReceiveInput } from '../../../shared/medical-flows-contracts.ts';

/*
 * Receive goods' form (`medical.md:269–279`) — pure, so the drawer and its
 * check read one set of rules.
 */

/**
 * One line: an ordered one — whether it arrived, and the batch and expiry it
 * came with — or one "+ Add unexpected item" adds (H:5388), whose medicine,
 * counts and rate are typed here.
 */
export interface ReceiveLineValues {
  /** The ordered line's medicine; an unexpected line's once picked. */
  medicineId: string | null;
  name: string;
  qty: number;
  free: number;
  /** The purchase rate per unit, paise — the order's on an ordered line. */
  rate: number;
  arrived: boolean;
  batchNo: string;
  /** "MM/YY". */
  expiry: string;
  /** Not on the order: it came anyway ("+ Add unexpected item"). */
  unexpected: boolean;
}

/** The drawer's form: the order's lines in its order, then the unexpected ones. */
export interface ReceiveFormValues {
  lines: ReceiveLineValues[];
}

/** Every line of the order, ticked as arrived, with no batch or expiry yet. */
export function receiveFormOf(order: PurchaseOrderRow): ReceiveFormValues {
  return {
    lines: order.items.map((item, index) => ({
      medicineId: item.medicineId,
      name: order.itemNames[index] ?? '',
      qty: item.qty,
      free: item.free,
      rate: item.rate,
      arrived: true,
      batchNo: '',
      expiry: '',
      unexpected: false,
    })),
  };
}

/** "+ Add unexpected item": a line with no medicine yet, one unit, arrived. */
export const emptyUnexpectedLine = (): ReceiveLineValues => ({
  medicineId: null,
  name: '',
  qty: 1,
  free: 0,
  rate: 0,
  arrived: true,
  batchNo: '',
  expiry: '',
  unexpected: true,
});

/**
 * A line that comes into stock: an ordered one ticked ✓, an unexpected one
 * ticked ✓ with its medicine picked — one left blank is not sent, as an
 * order's blank line is not.
 */
const comesIn = (line: ReceiveLineValues) =>
  line.arrived && (!line.unexpected || line.medicineId !== null);

/** What is wrong with an arrived line's expiry: none typed, or not "MM/YY". */
type ExpiryProblem = 'missing' | 'invalid';

/** One arrived line's expiry problem. */
export interface LineExpiryProblem {
  index: number;
  problem: ExpiryProblem;
}

/** Each arrived line's expiry problem, by index (AMBER: an arrived line needs its expiry). */
export function expiryProblems(lines: readonly ReceiveLineValues[]): LineExpiryProblem[] {
  return lines.flatMap((line, index): LineExpiryProblem[] => {
    if (!comesIn(line)) return [];
    const expiry = line.expiry.trim();
    if (!expiry) return [{ index, problem: 'missing' }];
    return expiryMonthSchema.safeParse(expiry).success
      ? []
      : [{ index, problem: 'invalid' }];
  });
}

/** The indexes of the unexpected lines coming in that a check names: no count, or no rate. */
export function unexpectedProblems(lines: readonly ReceiveLineValues[]): {
  qty: number[];
  rate: number[];
} {
  const coming = lines.flatMap((line, index) =>
    line.unexpected && comesIn(line) ? [{ line, index }] : [],
  );
  return {
    qty: coming.filter(({ line }) => line.qty < 1).map(({ index }) => index),
    rate: coming.filter(({ line }) => line.rate <= 0).map(({ index }) => index),
  };
}

/** Whether anything arrived. */
export const anyArrived = (lines: readonly ReceiveLineValues[]) => lines.some(comesIn);

/** The lines the badge counts ("2 items", H:5394): the order's and each unexpected one coming in. */
export const receiveLineCount = (lines: readonly ReceiveLineValues[]) =>
  lines.filter((line) => !line.unexpected || comesIn(line)).length;

/**
 * The bill once received (the summary, `medical.md:277`): the order's total
 * and each unexpected line coming in, qty × rate — free units cost nothing.
 */
export function receiveTotal(
  order: Pick<PurchaseOrderRow, 'total'>,
  lines: readonly ReceiveLineValues[],
): number {
  return (
    order.total +
    purchaseOrderTotal(lines.filter((line) => line.unexpected && comesIn(line)))
  );
}

/**
 * The contract's fields: every ordered line in the order's order — an empty
 * batch is the server's "NEW-<seq>" — and each unexpected line coming in.
 */
export function receiveInputOf(values: ReceiveFormValues): ReceiveInput {
  const trimmed = (text: string) => text.trim() || null;
  return {
    lines: values.lines
      .filter((line) => !line.unexpected)
      .map((line) => ({
        arrived: line.arrived,
        batchNo: line.arrived ? trimmed(line.batchNo) : null,
        expiry: line.arrived ? trimmed(line.expiry) : null,
      })),
    extras: values.lines
      .filter((line) => line.unexpected && comesIn(line))
      .map((line) => ({
        medicineId: line.medicineId ?? '',
        qty: line.qty,
        free: line.free,
        rate: line.rate,
        batchNo: trimmed(line.batchNo),
        expiry: trimmed(line.expiry),
      })),
  };
}
