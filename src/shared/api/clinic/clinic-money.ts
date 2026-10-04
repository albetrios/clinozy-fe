import type {
  Invoice,
  InvoiceItem,
  Payment,
  PaymentMode,
} from '@/shared/api/clinic/clinic-schema.ts';

/**
 * The clinic money module (KICKOFF §3.6, §6.9 "Money math"): the values the
 * contract derives and never stores for an invoice (`S:622`) and its lines
 * (`S:635`), in integer paise. One module serves the invoice drawer, print and
 * ledger; the server computes the same totals on save and this mirrors them.
 *
 * A line's discount comes off its base and GST is charged on what is left. The
 * stored overall discount (paise, converted against the subtotal after line
 * discounts — Q-G7) comes off the bill. Line amounts stay unrounded so a total
 * is rounded once, to the paisa (Q-X3).
 */

/** One invoice line's amounts, in paise — unrounded; round where it is shown. */
export interface InvoiceLineAmounts {
  /** Quantity × rate, before any discount. */
  base: number;
  /** The line discount: base × discount %. */
  discount: number;
  /** GST on the discounted amount. */
  gst: number;
  /** What the line comes to: base − discount + GST. */
  net: number;
}

/** A line's amounts: the discount comes off the base, GST is charged on the rest. */
export function invoiceLineAmounts(
  item: Pick<InvoiceItem, 'qty' | 'rate' | 'discountPct' | 'gstPct'>,
): InvoiceLineAmounts {
  const base = item.qty * item.rate;
  const discount = (base * item.discountPct) / 100;
  const gst = ((base - discount) * item.gstPct) / 100;
  return { base, discount, gst, net: base - discount + gst };
}

/** An invoice's totals, in paise. Sums are unrounded; the bill is whole paise. */
export interface InvoiceTotals {
  /** Σ quantity × rate. */
  subtotal: number;
  /** Σ line discounts. */
  lineDiscount: number;
  /** Σ line GST. */
  gst: number;
  /** Σ line nets — the bill before the overall discount. */
  lineNet: number;
  /** The overall discount, as stored. */
  overallDiscount: number;
  /** Subtotal − line and overall discounts + GST, rounded to the paisa, never below zero. */
  bill: number;
}

/** The subtotal, discounts, GST and bill of an invoice. */
export function invoiceTotals(
  invoice: Pick<Invoice, 'items' | 'overallDiscount'>,
): InvoiceTotals {
  let subtotal = 0;
  let lineDiscount = 0;
  let gst = 0;
  for (const item of invoice.items) {
    const line = invoiceLineAmounts(item);
    subtotal += line.base;
    lineDiscount += line.discount;
    gst += line.gst;
  }
  const lineNet = subtotal - lineDiscount + gst;
  return {
    subtotal,
    lineDiscount,
    gst,
    lineNet,
    overallDiscount: invoice.overallDiscount,
    bill: Math.max(0, Math.round(lineNet - invoice.overallDiscount)),
  };
}

/**
 * What has been paid against an invoice, in paise: its receipts less its
 * refunds (`S:622`). Deleted ledger entries do not count.
 */
export function invoicePaid(invoiceId: string, payments: readonly Payment[]): number {
  let paid = 0;
  for (const payment of payments) {
    if (payment.invoiceId !== invoiceId || payment.deletedAt !== null) continue;
    if (payment.direction === 'received') paid += payment.amount;
    else if (payment.kind === 'refund') paid -= payment.amount;
  }
  return paid;
}

/** An invoice's status pill (`S:622`): "Paid", "Partly paid" or "Due" (H:3633). */
export type InvoiceStatus = 'paid' | 'partial' | 'unpaid';

/** An invoice's bill against what has been paid, in paise. */
export interface InvoiceBalance {
  /** The bill (`invoiceTotals`). */
  bill: number;
  /** Receipts less refunds (`invoicePaid`). */
  paid: number;
  /** What is still owed — never below zero. */
  due: number;
  /** Paid when nothing is due, partial when something was paid, else unpaid. */
  status: InvoiceStatus;
}

/** Money in and out of one payment mode, in paise. */
export interface ModeFlow {
  in: number;
  out: number;
}

/** A day's money by payment mode. */
export type DayModeTotals = Readonly<Record<PaymentMode, ModeFlow>>;

/**
 * A day's entries by mode (Q-G5): each split row counts under its own mode, and
 * Credit — a credit used on a bill — apart from the cash. Deleted entries do not
 * count (`S:715`; the prototype dropped split entries, H:5111).
 */
export function dayModeTotals(
  payments: readonly Pick<Payment, 'direction' | 'splits' | 'deletedAt'>[],
): DayModeTotals {
  const totals: Record<PaymentMode, ModeFlow> = {
    cash: { in: 0, out: 0 },
    upi: { in: 0, out: 0 },
    card: { in: 0, out: 0 },
    credit: { in: 0, out: 0 },
  };
  for (const payment of payments) {
    if (payment.deletedAt !== null) continue;
    for (const split of payment.splits) {
      if (payment.direction === 'received') totals[split.mode].in += split.amount;
      else totals[split.mode].out += split.amount;
    }
  }
  return totals;
}

/** What the drawer should hold: the opening cash, plus cash in, less cash out (`S:715`). */
export function expectedDrawerCash(openingCash: number, totals: DayModeTotals): number {
  return openingCash + totals.cash.in - totals.cash.out;
}

/** The bill, what has been paid, what is due and the status of an invoice. */
export function invoiceBalance(
  invoice: Pick<Invoice, 'id' | 'items' | 'overallDiscount'>,
  payments: readonly Payment[],
): InvoiceBalance {
  const { bill } = invoiceTotals(invoice);
  const paid = invoicePaid(invoice.id, payments);
  const due = Math.max(0, bill - paid);
  let status: InvoiceStatus = 'unpaid';
  if (due === 0) status = 'paid';
  else if (paid > 0) status = 'partial';
  return { bill, paid, due, status };
}
