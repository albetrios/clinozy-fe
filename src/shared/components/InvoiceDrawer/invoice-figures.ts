import { paiseOfRupees } from '@/lib/number-text.ts';
import type { InvoicePreview } from '@/shared/api/app/invoices-contracts.ts';

import type { SaleDraftFigures } from './sale-form.ts';

/*
 * The figures the drawer shows — the badges, the totals above the footer, "Paid now" and its
 * presets — in one shape for both modes, in paise like the form's money fields. An invoice's
 * are the server's preview of the save (D81 Q2), never worked out here; a Medical sale's are
 * the fixture world's own.
 */

/**
 * Where the figures stand: `ready` — what the save will write; `pending` — the preview is being
 * worked out (the last one shows meanwhile); `empty` — nothing billed yet; `refused` — a line the
 * server refuses (under its lowest price); `failed` — the preview could not be read.
 */
export type InvoiceFiguresStatus = 'empty' | 'pending' | 'ready' | 'refused' | 'failed';

/** The drawer's figures, in paise. */
export interface InvoiceFigures {
  status: InvoiceFiguresStatus;
  subtotal: number;
  /** Line discounts and the overall discount. */
  discount: number;
  gst: number;
  /** What the invoice bills. */
  bill: number;
  /** What an edited invoice has already received. */
  paidBefore: number;
  /** "Paid now" as typed. */
  paidNow: number;
  /** What is left once "Paid now" lands — what the bill still needs before it. */
  dueBefore: number;
  /** What is still due after this save. */
  due: number;
}

/** A Medical sale's figures, from the fixture world's own sums. */
export function saleFigures(figures: SaleDraftFigures): InvoiceFigures {
  const { totals, balance } = figures;
  return {
    status: 'ready',
    subtotal: Math.round(totals.subtotal),
    discount: Math.round(totals.lineDiscount + totals.overallDiscount),
    gst: Math.round(totals.gst),
    bill: totals.bill,
    paidBefore: 0,
    paidNow: figures.paidNow,
    dueBefore: totals.bill,
    due: balance.due,
  };
}

/**
 * An invoice's figures from the server's preview — `null` before the first answer — with "Paid
 * now" as typed (paise): what is due after it is the preview's due less it, never below 0.
 */
export function previewFigures({
  preview,
  status,
  paidNow,
  paidBefore,
}: {
  preview: InvoicePreview | null;
  status: InvoiceFiguresStatus;
  paidNow: number;
  /** What a saved invoice has received, until the preview says. */
  paidBefore: number;
}): InvoiceFigures {
  if (!preview) {
    return {
      status,
      subtotal: 0,
      discount: 0,
      gst: 0,
      bill: 0,
      paidBefore,
      paidNow,
      dueBefore: 0,
      due: 0,
    };
  }
  const dueBefore = paiseOfRupees(preview.due);
  return {
    status,
    subtotal: paiseOfRupees(preview.subtotal),
    discount: paiseOfRupees(preview.discountTotal),
    gst: paiseOfRupees(preview.gstTotal),
    bill: paiseOfRupees(preview.total),
    paidBefore: paiseOfRupees(preview.paid),
    paidNow,
    dueBefore,
    due: Math.max(0, dueBefore - paidNow),
  };
}
