import { z } from 'zod';

import { type CreatedFilter, readCreatedFilter } from './clinic-list-filters.ts';
import {
  civilDateSchema,
  creditDirectionSchema,
  creditStatusSchema,
  isoDateTimeSchema,
  paiseSchema,
  paymentKindSchema,
  pendingCreditSchema,
} from './clinic-schema.ts';

/*
 * Payments › Pending beyond the generated contract (KICKOFF §6.9, D22): the
 * plan-only fields the Pending table and the Add pending drawer show — each a
 * fixture field until clinozy-be serves it (Appendix F › Payments,
 * REPLACE_WITH_API) — what a client sends to add, change or settle a credit,
 * and the list read's params.
 */

// ── Records ──

/** A credit's note: 300 characters (`payments.md:162`). */
export const CREDIT_NOTE_MAX = 300;

/**
 * The reason chips of each direction (`payments.md:159`): the stored `reason`
 * is the chip's label, or the note for "Other" (D22); the chip itself is kept
 * so an edit opens on it (Appendix F).
 */
export const CREDIT_REASON_VALUES = {
  give: [
    'charged_twice',
    'advance_not_used',
    'package_cancelled',
    'overpaid',
    'returned_items',
    'other',
  ],
  take: ['short_payment', 'damaged_goods', 'advance_given', 'loan_to_staff', 'other'],
} as const;

/** Every reason chip of either direction. */
export const CREDIT_REASON_KEYS = [
  ...CREDIT_REASON_VALUES.give,
  ...CREDIT_REASON_VALUES.take.filter((key) => key !== 'other'),
] as const;

/** One reason chip. */
export type CreditReasonKey = (typeof CREDIT_REASON_KEYS)[number];

/**
 * A credit as the rooms read it: the contract's `PendingCredit` (`S:680–697`)
 * with the plan's fields (Appendix F, REPLACE_WITH_API) — the picked reason
 * chip, the note, the invoice it is for, the day to settle it by, what has been
 * settled of it so far ("₹X adjusted") and when it was settled.
 */
export const pendingCreditRecordSchema = pendingCreditSchema.extend({
  reasonKey: z.enum(CREDIT_REASON_KEYS).nullable(),
  note: z.string().max(CREDIT_NOTE_MAX).nullable(),
  invoiceId: z.uuid().nullable(),
  settleBy: civilDateSchema.nullable(),
  /** Paise settled so far — a partial give-back, get-back or use on a bill. */
  adjusted: paiseSchema,
  settledAt: isoDateTimeSchema.nullable(),
});

/** A pending credit — the contract's fields and the plan's. */
export type PendingCreditRecord = z.infer<typeof pendingCreditRecordSchema>;

/**
 * A Pending row: the credit and what its cells name — the patient's display id,
 * the ledger entry it came from ("From PAY-5466 · Received"), the invoice it is
 * for ("Invoice #785"), and the invoice a use on the next bill settled it on
 * ("Adjusted · Invoice #785", Q-G9). REPLACE_WITH_API: embed these in
 * `listPendingCredits`.
 */
export const creditRowSchema = pendingCreditRecordSchema.extend({
  patientSeq: z.number().int().nonnegative().nullable(),
  source: z
    .object({
      seq: z.number().int().nonnegative(),
      direction: z.enum(['received', 'paid']),
      kind: paymentKindSchema,
    })
    .nullable(),
  invoiceSeq: z.number().int().nonnegative().nullable(),
  settledInvoiceSeq: z.number().int().nonnegative().nullable(),
});

/** A Pending table row. */
export type CreditRow = z.infer<typeof creditRowSchema>;

/**
 * Who a credit can be with — one row of Add pending's Who picker
 * (`payments.md:157`): a patient; a contact — a lead that never became a
 * patient, or a Medical walk-in (there is no Contact entity, D32); or a
 * supplier — a Clinic stock vendor or a Medical supplier. REPLACE_WITH_API: the
 * party search clinozy-be serves.
 */
export type CreditPartyRow =
  | { kind: 'patient'; id: string; seq: number; name: string; phone: string | null }
  | { kind: 'contact'; id: string; name: string; phone: string | null }
  | { kind: 'vendor' | 'supplier'; id: string; name: string };

// ── Writes ──

const PICK_WHO = 'Pick who';
const ENTER_AMOUNT = 'Enter the amount';
const PICK_REASON = 'Pick a reason';
const OTHER_NOTE = 'Add a note for “Other”';

/**
 * Add / Edit pending (`create/update PendingCredit`, `S:1712`): which way, who
 * (a patient, or any name), the amount, the reason chip, and the plan's For
 * invoice, Settle by and Note — required for "Other" (`payments.md:156–162`).
 */
export const creditInputSchema = z
  .object({
    direction: creditDirectionSchema,
    partyName: z.string().trim().min(1, PICK_WHO).max(120),
    patientId: z.uuid().nullable(),
    amount: paiseSchema.positive(ENTER_AMOUNT),
    reasonKey: z.enum(CREDIT_REASON_KEYS, PICK_REASON),
    invoiceId: z.uuid().nullable(),
    settleBy: civilDateSchema.nullable(),
    note: z.string().trim().max(CREDIT_NOTE_MAX).nullable(),
  })
  .refine((input) => input.reasonKey !== 'other' || Boolean(input.note), {
    message: OTHER_NOTE,
    path: ['note'],
  });

/** What Add / Edit pending sends. */
export type CreditInput = z.infer<typeof creditInputSchema>;

/**
 * How a credit is settled (`settleCredit`, `S:1713`): given back to them, got
 * back from them — each in split rows, part of it or all — or used on the
 * patient's next bill (Q-G9).
 */
export type CreditSettlement =
  | {
      action: 'give_back' | 'got_back';
      splits: readonly { mode: 'cash' | 'upi' | 'card'; amount: number }[];
    }
  | { action: 'use_on_bill' };

/** What a settlement wrote: the credit after it, the ledger entry, the invoice it went to. */
export interface CreditSettleResult {
  credit: PendingCreditRecord;
  paymentSeq: number;
  /** The amount settled now, in paise. */
  amount: number;
  /** The invoice a use on the next bill went to, or the refund's credit note's. */
  invoiceSeq: number | null;
  creditNoteSeq: number | null;
}

// ── Reads ──

/** The Pending table's state filter: each stored status (D22). */
export const CREDIT_STATUS_FILTER_VALUES = creditStatusSchema.options;

/**
 * `listPendingCredits`' params (`S:1700`): which way (`direction`), the state
 * (`status`), and the plan's Created and `q` (a CR- number, the party, the
 * reason). Newest first.
 */
export const creditListParamsSchema = z.object({
  direction: z.array(creditDirectionSchema).optional(),
  status: z.array(creditStatusSchema).optional(),
  q: z.string().max(80).optional(),
  created: z
    .custom<CreatedFilter>((value) => readCreatedFilter(value) !== undefined)
    .optional(),
});

/** Params of the Pending read. */
export type CreditListParams = z.infer<typeof creditListParamsSchema>;
