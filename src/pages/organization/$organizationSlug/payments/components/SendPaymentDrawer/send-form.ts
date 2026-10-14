import {
  MONEY_SCALE,
  numberFromText,
  paiseOfRupees,
  rupeesOfPaise,
  textFromNumber,
} from '@/lib/number-text.ts';
import type { ExpenseCategory, Tone } from '@/shared/api/app/app-schema.ts';
import {
  EXPENSE_MODE_VALUES,
  type LedgerRow,
  type OpenSupplierBill,
  type PayExpenseInput,
  type PaymentPatch,
  supplierBillKey,
  type SupplierBillRef,
} from '@/shared/api/app/payments-contracts.ts';

/*
 * Send payment's form (`payments.md:112–130`; H:5126–5134) — pure, so the
 * drawer, its steps' heads, its badges and its checks read one set of rules.
 * The amount is typed in rupees and held as text; the checks read it in paise;
 * what the API sends and answers is rupees, converted here at the form's edge.
 */

/** A mode Send payment offers: Cash, UPI, Card. */
export type SendMode = (typeof EXPENSE_MODE_VALUES)[number];

/**
 * The supplier bill a payment settles — a Medical PO or a Clinic stock purchase by its public id
 * — with what its label shows: its number, the supplier's bill number and the supplier.
 */
interface SendBill extends SupplierBillRef {
  seq: number;
  billNo: string | null;
  supplierName: string;
}

/** The drawer's form — the amount in rupees as typed ("3200", "12.5"), the day as `YYYY-MM-DD`. */
export interface SendFormValues {
  branchId: string | null;
  /** The supplier bill it pays; none for clinic spend, which has a category instead. */
  bill: SendBill | null;
  /** Clinic spend's category — a supplier bill has none (`400 "Only an expense has a category"`). */
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

/**
 * An expense or a supplier bill's payment as its edit form: its bill (the supplier is its payee),
 * its category for an expense, its one split as the amount and the mode; its day is fixed.
 */
export function sendFormOf(entry: LedgerRow, paidOn: string): SendFormValues {
  const mode = entry.splits[0]?.mode;
  return {
    branchId: entry.branchId,
    bill: entry.bill
      ? {
          kind: entry.bill.kind,
          purchaseId: entry.bill.purchaseId,
          seq: entry.bill.seq,
          billNo: entry.bill.billNo,
          supplierName: entry.payeeName ?? entry.partyName,
        }
      : null,
    category: entry.expenseCategory ?? 'misc',
    payeeName: entry.payeeName ?? entry.partyName,
    note: entry.note ?? '',
    amount: amountText(paiseOfRupees(entry.amount)),
    paidOn,
    mode: mode && isSendMode(mode) ? mode : 'cash',
  };
}

/**
 * The form once a bill is picked (`payments.md:116`): its supplier as Paid to and its due as the
 * amount — a bill has no category — or, with no bill ("Other spend"), the fields as they were.
 */
export function withBill(
  values: SendFormValues,
  bill: OpenSupplierBill | null,
): SendFormValues {
  if (!bill) return { ...values, bill: null };
  return {
    ...values,
    bill: {
      kind: bill.kind,
      purchaseId: bill.purchaseId,
      seq: bill.seq,
      billNo: bill.billNo,
      supplierName: bill.supplierName,
    },
    payeeName: bill.supplierName,
    amount: amountText(paiseOfRupees(bill.due)),
  };
}

/** The bill a `?bill=<mpo_… | spur_…>` link names among the open ones. */
export function billOf(
  bills: readonly OpenSupplierBill[],
  key: string | undefined,
): OpenSupplierBill | null {
  return bills.find((bill) => supplierBillKey(bill) === key) ?? null;
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

/** How many of the clinic's recent payees "Paid to" offers as chips, before "Electricity". */
export const RECENT_PAYEES_LIMIT = 4;

/**
 * The "Paid to" quick chips (`payments.md:119`; feat-write-less, D14): the clinic's own most
 * recent payees — from its expenses, newest first, each name once (case aside), as the clinic typed
 * it — then "Electricity", a word in the viewer's language. Never a made-up name.
 *
 * @param rows - Expense rows, newest first (the ledger's first page).
 * @param electricity - "Electricity" in the viewer's language.
 * @returns At most {@link RECENT_PAYEES_LIMIT} payees, then "Electricity" unless it is one of them.
 */
export function paidToQuick(
  rows: readonly { payeeName: string | null }[],
  electricity: string,
): string[] {
  const seen = new Set<string>();
  const payees: string[] = [];
  for (const row of rows) {
    const name = row.payeeName?.trim();
    const key = name?.toLocaleLowerCase();
    if (!name || !key || seen.has(key)) continue;
    seen.add(key);
    payees.push(name);
    if (payees.length === RECENT_PAYEES_LIMIT) break;
  }
  return seen.has(electricity.toLocaleLowerCase()) ? payees : [...payees, electricity];
}

/** The amount quick chips, in paise: ₹500 · ₹1,000 · ₹2,000 · ₹5,000. */
export const AMOUNT_QUICK = [50_000, 100_000, 200_000, 500_000] as const;

/** The required fields still empty: Paid to, then Amount. */
export function sendMissing(values: SendFormValues): SendRequiredField[] {
  const missing: SendRequiredField[] = [];
  if (!values.payeeName.trim()) missing.push('payeeName');
  if (sendAmount(values) <= 0) missing.push('amount');
  return missing;
}

/**
 * What Send payment sends (`POST /app/payments`): a supplier bill's payment — its purchase, no
 * category — or clinic spend in its category; the amount in rupees, the payee and the note
 * trimmed there.
 */
export function sendInputOf(
  values: SendFormValues,
  defaultBranchId: string,
): PayExpenseInput {
  const fields = {
    branchId: values.branchId ?? defaultBranchId,
    payeeName: values.payeeName,
    amount: rupeesOfPaise(sendAmount(values)),
    mode: values.mode,
    paidOn: values.paidOn,
    note: values.note,
    attachmentKeys: [],
  };
  return values.bill
    ? { ...fields, bill: { kind: values.bill.kind, purchaseId: values.bill.purchaseId } }
    : { ...fields, bill: null, expenseCategory: values.category };
}

/**
 * What an edit asks for — payee, category (an expense's only), amount and mode in rupees, note;
 * the API sends only what differs from the entry (`updatePayment`).
 */
export function sendPatchOf(values: SendFormValues): PaymentPatch {
  return {
    payeeName: values.payeeName,
    expenseCategory: values.category,
    amount: rupeesOfPaise(sendAmount(values)),
    mode: values.mode,
    note: values.note,
  };
}
