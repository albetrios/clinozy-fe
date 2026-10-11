import type {
  Invoice,
  InvoiceItem,
  MedicalPurchaseOrder,
  Payment,
  PaymentMode,
  PurchaseItem,
} from '@/shared/api/app/app-schema.ts';

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

/** A line's fields the money module reads. */
type LineFields = Pick<InvoiceItem, 'qty' | 'rate' | 'discountPct' | 'gstPct'>;

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
export function invoiceLineAmounts(item: LineFields): InvoiceLineAmounts {
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

/** The subtotal, discounts, GST and bill of an invoice — or of the drawer's draft. */
export function invoiceTotals(invoice: {
  items: readonly LineFields[];
  overallDiscount: Invoice['overallDiscount'];
}): InvoiceTotals {
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
interface ModeFlow {
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

/**
 * A bill against what has been paid on it (H:3633): what is still due — never
 * below zero — and the status, "Paid" once nothing is due, "Partly paid" once
 * something was paid, else "Due". The invoice drawer's draft reads it too.
 */
export function balanceOf(bill: number, paid: number): InvoiceBalance {
  const due = Math.max(0, bill - paid);
  let status: InvoiceStatus = 'unpaid';
  if (due === 0) status = 'paid';
  else if (paid > 0) status = 'partial';
  return { bill, paid, due, status };
}

/** The bill, what has been paid, what is due and the status of an invoice. */
export function invoiceBalance(
  invoice: Pick<Invoice, 'id' | 'items' | 'overallDiscount'>,
  payments: readonly Payment[],
): InvoiceBalance {
  return balanceOf(invoiceTotals(invoice).bill, invoicePaid(invoice.id, payments));
}

// ── The invoice drawer's figures (KICKOFF §6.9 Invoice drawer) ──

const roundTo2 = (value: number) => Math.round(value * 100) / 100;

/** What the overall discount percent is taken of (Q-G7): the subtotal after the line discounts, before tax. */
export function discountableSubtotal(items: readonly LineFields[]): number {
  const { subtotal, lineDiscount } = invoiceTotals({ items, overallDiscount: 0 });
  return subtotal - lineDiscount;
}

/**
 * The overall discount a percent asks for, in paise (Q-G7): before tax, off
 * the subtotal after the line discounts, to the paisa. The drawer keeps the %
 * field; the contract stores this amount (`S:616`). The percent is held to
 * 0–100, so the discount never passes the subtotal.
 */
export function overallDiscountFromPercent(
  items: readonly LineFields[],
  percent: number,
): number {
  const share = Math.min(100, Math.max(0, percent));
  return Math.round((discountableSubtotal(items) * share) / 100);
}

/**
 * The percent a stored overall discount is of the subtotal after the line
 * discounts — the drawer's field when an invoice opens for an edit — to two
 * decimals; 0 when there is nothing to discount.
 */
export function overallDiscountPercent(
  items: readonly LineFields[],
  overallDiscount: number,
): number {
  const base = discountableSubtotal(items);
  if (base <= 0 || overallDiscount <= 0) return 0;
  return Math.min(100, roundTo2((overallDiscount / base) * 100));
}

/** A line's Final — what it comes to, to the paisa: the drawer's editable cell. */
export function lineFinal(item: LineFields): number {
  return Math.round(invoiceLineAmounts(item).net);
}

/**
 * The Disc % that brings a line to `final` (the Final cell's back-solve,
 * H:5059): measured against the line before any discount, the final held to
 * between nothing and that. Kept exact, so the typed Final is what the line
 * comes to — the cell and the print show it to two decimals; the contract's
 * whole percent can't hold it (Appendix F).
 */
export function discountForFinal(item: LineFields, final: number): number {
  const full = invoiceLineAmounts({ ...item, discountPct: 0 }).net;
  if (full <= 0) return 0;
  const wanted = Math.min(full, Math.max(0, final));
  return Math.max(0, Math.min(100, (1 - wanted / full) * 100));
}

/**
 * The lowest Final a line may come to (H:5059): its floor per unit times the
 * quantity, with the line's GST on top unless the floor already includes it
 * (a GST-inclusive offering, Q-O3). `null` when the line has no floor.
 */
export function lineFloor(
  line: Pick<InvoiceItem, 'qty' | 'gstPct'>,
  floorPerUnit: number | null,
  gstInclusive = false,
): number | null {
  if (floorPerUnit === null || floorPerUnit <= 0) return null;
  const base = floorPerUnit * line.qty;
  return gstInclusive ? base : base * (1 + line.gstPct / 100);
}

/** Half a rupee: a Final that rounds to its floor is not below it (H:5059). */
const FLOOR_TOLERANCE = 50;

/** Whether a line comes to less than its floor ({@link lineFloor}). */
export function belowFloor(item: LineFields, floor: number | null): boolean {
  return floor !== null && invoiceLineAmounts(item).net + FLOOR_TOLERANCE < floor;
}

/** A purchase line's amount, in paise: qty × rate — free units cost nothing (`S:830`). */
export function purchaseLineAmount(item: Pick<PurchaseItem, 'qty' | 'rate'>): number {
  return item.qty * item.rate;
}

/**
 * A Medical purchase order's bill, in paise (`S:830`, "bill → Σ qty × rate"):
 * free units cost nothing. What is due is this less the order's `paid`.
 */
export function purchaseOrderTotal(
  items: readonly Pick<PurchaseItem, 'qty' | 'rate'>[],
): number {
  return items.reduce((sum, item) => sum + purchaseLineAmount(item), 0);
}

/**
 * What is still owed on a Medical purchase order, in paise (`S:830`, "due →
 * bill − paid"): only a received order is billed and unsettled — an Ordered
 * one is not billed yet, a Paid one is settled (the prototype's "Paid ₹1,200
 * of ₹1,296" still owes nothing, H:5421).
 */
export function purchaseOrderDue(
  order: Pick<MedicalPurchaseOrder, 'stage' | 'paid'> & {
    items: readonly Pick<PurchaseItem, 'qty' | 'rate'>[];
  },
): number {
  if (order.stage !== 'received') return 0;
  return Math.max(0, purchaseOrderTotal(order.items) - order.paid);
}
