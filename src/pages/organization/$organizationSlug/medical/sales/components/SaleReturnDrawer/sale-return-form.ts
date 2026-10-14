import { paiseOfRupees } from '@/lib/number-text.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';

import type {
  RefundMode,
  SaleReturnReason,
  SaleRow,
} from '../../../shared/medical-contracts.ts';
import type { SaleReturnInput } from '../../../shared/medical-records-contracts.ts';

/*
 * Return from patient's form (`medical.md:283–295`) — pure, so the drawer, its
 * steps' heads, its Save label and its check read one set of rules. Its money
 * is paise, as every form's (W0): a line's price per unit is the API's line
 * amount over its quantity; the server works out the return's own figures.
 */

/** One sold line that can come back: what is still out of it and its price per unit. */
export interface ReturnLineValues {
  /** The sale's invoice line (`iitm_…`) — what the return names. */
  invoiceItemId: string;
  name: string;
  batchNo: string | null;
  /** Units still with the customer: sold less what the server counts as back already. */
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
  doctor_changed: 'sky',
  wrong_item: 'butter',
  damaged: 'lav',
};

/**
 * The form a sale opens with: every sold line with something still out — the
 * server's `returned_quantity` taken off — nothing coming back yet, the reason
 * "Unused" and the refund in Cash (`medical.md:288–290`).
 */
export function saleReturnFormOf(sale: Pick<SaleRow, 'lines'>): SaleReturnFormValues {
  const lines = sale.lines.flatMap((line) => {
    const sold = line.qty - line.returnedQty;
    if (sold <= 0) return [];
    return [
      {
        invoiceItemId: line.invoiceItemId,
        name: line.name,
        batchNo: line.batchNo,
        sold,
        unit: paiseOfRupees(line.amount) / line.qty,
        qty: 0,
      },
    ];
  });
  return { lines, reason: 'unused', mode: 'cash' };
}

/** What one line refunds, paise. */
export const lineRefund = (line: Pick<ReturnLineValues, 'unit' | 'qty'>) =>
  Math.round(line.unit * line.qty);

/** What the return is worth: Σ each line's refund, paise — the server's figure replaces it. */
export const returnAmount = (lines: readonly ReturnLineValues[]) =>
  lines.reduce((sum, line) => sum + lineRefund(line), 0);

/** The lines with something coming back. */
export const linesBack = (lines: readonly ReturnLineValues[]) =>
  lines.filter((line) => line.qty > 0);

/** "⚡ Return everything": every line back in full. */
export const everythingBack = (lines: readonly ReturnLineValues[]) =>
  lines.map((line) => ({ ...line, qty: line.sold }));

/** The return as `useReturnSale` takes it: the lines coming back by their invoice line, no note. */
export function saleReturnInputOf(values: SaleReturnFormValues): SaleReturnInput {
  return {
    lines: linesBack(values.lines).map((line) => ({
      invoiceItemId: line.invoiceItemId,
      qty: line.qty,
    })),
    reason: values.reason,
    mode: values.mode,
    note: null,
  };
}
