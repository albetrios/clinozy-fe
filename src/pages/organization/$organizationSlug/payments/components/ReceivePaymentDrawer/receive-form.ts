import { paiseOfRupees, rupeesOfPaise } from '@/lib/number-text.ts';
import type { Tone } from '@/shared/api/app/app-schema.ts';
import type { InvoiceRecord } from '@/shared/api/app/invoices-contracts.ts';
import type {
  LedgerRow,
  PaymentPatch,
  ReceivePaymentInput,
} from '@/shared/api/app/payments-contracts.ts';
import { PAYMENT_MODE_TONES } from '@/shared/app/app-tones.ts';
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
 * drawer, its badges, its footer and its checks read one set of rules. The Mode ·
 * Amount rows hold paise (the shared `SplitRowsField`); what the API sends and
 * answers is rupees, converted here at the form's edge.
 */

/**
 * The drawer's form: who pays — the patient the picker shows (`pat_…`) and the contact a receipt
 * names (`con_…`) — against what (an invoice, or none: an advance), how (the Mode · Amount rows,
 * in paise), and the Reference and Note.
 */
export interface ReceiveFormValues {
  branchId: string | null;
  patientId: string | null;
  contactId: string | null;
  invoiceId: string | null;
  splits: SplitRow[];
  reference: string;
  note: string;
}

/** The patient a receipt is from: their file and their contact. */
export interface ReceivePatient {
  /** `pat_…`. */
  id: string;
  /** `con_…`. */
  contactId: string;
}

/** A new receipt: no patient yet, one empty UPI row. */
export function emptyReceiveForm(branchId: string | null): ReceiveFormValues {
  return {
    branchId,
    patientId: null,
    contactId: null,
    invoiceId: null,
    splits: [{ mode: FIRST_SPLIT_MODE, amount: 0 }],
    reference: '',
    note: '',
  };
}

/** A receipt as its edit form: its rows (in paise), Reference and Note, its patient and invoice fixed. */
export function receiveFormOf(entry: LedgerRow): ReceiveFormValues {
  return {
    branchId: entry.branchId,
    patientId: entry.patientId,
    contactId: entry.contactId,
    invoiceId: entry.invoiceId,
    splits: entry.splits.map((split) => ({
      mode: isSplitMode(split.mode) ? split.mode : null,
      amount: paiseOfRupees(split.amount),
    })),
    reference: entry.reference ?? '',
    note: entry.note ?? '',
  };
}

/** An invoice's due as the rows hold money — paise. */
export const dueInPaise = (invoice: Pick<InvoiceRecord, 'due'>) =>
  paiseOfRupees(invoice.due);

/**
 * The form once a patient is picked (`payments.md:101`): their invoice named by
 * the link when it is open, else the oldest, and one row of its due in the
 * mode already chosen; no invoice open — an advance, and a 0 row.
 */
export function withPatient(
  values: ReceiveFormValues,
  patient: ReceivePatient,
  invoices: readonly InvoiceRecord[],
  wanted?: string,
): ReceiveFormValues {
  const invoice = invoices.find((open) => open.id === wanted) ?? invoices[0];
  return {
    ...values,
    patientId: patient.id,
    contactId: patient.contactId,
    invoiceId: invoice?.id ?? null,
    splits: [
      {
        mode: values.splits[0]?.mode ?? FIRST_SPLIT_MODE,
        amount: invoice ? dueInPaise(invoice) : 0,
      },
    ],
  };
}

/** Half of a due, in whole rupees (the prototype's `Math.round(d / 2)`), as paise. */
export function halfOf(duePaise: number): number {
  return Math.round(duePaise / 200) * 100;
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
 * The rows a preset fills for an invoice's due (paise): "Full" — the due in UPI; "Half" — half
 * of it in UPI; "Cash + UPI" — half in cash, the rest in UPI. A preview of what is typed: the
 * server checks the due.
 */
export function quickFillSplits(id: ReceiveQuickFillId, duePaise: number): SplitRow[] {
  if (id === 'full') return [{ mode: 'upi', amount: duePaise }];
  if (id === 'half') return [{ mode: 'upi', amount: halfOf(duePaise) }];
  const cash = halfOf(duePaise);
  return [
    { mode: 'cash', amount: cash },
    { mode: 'upi', amount: duePaise - cash },
  ];
}

/** The mode badge's tone: one mode's own, a split's stone (H:5073). */
export function modesTone(modes: readonly SplitMode[]): Tone {
  const [only] = modes;
  return modes.length === 1 && only ? PAYMENT_MODE_TONES[only] : 'stone';
}

/** The paid rows as a write sends them: one per mode with an amount, in rupees. */
const rupeeSplits = (splits: readonly SplitRow[]) =>
  paidSplits(splits).map((split) => ({
    mode: split.mode,
    amount: rupeesOfPaise(split.amount),
  }));

/** What Receive payment sends (`POST /app/payments`, `kind: receipt`; the text trimmed there). */
export function receiveInputOf(
  values: ReceiveFormValues,
  defaultBranchId: string,
): ReceivePaymentInput {
  return {
    branchId: values.branchId ?? defaultBranchId,
    contactId: values.contactId ?? '',
    invoiceId: values.invoiceId,
    splits: rupeeSplits(values.splits),
    reference: values.reference,
    note: values.note,
  };
}

/**
 * What an edit asks for: the rows, Reference and Note — the API sends only what differs from the
 * entry (`updatePayment`).
 */
export function receivePatchOf(values: ReceiveFormValues): PaymentPatch {
  return {
    splits: rupeeSplits(values.splits),
    reference: values.reference,
    note: values.note,
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
 * an amount"), then at most the picked invoice's due (paise; null without one — an advance).
 */
export function receiveProblem(
  values: ReceiveFormValues,
  duePaise: number | null,
): ReceiveProblem | null {
  if (!values.contactId) return { kind: 'patient', field: 'patientId' };
  const total = splitsTotal(values.splits);
  if (total <= 0) return { kind: 'amount', field: 'splits' };
  if (duePaise !== null && total > duePaise) {
    return { kind: 'aboveDue', field: 'splits', due: duePaise };
  }
  return null;
}
