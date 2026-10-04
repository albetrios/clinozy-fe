import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  LedgerRow,
  OpenInvoice,
  PaymentPatch,
  ReceivePaymentInput,
} from '@/shared/api/clinic/payments-contracts.ts';
import { PAYMENT_MODE_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  FIRST_SPLIT_MODE,
  isSplitMode,
  paidSplits,
  type SplitMode,
  type SplitRow,
  splitsTotal,
} from '@/shared/forms/SplitRowsField/index.ts';

/*
 * Receive payment's form (`payments.md:95–110`; H:5069–5073) — pure, so the
 * drawer, its badges, its footer and its checks read one set of rules.
 */

/** The drawer's form: who pays, against what, how (the Mode · Amount rows) — and the plan's Reference and Note. */
export interface ReceiveFormValues {
  branchId: string | null;
  patientId: string | null;
  invoiceId: string | null;
  splits: SplitRow[];
  reference: string;
  note: string;
}

/** A new receipt: no patient yet, one empty UPI row. */
export function emptyReceiveForm(branchId: string | null): ReceiveFormValues {
  return {
    branchId,
    patientId: null,
    invoiceId: null,
    splits: [{ mode: FIRST_SPLIT_MODE, amount: 0 }],
    reference: '',
    note: '',
  };
}

/** A receipt as its edit form: its rows, Reference and Note, its patient and invoice fixed. */
export function receiveFormOf(entry: LedgerRow): ReceiveFormValues {
  return {
    branchId: entry.branchId,
    patientId: entry.patientId,
    invoiceId: entry.invoiceId,
    splits: entry.splits.map((split) => ({
      mode: isSplitMode(split.mode) ? split.mode : null,
      amount: split.amount,
    })),
    reference: entry.reference ?? '',
    note: entry.note ?? '',
  };
}

/**
 * The form once a patient is picked (`payments.md:101`): their invoice named by
 * the link when it is open, else the oldest, and one row of its due in the
 * mode already chosen; no invoice open — no invoice and a 0 row.
 */
export function withPatient(
  values: ReceiveFormValues,
  patientId: string,
  invoices: readonly OpenInvoice[],
  wanted?: string,
): ReceiveFormValues {
  const invoice = invoices.find((open) => open.id === wanted) ?? invoices[0];
  return {
    ...values,
    patientId,
    invoiceId: invoice?.id ?? null,
    splits: [
      { mode: values.splits[0]?.mode ?? FIRST_SPLIT_MODE, amount: invoice?.due ?? 0 },
    ],
  };
}

/** Half of a due, in whole rupees (the prototype's `Math.round(d / 2)`), as paise. */
export function halfOf(due: number): number {
  return Math.round(due / 200) * 100;
}

/** The Quick fill presets once an invoice is picked (`payments.md:106`), each in its tone. */
export const RECEIVE_QUICK_FILLS = [
  { id: 'full', tone: 'sage' },
  { id: 'half', tone: 'butter' },
  { id: 'cashUpi', tone: 'sky' },
] as const satisfies readonly { id: string; tone: Tone }[];

/** One Quick fill preset. */
export type ReceiveQuickFillId = (typeof RECEIVE_QUICK_FILLS)[number]['id'];

/**
 * The rows a preset fills for an invoice's due: "Full" — the due in UPI;
 * "Half" — half of it in UPI; "Cash + UPI" — half in cash, the rest in UPI.
 */
export function quickFillSplits(id: ReceiveQuickFillId, due: number): SplitRow[] {
  if (id === 'full') return [{ mode: 'upi', amount: due }];
  if (id === 'half') return [{ mode: 'upi', amount: halfOf(due) }];
  const cash = halfOf(due);
  return [
    { mode: 'cash', amount: cash },
    { mode: 'upi', amount: due - cash },
  ];
}

/** The mode badge's tone: one mode's own, a split's stone (H:5073). */
export function modesTone(modes: readonly SplitMode[]): Tone {
  const [only] = modes;
  return modes.length === 1 && only ? PAYMENT_MODE_TONES[only] : 'stone';
}

/** What Receive payment sends (`receivePayment`, `S:1708`). */
export function receiveInputOf(
  values: ReceiveFormValues,
  defaultBranchId: string,
): ReceivePaymentInput {
  return {
    branchId: values.branchId ?? defaultBranchId,
    patientId: values.patientId ?? '',
    invoiceId: values.invoiceId,
    splits: paidSplits(values.splits),
    reference: values.reference.trim() || null,
    note: values.note.trim() || null,
  };
}

/** What an edit sends: the rows, Reference and Note (`updatePayment`, `S:1710`). */
export function receivePatchOf(values: ReceiveFormValues): PaymentPatch {
  return {
    splits: paidSplits(values.splits),
    reference: values.reference.trim() || null,
    note: values.note.trim() || null,
  };
}

/** What stops a save before anything is sent, and the field it names. */
export type ReceiveProblem =
  | { kind: 'patient'; field: 'patientId' }
  | { kind: 'amount'; field: 'splits' }
  | { kind: 'aboveDue'; field: 'splits'; due: number };

/**
 * The checks in the drawer's order (KICKOFF §6.9, fixed from the prototype):
 * a patient — always one on a new receipt — then an amount above zero ("Enter
 * an amount"), then at most the picked invoice's due (`due`, null without one).
 */
export function receiveProblem(
  values: ReceiveFormValues,
  due: number | null,
): ReceiveProblem | null {
  if (!values.patientId) return { kind: 'patient', field: 'patientId' };
  const total = splitsTotal(values.splits);
  if (total <= 0) return { kind: 'amount', field: 'splits' };
  if (due !== null && total > due) return { kind: 'aboveDue', field: 'splits', due };
  return null;
}
