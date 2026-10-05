import { invoiceLineAmounts } from '@/shared/api/clinic/clinic-money.ts';
import type { VisitDetail } from '@/shared/api/clinic/visits-contracts.ts';

/** What a bill line's sub-line says (`today.md:263`), or nothing. */
type VisitBillLineNote =
  | { kind: 'fromPack' }
  | { kind: 'discount'; pct: number; final: number }
  | { kind: 'gstExempt' }
  | null;

/** One line as Checkout lists it: the name, the amount before discount, its sub-line. */
export interface VisitBillRow {
  name: string;
  /** Quantity × rate, in paise. */
  amount: number;
  note: VisitBillLineNote;
}

/** One GST rate's line of the totals: "GST 18% on ₹3,150" · ₹567. */
interface VisitGstRow {
  rate: number;
  base: number;
  amount: number;
}

/**
 * Checkout's "1 · Bill" (`today.md:263`; H:2627–2640): the lines and the
 * totals — "Subtotal after discount", "Discount (before tax)", one GST row per
 * rate, "Previous due" and "To pay now" — from the shared money module; the
 * server's totals in production.
 */
export interface VisitBillSummary {
  rows: VisitBillRow[];
  /** Σ (base − line discount), before tax. */
  afterDiscount: number;
  /** Σ line discounts. */
  discount: number;
  gst: VisitGstRow[];
  previousDue: number;
  /** What is left on the visit's bill and the earlier dues. */
  toPay: number;
}

/** A line's sub-line: from a pack, its discount, or GST exempt — in that order. */
function noteOf(
  line: VisitDetail['billLines'][number],
  final: number,
): VisitBillLineNote {
  if (line.fromPack) return { kind: 'fromPack' };
  if (line.discountPct > 0) return { kind: 'discount', pct: line.discountPct, final };
  if (line.gstPct === 0) return { kind: 'gstExempt' };
  return null;
}

/** The bill as Checkout shows it, in paise (rounded where shown). */
export function visitBill(
  detail: Pick<VisitDetail, 'billLines' | 'billDue' | 'previousDue'>,
): VisitBillSummary {
  let afterDiscount = 0;
  let discount = 0;
  const gst = new Map<number, VisitGstRow>();
  const rows = detail.billLines.map((line) => {
    const amounts = invoiceLineAmounts(line);
    const taxable = amounts.base - amounts.discount;
    afterDiscount += taxable;
    discount += amounts.discount;
    if (line.gstPct > 0 && amounts.gst > 0) {
      const row = gst.get(line.gstPct) ?? { rate: line.gstPct, base: 0, amount: 0 };
      gst.set(line.gstPct, {
        ...row,
        base: row.base + taxable,
        amount: row.amount + amounts.gst,
      });
    }
    return {
      name: line.name,
      amount: Math.round(amounts.base),
      note: noteOf(line, Math.round(taxable)),
    };
  });
  return {
    rows,
    afterDiscount: Math.round(afterDiscount),
    discount: Math.round(discount),
    gst: [...gst.values()]
      .sort((a, b) => a.rate - b.rate)
      .map((row) => ({
        ...row,
        base: Math.round(row.base),
        amount: Math.round(row.amount),
      })),
    previousDue: detail.previousDue.amount,
    toPay: detail.billDue + detail.previousDue.amount,
  };
}

/** Rupees typed in the amount field (digits only are read, ≤ 9 of them) → paise. */
export function amountFromText(text: string): number {
  const digits = text.replace(/\D/g, '').slice(0, 9);
  return digits === '' ? 0 : Number(digits) * 100;
}

/** Paise → the amount field's rupees ("3717"); paise left over round up to the rupee. */
export function amountText(paise: number): string {
  return paise > 0 ? String(Math.ceil(paise / 100)) : '';
}
