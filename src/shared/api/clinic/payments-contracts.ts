import { z } from 'zod';

import { type CreatedFilter, readCreatedFilter } from './clinic-list-filters.ts';
import {
  billKindSchema,
  civilDateSchema,
  expenseCategorySchema,
  invoiceTypeSchema,
  isoDateTimeSchema,
  paiseSchema,
  paymentDirectionSchema,
  paymentModeSchema,
  paymentSchema,
  paymentSplitSchema,
  toneSchema,
} from './clinic-schema.ts';

/*
 * The Payments ledger beyond the generated contract (KICKOFF §6.9, §3.6, D22):
 * the plan-only fields the ledger and its drawers show — each a fixture field
 * until clinozy-be serves it (Appendix F › Payments, REPLACE_WITH_API) — what a
 * client sends to receive, pay or change an entry, and the list reads' params.
 * Read by the Payments room, Day close, the patient file and Medical › Payments.
 */

// ── Records ──

/** A ledger entry's reference — "UPI ref / card last 4" (`payments.md:103`). */
export const PAYMENT_REFERENCE_MAX = 30;

/** A ledger entry's note: the contract's 280 characters (`S:661`). */
export const PAYMENT_NOTE_MAX = 280;

/** The amount and the modes of an entry, before or after an edit. */
export const paymentEditSideSchema = z.object({
  amount: paiseSchema,
  modes: z.array(paymentModeSchema),
});

/** One side of a logged edit. */
export type PaymentEditSide = z.infer<typeof paymentEditSideSchema>;

/**
 * One logged change of an entry while its day is open — "Edited 1× · last ₹600
 * UPI → ₹700 UPI" (`payments.md:29`; the edit log, Appendix F).
 */
export const paymentEditSchema = z.object({
  at: isoDateTimeSchema,
  byId: z.uuid(),
  from: paymentEditSideSchema,
  to: paymentEditSideSchema,
});

/** One logged edit of a ledger entry. */
export type PaymentEdit = z.infer<typeof paymentEditSchema>;

/**
 * A ledger entry as the rooms read it: the contract's `Payment` (`S:643–664`)
 * with the plan's fields (Appendix F, REPLACE_WITH_API) — the Reference the
 * Receive drawer takes, the edit log, and the bill photos Send payment files
 * through the uploads.
 */
export const paymentRecordSchema = paymentSchema.extend({
  reference: z.string().max(PAYMENT_REFERENCE_MAX).nullable(),
  edits: z.array(paymentEditSchema),
  attachmentKeys: z.array(z.string()),
});

/** A ledger entry — the contract's fields and the plan's. */
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

/** The member a row's "By" cell shows — embedded so a row renders without a join. */
export const ledgerPersonSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  initials: z.string(),
  tone: toneSchema,
});

/** Who recorded a ledger entry. */
export type LedgerPerson = z.infer<typeof ledgerPersonSchema>;

/**
 * A ledger row: the entry and what its cells name — the party, the invoice
 * ("Invoice #785", "Sale · Invoice #785"), the credit note and the supplier
 * bill it settles, the pending credit it came from, who recorded it, and
 * whether its day is closed (the server-derived lock, `dayCloseId`, `S:662`).
 * REPLACE_WITH_API: embed these in `listLedger`.
 */
export const ledgerRowSchema = paymentRecordSchema.extend({
  /** The patient's name, else the payee ("Tea & snacks", "Medline Surgicals"). */
  partyName: z.string(),
  /** The patient's display id when a patient paid or was paid. */
  patientSeq: z.number().int().nonnegative().nullable(),
  /** The invoice it settles, and what that invoice still owes now. */
  invoice: z
    .object({
      seq: z.number().int().nonnegative(),
      type: invoiceTypeSchema,
      due: paiseSchema,
    })
    .nullable(),
  creditNoteSeq: z.number().int().nonnegative().nullable(),
  /** The supplier bill paid — "Medical PO #431 · bill 1631", "Stock PO #15 · bill CX-118". */
  bill: z
    .object({
      kind: billKindSchema,
      seq: z.number().int().nonnegative(),
      billNo: z.string(),
    })
    .nullable(),
  pendingCreditSeq: z.number().int().nonnegative().nullable(),
  by: ledgerPersonSchema.nullable(),
  /** The entry's day is closed: no edit, no delete (`S:87`). */
  locked: z.boolean(),
});

/** A Payments ledger row. */
export type LedgerRow = z.infer<typeof ledgerRowSchema>;

// ── Writes ──

const AMOUNT_MESSAGE = 'Enter an amount';
const PATIENT_MESSAGE = 'Pick a patient';
const PAID_TO_MESSAGE = 'Add who was paid and the amount';

/** At most four split rows — the contract's (`S:650`); the drawer offers each mode once. */
export const PAYMENT_SPLIT_LIMIT = 4;

/** The split rows of a write: one per mode, each above zero ("Enter an amount"). */
const splitsSchema = z
  .array(paymentSplitSchema.extend({ amount: paiseSchema.positive(AMOUNT_MESSAGE) }))
  .min(1, AMOUNT_MESSAGE)
  .max(PAYMENT_SPLIT_LIMIT);

const optionalText = (max: number) => z.string().trim().max(max).nullable();

/**
 * Receive payment (`receivePayment`, `S:1708`): the branch, the patient — always
 * one, which the prototype skipped (§7.3) — the invoice it settles, the split
 * rows (`amount` is their sum, server-side), and the plan's Reference and Note
 * (Appendix F).
 */
export const receivePaymentInputSchema = z.object({
  branchId: z.uuid(),
  patientId: z.uuid(PATIENT_MESSAGE),
  invoiceId: z.uuid().nullable(),
  splits: splitsSchema,
  reference: optionalText(PAYMENT_REFERENCE_MAX),
  note: optionalText(PAYMENT_NOTE_MAX),
});

/** What Receive payment sends. */
export type ReceivePaymentInput = z.infer<typeof receivePaymentInputSchema>;

/** The modes Send payment offers (`payments.md:123`) — "Credit" is only ever a credit's. */
export const EXPENSE_MODE_VALUES = ['cash', 'upi', 'card'] as const;

/**
 * Send payment (`payExpense`, `S:1709`): a supplier bill or a payee, the
 * category, the amount in one mode, the day it was paid, the note and the bill
 * photos (Appendix F). A payment against a bill is the `supplier_bill` kind and
 * raises that purchase's paid (Q-M1).
 */
export const payExpenseInputSchema = z.object({
  branchId: z.uuid(),
  billRef: z
    .object({
      kind: billKindSchema.exclude(['other']),
      purchaseId: z.uuid(),
      billNo: z.string().max(30),
    })
    .nullable(),
  payeeName: z.string().trim().min(1, PAID_TO_MESSAGE).max(120),
  expenseCategory: expenseCategorySchema,
  amount: paiseSchema.positive(PAID_TO_MESSAGE),
  mode: z.enum(EXPENSE_MODE_VALUES),
  /** The clinic day it was paid ("Date"); today by default. */
  paidOn: civilDateSchema,
  note: optionalText(PAYMENT_NOTE_MAX),
  attachmentKeys: z.array(z.string()),
});

/** What Send payment sends. */
export type PayExpenseInput = z.infer<typeof payExpenseInputSchema>;

/**
 * Changing an open-day entry (`updatePayment`, `S:1710`): a receipt's splits,
 * Reference and Note; an expense's payee, category, amount, mode, note and
 * photos. Every change of the amount or the modes is logged on the entry.
 */
export type PaymentPatch = Partial<
  Pick<ReceivePaymentInput, 'splits' | 'reference' | 'note'> &
    Pick<
      PayExpenseInput,
      'payeeName' | 'expenseCategory' | 'amount' | 'mode' | 'attachmentKeys'
    >
>;

// ── Reads ──

/**
 * The ledger's "What" filter (`kind`, `S:1699`): the contract's kinds as the
 * What pill tells them apart — a supplier bill is an expense ("Paid", butter).
 */
export const LEDGER_KIND_VALUES = ['receipt', 'refund', 'expense', 'money_back'] as const;

/** One "What" filter value. */
export type LedgerKindFilter = (typeof LEDGER_KIND_VALUES)[number];

/**
 * `listLedger`'s params (`S:1699`): Show (`direction`), What (`kind`), Mode
 * (`mode`), Created and `q` (a PAY- number, the party, an invoice number); the
 * day Day close reviews (`day`); the header branches (`branchIds`, empty = all);
 * and Medical › Payments' fixed `scope=medical` (`S:71`, `S:1662`). Newest
 * first — the ledger has no column sort (`payments.md:31`).
 */
export const ledgerListParamsSchema = z.object({
  direction: paymentDirectionSchema.optional(),
  kind: z.array(z.enum(LEDGER_KIND_VALUES)).optional(),
  mode: z.array(paymentModeSchema).optional(),
  created: z
    .custom<CreatedFilter>((value) => readCreatedFilter(value) !== undefined)
    .optional(),
  q: z.string().max(80).optional(),
  day: civilDateSchema.optional(),
  branchIds: z.array(z.uuid()).optional(),
  scope: z.enum(['medical']).optional(),
});

/** Params of the ledger read. */
export type LedgerListParams = z.infer<typeof ledgerListParamsSchema>;

/**
 * An invoice the Receive drawer can settle (`listOpenInvoices`, `S:1702`):
 * "#784 · ₹8,550", its type under it, oldest first.
 */
export interface OpenInvoice {
  id: string;
  seq: number;
  type: z.infer<typeof invoiceTypeSchema>;
  date: string;
  bill: number;
  paid: number;
  due: number;
}

/**
 * A supplier bill Send payment can settle (`listOpenSupplierBills`, `S:1701`):
 * a received Medical PO or a Clinic stock purchase with a balance — "Medical PO
 * #431 · Shree Ramdev Medical Agency", "Bill 1631 · 8 days pending", the due.
 */
export interface OpenSupplierBill {
  kind: 'medical_po' | 'stock_po';
  purchaseId: string;
  seq: number;
  billNo: string;
  supplierName: string;
  /** The purchase's calendar date. */
  date: string;
  due: number;
  /** Whole days since the purchase, on the clinic's today. */
  daysPending: number;
}

/** A supplier bill as the rooms that buy name it: its kind and its purchase. */
export type SupplierBillRef = Pick<OpenSupplierBill, 'kind' | 'purchaseId'>;

/**
 * A supplier bill's key — `md:<poId>` (a Medical PO) or `is:<purchaseId>` (a
 * Clinic stock purchase): Send payment's picker key and the `?bill=` that
 * Medical's and Clinic stock's "Pay ₹X" open it on (`S:86`, Q-M1).
 */
export function supplierBillKey(bill: SupplierBillRef): string {
  return `${bill.kind === 'medical_po' ? 'md' : 'is'}:${bill.purchaseId}`;
}
