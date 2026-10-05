import { expiryMonthSchema } from '@/shared/api/clinic/clinic-schema.ts';

import type { PurchaseOrderRow } from '../../../shared/medical-contracts.ts';
import type { ReceiveInput } from '../../../shared/medical-flows-contracts.ts';

/*
 * Receive goods' form (`medical.md:269–279`) — pure, so the drawer and its
 * check read one set of rules.
 */

/** One ordered line: whether it arrived, and the batch and expiry it came with. */
export interface ReceiveLineValues {
  name: string;
  qty: number;
  free: number;
  arrived: boolean;
  batchNo: string;
  /** "MM/YY". */
  expiry: string;
}

/** The drawer's form. */
export interface ReceiveFormValues {
  lines: ReceiveLineValues[];
}

/** Every line of the order, ticked as arrived, with no batch or expiry yet. */
export function receiveFormOf(order: PurchaseOrderRow): ReceiveFormValues {
  return {
    lines: order.items.map((item, index) => ({
      name: order.itemNames[index] ?? '',
      qty: item.qty,
      free: item.free,
      arrived: true,
      batchNo: '',
      expiry: '',
    })),
  };
}

/** What is wrong with an arrived line's expiry: none typed, or not "MM/YY". */
export type ExpiryProblem = 'missing' | 'invalid';

/** One arrived line's expiry problem. */
export interface LineExpiryProblem {
  index: number;
  problem: ExpiryProblem;
}

/** Each arrived line's expiry problem, by index (AMBER: an arrived line needs its expiry). */
export function expiryProblems(lines: readonly ReceiveLineValues[]): LineExpiryProblem[] {
  return lines.flatMap((line, index): LineExpiryProblem[] => {
    if (!line.arrived) return [];
    const expiry = line.expiry.trim();
    if (!expiry) return [{ index, problem: 'missing' }];
    return expiryMonthSchema.safeParse(expiry).success
      ? []
      : [{ index, problem: 'invalid' }];
  });
}

/** Whether anything arrived. */
export const anyArrived = (lines: readonly ReceiveLineValues[]) =>
  lines.some((line) => line.arrived);

/** The contract's fields: every line in the order's order; an empty batch is the server's "NEW-<seq>". */
export function receiveInputOf(values: ReceiveFormValues): ReceiveInput {
  return {
    lines: values.lines.map((line) => ({
      arrived: line.arrived,
      batchNo: line.arrived ? line.batchNo.trim() || null : null,
      expiry: line.arrived ? line.expiry.trim() || null : null,
    })),
  };
}
