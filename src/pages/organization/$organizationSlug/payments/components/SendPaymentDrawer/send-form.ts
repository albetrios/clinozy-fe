import { MONEY_SCALE, numberFromText, textFromNumber } from '@/lib/number-text.ts';
import type { ExpenseCategory, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import {
  EXPENSE_MODE_VALUES,
  type LedgerRow,
  type OpenSupplierBill,
  type PayExpenseInput,
  type PaymentPatch,
} from '@/shared/api/clinic/payments-contracts.ts';

/*
 * Send payment's form (`payments.md:112–130`; H:5126–5134) — pure, so the
 * drawer, its steps' heads, its badges and its checks read one set of rules.
 */

/** A mode Send payment offers: Cash, UPI, Card. */
export type SendMode = (typeof EXPENSE_MODE_VALUES)[number];

/** The bill a payment settles: a Medical PO or a Clinic stock purchase, by id. */
export interface SendBillRef {
  kind: OpenSupplierBill['kind'];
  purchaseId: string;
  billNo: string;
}

/** The drawer's form — the amount in rupees as typed ("3200", "12.5"), the day as `YYYY-MM-DD`. */
export interface SendFormValues {
  branchId: string | null;
  bill: SendBillRef | null;
  category: ExpenseCategory;
  payeeName: string;
  note: string;
  amount: string;
  paidOn: string;
  mode: SendMode;
}

/** The typed amount in paise; empty is 0. */
export const sendAmount = (values: Pick<SendFormValues, 'amount'>) =>
  numberFromText(values.amount, MONEY_SCALE);

/** An amount in paise as the field shows it ("3200"); 0 is empty. */
export const amountText = (paise: number) => textFromNumber(paise, MONEY_SCALE);

/** The fields whose emptiness stops a save, in the steps' order. */
export type SendRequiredField = 'payeeName' | 'amount';

/** A new payment: Consumables, Cash, today (`payments.md:117–123`). */
export function emptySendForm(branchId: string | null, today: string): SendFormValues {
  return {
    branchId,
    bill: null,
    category: 'consumables',
    payeeName: '',
    note: '',
    amount: '',
    paidOn: today,
    mode: 'cash',
  };
}

const isSendMode = (mode: string): mode is SendMode =>
  (EXPENSE_MODE_VALUES as readonly string[]).includes(mode);

/** An expense or a supplier bill's payment as its edit form; its bill and day are fixed. */
export function sendFormOf(entry: LedgerRow, paidOn: string): SendFormValues {
  const mode = entry.splits[0]?.mode;
  return {
    branchId: entry.branchId,
    bill: null,
    category: entry.expenseCategory ?? 'misc',
    payeeName: entry.payeeName ?? entry.partyName,
    note: entry.note ?? '',
    amount: amountText(entry.amount),
    paidOn,
    mode: mode && isSendMode(mode) ? mode : 'cash',
  };
}

/** A bill's category: a Medical PO's medicines, a Clinic stock purchase's consumables. */
const BILL_CATEGORY: Readonly<Record<OpenSupplierBill['kind'], ExpenseCategory>> = {
  medical_po: 'medicines',
  stock_po: 'consumables',
};

/**
 * The form once a bill is picked (`payments.md:116`): its supplier as Paid to,
 * its due as the amount and its category — or, with no bill ("Other spend"),
 * the fields as they were.
 */
export function withBill(
  values: SendFormValues,
  bill: OpenSupplierBill | null,
): SendFormValues {
  if (!bill) return { ...values, bill: null };
  return {
    ...values,
    bill: { kind: bill.kind, purchaseId: bill.purchaseId, billNo: bill.billNo },
    payeeName: bill.supplierName,
    amount: amountText(bill.due),
    category: BILL_CATEGORY[bill.kind],
  };
}

/** A bill's picker key: `md:<id>` or `is:<id>`, the `?bill=` form (`S:86`). */
export function billKey(bill: Pick<OpenSupplierBill, 'kind' | 'purchaseId'>): string {
  return `${bill.kind === 'medical_po' ? 'md' : 'is'}:${bill.purchaseId}`;
}

/** The bill `?bill=md:<id>|is:<id>` names among the open ones. */
export function billOf(
  bills: readonly OpenSupplierBill[],
  key: string | undefined,
): OpenSupplierBill | null {
  return bills.find((bill) => billKey(bill) === key) ?? null;
}

/** "Pending longest": the tone of a bill's age — blush from 30 days, butter from 14 (H:5130). */
export function ageTone(daysPending: number): Tone {
  if (daysPending >= 30) return 'blush';
  if (daysPending >= 14) return 'butter';
  return 'stone';
}

/**
 * The Quick fill presets of a new payment (H:5132): category, amount and mode,
 * and the payee — "Medline Surgicals" by name, or (`null`) the chip's own
 * words, "Tea & snacks" and "Courier" in the viewer's language.
 */
export const SEND_QUICK_FILLS = [
  {
    id: 'consumables',
    tone: 'mint',
    payee: 'Medline Surgicals',
    values: { category: 'consumables', amount: 320_000, mode: 'upi' },
  },
  {
    id: 'tea',
    tone: 'stone',
    payee: null,
    values: { category: 'misc', amount: 26_000, mode: 'cash' },
  },
  {
    id: 'courier',
    tone: 'butter',
    payee: null,
    values: { category: 'misc', amount: 15_000, mode: 'cash' },
  },
] as const satisfies readonly {
  id: string;
  tone: Tone;
  payee: string | null;
  /** The amount in paise. */
  values: { category: ExpenseCategory; amount: number; mode: SendMode };
}[];

/** One Quick fill preset. */
export type SendQuickFillId = (typeof SEND_QUICK_FILLS)[number]['id'];

/** The "Paid to" quick chips (`payments.md:119`); "Electricity" is a word, not a name. */
export const PAID_TO_QUICK = ['Medline Surgicals', 'Meta ads'] as const;

/** The amount quick chips, in paise: ₹500 · ₹1,000 · ₹2,000 · ₹5,000. */
export const AMOUNT_QUICK = [50_000, 100_000, 200_000, 500_000] as const;

/** The required fields still empty: Paid to, then Amount. */
export function sendMissing(values: SendFormValues): SendRequiredField[] {
  const missing: SendRequiredField[] = [];
  if (!values.payeeName.trim()) missing.push('payeeName');
  if (sendAmount(values) <= 0) missing.push('amount');
  return missing;
}

/** What Send payment sends (`payExpense`, `S:1709`). */
export function sendInputOf(
  values: SendFormValues,
  defaultBranchId: string,
  attachmentKeys: readonly string[] = [],
): PayExpenseInput {
  return {
    branchId: values.branchId ?? defaultBranchId,
    billRef: values.bill,
    payeeName: values.payeeName.trim(),
    expenseCategory: values.category,
    amount: sendAmount(values),
    mode: values.mode,
    paidOn: values.paidOn,
    note: values.note.trim() || null,
    attachmentKeys: [...attachmentKeys],
  };
}

/** What an edit sends (`updatePayment`, `S:1710`): payee, category, amount, mode, note. */
export function sendPatchOf(values: SendFormValues): PaymentPatch {
  return {
    payeeName: values.payeeName.trim(),
    expenseCategory: values.category,
    amount: sendAmount(values),
    mode: values.mode,
    note: values.note.trim() || null,
  };
}
