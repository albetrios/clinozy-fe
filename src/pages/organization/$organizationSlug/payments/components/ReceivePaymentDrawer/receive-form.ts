import type { PaymentMode, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  LedgerRow,
  OpenInvoice,
  PaymentPatch,
  ReceivePaymentInput,
} from '@/shared/api/clinic/payments-contracts.ts';
import { PAYMENT_MODE_TONES } from '@/shared/clinic/clinic-tones.ts';

/*
 * Receive payment's form (`payments.md:95–110`; H:5069–5073) — pure, so the
 * drawer, its badges, its footer and its checks read one set of rules.
 */

/** The modes a receipt's rows offer (`PY_MODES`): Cash, UPI, Card — "Credit" is only ever a credit's. */
export const RECEIVE_MODES = ['cash', 'upi', 'card'] as const;

/** One of the receipt's modes. */
export type ReceiveMode = (typeof RECEIVE_MODES)[number];

/** One Mode · Amount row: the mode, and the amount in paise (0 while empty). */
export interface ReceiveSplitRow {
  mode: ReceiveMode | null;
  amount: number;
}

/** The drawer's form: who pays, against what, how — and the plan's Reference and Note. */
export interface ReceiveFormValues {
  branchId: string | null;
  patientId: string | null;
  invoiceId: string | null;
  splits: ReceiveSplitRow[];
  reference: string;
  note: string;
}

/** An empty row starts in UPI (H:5070). */
const FIRST_MODE: ReceiveMode = 'upi';

const isReceiveMode = (mode: PaymentMode): mode is ReceiveMode =>
  (RECEIVE_MODES as readonly string[]).includes(mode);

/** A new receipt: no patient yet, one empty UPI row. */
export function emptyReceiveForm(branchId: string | null): ReceiveFormValues {
  return {
    branchId,
    patientId: null,
    invoiceId: null,
    splits: [{ mode: FIRST_MODE, amount: 0 }],
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
      mode: isReceiveMode(split.mode) ? split.mode : null,
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
    splits: [{ mode: values.splits[0]?.mode ?? FIRST_MODE, amount: invoice?.due ?? 0 }],
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
export function quickFillSplits(id: ReceiveQuickFillId, due: number): ReceiveSplitRow[] {
  if (id === 'full') return [{ mode: 'upi', amount: due }];
  if (id === 'half') return [{ mode: 'upi', amount: halfOf(due) }];
  const cash = halfOf(due);
  return [
    { mode: 'cash', amount: cash },
    { mode: 'upi', amount: due - cash },
  ];
}

/** Σ of the rows, in paise. */
export function splitsTotal(splits: readonly ReceiveSplitRow[]): number {
  return splits.reduce((sum, row) => sum + row.amount, 0);
}

/**
 * The modes the receipt pays in, each once — the rows with an amount, else
 * the first row's (a fresh form reads "UPI").
 */
export function splitsModes(splits: readonly ReceiveSplitRow[]): ReceiveMode[] {
  const paid = splits.filter((row) => row.amount > 0).map((row) => row.mode);
  const modes = paid.length > 0 ? paid : splits.slice(0, 1).map((row) => row.mode);
  return [...new Set(modes.filter((mode): mode is ReceiveMode => mode !== null))];
}

/** The mode a "+ Split" row takes — the first one not used yet; none once all three are. */
export function nextSplitMode(splits: readonly ReceiveSplitRow[]): ReceiveMode | null {
  return RECEIVE_MODES.find((mode) => !splits.some((row) => row.mode === mode)) ?? null;
}

/** The mode badge's tone: one mode's own, a split's stone (H:5073). */
export function modesTone(modes: readonly ReceiveMode[]): Tone {
  const [only] = modes;
  return modes.length === 1 && only ? PAYMENT_MODE_TONES[only] : 'stone';
}

/** The rows the server takes: a mode and an amount above zero. */
function paidSplits(splits: readonly ReceiveSplitRow[]) {
  return splits.flatMap((row) =>
    row.mode && row.amount > 0 ? [{ mode: row.mode, amount: row.amount }] : [],
  );
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
