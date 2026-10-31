import { paiseOfRupees, rupeesOfPaise } from '@/lib/number-text.ts';
import { expiryMonthSchema } from '@/shared/api/app/app-schema.ts';

import type { PurchaseOrderRow } from '../../../shared/medical-contracts.ts';
import type { ReceiveInput } from '../../../shared/medical-records-contracts.ts';
import {
  orderLineInputOf,
  typedMedicineName,
} from '../PurchaseOrderDrawer/purchase-order-form.ts';

/*
 * Receive goods' form (`medical.md:269–279`) — pure, so the drawer and its
 * check read one set of rules. An unexpected line's rate is paise, the money
 * cell's unit, sent as the API's rupees; an ordered line is sent by its id.
 */

/**
 * One line: an ordered one — whether it arrived, and the batch and expiry it
 * came with — or one "+ Add unexpected item" adds (H:5388), whose medicine,
 * counts and rate are typed here.
 */
export interface ReceiveLineValues {
  /** The ordered line's id (`mpoi_…`); none on an unexpected one. */
  lineId: string | null;
  /** The ordered line's medicine; an unexpected line's once picked — or a typed one's key. */
  medicineId: string | null;
  name: string;
  qty: number;
  free: number;
  /** The purchase rate per unit, paise — the order's on an ordered line. */
  rate: number;
  /** The MRP printed on the packs, paise — the order line's until changed; 0 when not known (D8). */
  mrp: number;
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
  /** The order's note, written as the goods arrive (D10). */
  note: string;
}

/** Every line of the order, ticked as arrived, with no batch or expiry yet. */
export function receiveFormOf(order: PurchaseOrderRow): ReceiveFormValues {
  return {
    lines: order.lines.map((line) => ({
      lineId: line.id,
      medicineId: line.medicineId,
      name: line.medicineName,
      qty: line.qty,
      free: line.free,
      rate: paiseOfRupees(line.rate),
      mrp: paiseOfRupees(line.mrp ?? 0),
      arrived: true,
      batchNo: '',
      expiry: '',
      unexpected: false,
    })),
    note: order.note ?? '',
  };
}

/**
 * The ordered lines whose MRP starts at their medicine's (F5), paise: a line the order gave no MRP
 * takes the medicine's current one, so the batch it goes into records the price printed on it. A
 * line with an MRP, an unexpected line and a medicine not in the catalogue keep what they have.
 */
export function medicineMrpPrefills(
  lines: readonly ReceiveLineValues[],
  mrpOf: (medicineId: string) => number | undefined,
): { index: number; mrp: number }[] {
  return lines.flatMap((line, index) => {
    if (line.unexpected || line.mrp > 0 || !line.medicineId) return [];
    const mrp = paiseOfRupees(mrpOf(line.medicineId) ?? 0);
    return mrp > 0 ? [{ index, mrp }] : [];
  });
}

/** "+ Add unexpected item": a line with no medicine yet, one unit, arrived. */
export const emptyUnexpectedLine = (): ReceiveLineValues => ({
  lineId: null,
  medicineId: null,
  name: '',
  qty: 1,
  free: 0,
  rate: 0,
  mrp: 0,
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
 * The bill once received (the summary, `medical.md:277`), paise: the order's
 * total and each unexpected line coming in, qty × rate — free units cost
 * nothing. A preview: the server bills the receipt.
 */
export function receiveTotal(
  order: Pick<PurchaseOrderRow, 'total'>,
  lines: readonly ReceiveLineValues[],
): number {
  return lines
    .filter((line) => line.unexpected && comesIn(line))
    .reduce(
      (sum, line) => sum + Math.round(line.qty * line.rate),
      paiseOfRupees(order.total),
    );
}

/** A line's medicine as the checks name it: its name, or a typed one's. */
export function receiveLineName(
  line: Pick<ReceiveLineValues, 'name' | 'medicineId'>,
): string | undefined {
  if (line.name) return line.name;
  return typedMedicineName(line.medicineId) ?? undefined;
}

/**
 * The contract's fields: every ordered line by its id — an empty batch is the
 * server's "NEW-<seq>" — and each unexpected line coming in as `extras`, sent
 * without an id (MD26): its medicine, or a typed one's name for the server to
 * add, and its rate in rupees.
 */
export function receiveInputOf(values: ReceiveFormValues): ReceiveInput {
  const trimmed = (text: string) => text.trim() || null;
  return {
    lines: values.lines
      .filter((line) => !line.unexpected)
      .map((line) => ({
        id: line.lineId ?? '',
        arrived: line.arrived,
        batchNo: line.arrived ? trimmed(line.batchNo) : null,
        expiry: line.arrived ? trimmed(line.expiry) : null,
        mrp: line.arrived && line.mrp > 0 ? rupeesOfPaise(line.mrp) : null,
      })),
    extras: values.lines
      .filter((line) => line.unexpected && comesIn(line))
      .map((line) => ({
        ...orderLineInputOf(line),
        batchNo: trimmed(line.batchNo),
        expiry: trimmed(line.expiry),
      })),
    note: trimmed(values.note),
  };
}
