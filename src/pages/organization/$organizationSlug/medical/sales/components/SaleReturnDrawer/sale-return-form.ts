import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';

import type { SaleRow } from '../../../shared/medical-contracts.ts';
import type {
  RefundMode,
  SaleReturnInput,
  SaleReturnReason,
} from '../../../shared/medical-flows-contracts.ts';

/*
 * Return from patient's form (`medical.md:283–295`) — pure, so the drawer, its
 * steps' heads, its Save label and its check read one set of rules.
 */

/** One sold line that can come back: what is left of it and its price per unit. */
export interface ReturnLineValues {
  medicineId: string;
  batchNo: string;
  name: string;
  /** Units still with the patient: sold less what came back before. */
  sold: number;
  /** The line's net price per unit, paise. */
  unit: number;
  /** Units coming back (0 – sold). */
  qty: number;
}

/** The drawer's form. */
export interface SaleReturnFormValues {
  lines: ReturnLineValues[];
  reason: SaleReturnReason;
  mode: RefundMode;
}

/** Each reason chip's tone (AMBER: the source draws them untoned). */
export const RETURN_REASON_TONES: Readonly<Record<SaleReturnReason, Tone>> = {
  unused: 'sage',
  reaction: 'blush',
  rx_changed: 'sky',
  wrong_item: 'butter',
  damaged: 'lav',
};

/** How many of a sold line came back already. */
function returnedOf(sale: Pick<SaleRow, 'returns'>, medicineId: string, batchNo: string) {
  return sale.returns
    .flatMap((back) => back.items)
    .filter((item) => item.medicineId === medicineId && item.batchNo === batchNo)
    .reduce((sum, item) => sum + item.qty, 0);
}

/**
 * The form a sale opens with: every sold line with a medicine and a batch, with
 * what is still out — nothing coming back yet — the reason "Unused" and the
 * refund in Cash (`medical.md:288–290`).
 */
export function saleReturnFormOf(
  sale: Pick<SaleRow, 'lines' | 'returns'>,
): SaleReturnFormValues {
  const lines = sale.lines.flatMap((line) => {
    if (!(line.medicineId && line.batchNo) || line.qty <= 0) return [];
    const sold = line.qty - returnedOf(sale, line.medicineId, line.batchNo);
    if (sold <= 0) return [];
    return [
      {
        medicineId: line.medicineId,
        batchNo: line.batchNo,
        name: line.name,
        sold,
        unit: line.amount / line.qty,
        qty: 0,
      },
    ];
  });
  return { lines, reason: 'unused', mode: 'cash' };
}

/** What one line refunds, paise. */
export const lineRefund = (line: Pick<ReturnLineValues, 'unit' | 'qty'>) =>
  Math.round(line.unit * line.qty);

/** What the return is worth: Σ each line's refund, paise. */
export const returnAmount = (lines: readonly ReturnLineValues[]) =>
  lines.reduce((sum, line) => sum + lineRefund(line), 0);

/** The lines with something coming back. */
export const linesBack = (lines: readonly ReturnLineValues[]) =>
  lines.filter((line) => line.qty > 0);

/** "⚡ Return everything": every line back in full. */
export const everythingBack = (lines: readonly ReturnLineValues[]) =>
  lines.map((line) => ({ ...line, qty: line.sold }));

/** The contract's fields for a form; untouched lines are left out. */
export function saleReturnInputOf(values: SaleReturnFormValues): SaleReturnInput {
  return {
    lines: linesBack(values.lines).map((line) => ({
      medicineId: line.medicineId,
      batchNo: line.batchNo,
      qty: line.qty,
    })),
    reason: values.reason,
    mode: values.mode,
  };
}
