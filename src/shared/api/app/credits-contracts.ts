import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';
import { paiseOfRupees, rupeesOfPaise } from '@/lib/number-text.ts';

import type { CreatedFilter } from './app-list-filters.ts';
import {
  civilDateSchema,
  type CreditDirection,
  creditDirectionSchema,
  type CreditStatus,
  creditStatusSchema,
} from './app-schema.ts';
import type { LedgerPerson, MoneySplit } from './payments-contracts.ts';

/*
 * Payments › Pending on clinozy-be (`/app/pending-credits`, api-integration §5.8): money owed
 * either way, not yet settled — which way, with whom (a contact, or a supplier by name), the
 * amount, what is settled and left, the reason, the note, the invoice it is for, the day to settle
 * it by, the entries that settled it and who added it. What Add / Edit pending and a settlement
 * send, and the list read's params. Money is rupees as the API sends it.
 */

// ── Records ──

/** A credit's note: 300 characters. */
export const CREDIT_NOTE_MAX = 300;

/**
 * The reason chips of each direction (`payments.md:159`): a chip travels as its key (`reason:
 * "charged_twice"`, G-P10); "Other" sends the note's text.
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
const CREDIT_REASON_KEYS = [
  ...CREDIT_REASON_VALUES.give,
  ...CREDIT_REASON_VALUES.take.filter((key) => key !== 'other'),
] as const;

/** One reason chip. */
export type CreditReasonKey = (typeof CREDIT_REASON_KEYS)[number];

/** Whether a stored reason is a chip's key. */
const isCreditReasonKey = (reason: string): reason is CreditReasonKey =>
  (CREDIT_REASON_KEYS as readonly string[]).includes(reason);

/** The person a credit is with — the contact it names. */
interface CreditContact {
  /** `con_…`. */
  id: string;
  name: string;
  phone: string;
}

/** A pending credit as the rooms read it. Money in rupees. */
export interface PendingCreditRecord {
  /** `pcr_…`. */
  id: string;
  /** "CR-1" is this number. */
  seq: number;
  direction: CreditDirection;
  /** The person's contact; null for a supplier named by `partyName`. */
  contactId: string | null;
  contact: CreditContact | null;
  patientId: string | null;
  /** The person's name, else the supplier's as typed. */
  partyName: string;
  amount: number;
  /** What is settled so far ("₹X adjusted"). */
  settled: number;
  /** What is left to settle. */
  left: number;
  status: CreditStatus;
  /** The stored reason: a chip's key, or an "Other" reason's text. */
  reason: string;
  /** The chip it was added with — `other` for a reason that is no chip's. */
  reasonKey: CreditReasonKey;
  note: string | null;
  /** The invoice it is for. */
  invoiceId: string | null;
  /** The ledger entry it came from. */
  sourcePaymentId: string | null;
  settleBy: string | null;
  /** The ledger entries that settled it, oldest first. */
  paymentIds: string[];
  /**
   * When it was settled — its last change once it is no longer open (nothing but a settlement
   * writes a credit once part of it is settled, G-P11).
   */
  settledAt: string | null;
  /** Who added it (`mem_…`); null for an API key. */
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A Pending row: the credit and who added it (the team directory's; null for one who left). */
export interface CreditRow extends PendingCreditRecord {
  by: LedgerPerson | null;
}

// ── The wire ──

type ApiCreditRow = NonNullable<ApiData<'/app/pending-credits', 'get'>>[number];
type ApiCredit = NonNullable<ApiData<'/app/pending-credits/{pending_credit_id}', 'get'>>;
/** A new credit as `POST /app/pending-credits` takes it. */
export type ApiCreditCreate = ApiBody<'/app/pending-credits', 'post'>;
/** A change as `PATCH /app/pending-credits/:pending_credit_id` takes it. */
export type ApiCreditChange = ApiBody<
  '/app/pending-credits/{pending_credit_id}',
  'patch'
>;
/** A settlement as `POST /app/pending-credits/:pending_credit_id/settle` takes it. */
export type ApiCreditSettle = ApiBody<
  '/app/pending-credits/{pending_credit_id}/settle',
  'post'
>;

const creditFieldsWire = {
  id: z.string(),
  pending_credit_number: z.number().int(),
  direction: creditDirectionSchema,
  contact: z
    .object({ id: z.string(), name: z.string(), primary_phone: z.string() })
    .nullable(),
  patient_id: z.string().nullable(),
  party_name: z.string().nullable(),
  amount: z.number(),
  settled_amount: z.number(),
  left_amount: z.number(),
  status: creditStatusSchema,
  reason: z.string(),
  note: z.string().nullable(),
  invoice_id: z.string().nullable(),
  source_payment_id: z.string().nullable(),
  settle_by: civilDateSchema.nullable(),
  payment_ids: z.array(z.string()),
  created_by_membership_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
};

/** A Pending list row (`GET /app/pending-credits`). */
export const creditRowWire = wireSchema<ApiCreditRow>()(z.object(creditFieldsWire));

/** One credit (`GET /app/pending-credits/:pending_credit_id`, and every write's answer). */
export const creditWire = wireSchema<ApiCredit>()(z.object(creditFieldsWire));

/** A credit as the rooms read it. */
export function toPendingCreditRecord(
  row: z.output<typeof creditRowWire>,
): PendingCreditRecord {
  return {
    id: row.id,
    seq: row.pending_credit_number,
    direction: row.direction,
    contactId: row.contact?.id ?? null,
    contact: row.contact
      ? { id: row.contact.id, name: row.contact.name, phone: row.contact.primary_phone }
      : null,
    patientId: row.patient_id,
    partyName: row.contact?.name ?? row.party_name ?? '',
    amount: row.amount,
    settled: row.settled_amount,
    left: row.left_amount,
    status: row.status,
    reason: row.reason,
    reasonKey: isCreditReasonKey(row.reason) ? row.reason : 'other',
    note: row.note,
    invoiceId: row.invoice_id,
    sourcePaymentId: row.source_payment_id,
    settleBy: row.settle_by,
    paymentIds: row.payment_ids,
    settledAt: row.status === 'open' ? null : row.updated_at,
    createdById: row.created_by_membership_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A credit with who added it, from the team directory. */
export function toCreditRow(
  record: PendingCreditRecord,
  team: ReadonlyMap<string, LedgerPerson>,
): CreditRow {
  return {
    ...record,
    by: record.createdById ? (team.get(record.createdById) ?? null) : null,
  };
}

// ── Writes ──

/**
 * Add / Edit pending: which way, with whom — a patient's or a contact's contact, else a supplier
 * by name — the amount, the reason chip, and For invoice, Settle by and Note (required for
 * "Other", whose reason it is). Money in rupees.
 */
export interface CreditInput {
  direction: CreditDirection;
  /** The person's contact; null for a supplier. */
  contactId: string | null;
  /** A supplier's name (sent only without a contact). */
  partyName: string;
  amount: number;
  reasonKey: CreditReasonKey;
  invoiceId: string | null;
  settleBy: string | null;
  note: string | null;
}

/** Text as a write sends it: trimmed, a blank one as none. */
const textOrNull = (text: string | null) => {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

/** The reason a credit stores: the chip's key, or the note's text for "Other" (G-P10). */
function reasonOf(input: CreditInput): string {
  return input.reasonKey === 'other' ? (textOrNull(input.note) ?? '') : input.reasonKey;
}

/** A new credit as `POST /app/pending-credits` takes it. */
export function creditCreateBodyOf(input: CreditInput): ApiCreditCreate {
  return {
    direction: input.direction,
    amount: input.amount,
    reason: reasonOf(input),
    ...(input.contactId
      ? { contact_id: input.contactId }
      : { party_name: input.partyName.trim() }),
    invoice_id: input.invoiceId,
    settle_by: input.settleBy,
    note: textOrNull(input.note),
  };
}

/** Who a change names: the contact when it moved, else the supplier's name when it moved. */
function partyChangeOf(credit: PendingCreditRecord, input: CreditInput) {
  if (input.contactId) {
    return input.contactId === credit.contactId ? {} : { contact_id: input.contactId };
  }
  const name = input.partyName.trim();
  return credit.contactId === null && name === credit.partyName
    ? {}
    : { contact_id: null, party_name: name };
}

/**
 * A change of an open credit as `PATCH /app/pending-credits/:pending_credit_id` takes it — only
 * what differs (no `expected_updated_at`; the api adds it).
 */
export function creditChangeOf(
  credit: PendingCreditRecord,
  input: CreditInput,
): Omit<ApiCreditChange, 'expected_updated_at'> {
  const change: Omit<ApiCreditChange, 'expected_updated_at'> = partyChangeOf(
    credit,
    input,
  );
  if (input.direction !== credit.direction) change.direction = input.direction;
  if (input.amount !== credit.amount) change.amount = input.amount;
  const reason = reasonOf(input);
  if (reason !== credit.reason) change.reason = reason;
  if (input.invoiceId !== credit.invoiceId) change.invoice_id = input.invoiceId;
  if (input.settleBy !== credit.settleBy) change.settle_by = input.settleBy;
  const note = textOrNull(input.note);
  if (note !== credit.note) change.note = note;
  return change;
}

/**
 * How a credit is settled: given back or got back in money — at a branch, in split rows (part of
 * it or all), on a day — or used on one of the person's bills with a due (the receipt lands on that
 * invoice's branch, today; PAY-M6). Money in rupees.
 */
export type CreditSettlement =
  | {
      action: 'give_back' | 'got_back';
      branchId: string;
      splits: MoneySplit[];
      /** When it was paid; now when left out. */
      paidAt?: string;
    }
  | { action: 'use_on_bill'; invoiceId: string; amount: number };

/** The splits' sum, to the paisa. */
const splitsTotal = (splits: readonly MoneySplit[]) =>
  rupeesOfPaise(splits.reduce((sum, split) => sum + paiseOfRupees(split.amount), 0));

/** A settlement as `POST …/settle` takes it — a use on a bill sends no branch, splits or day. */
export function creditSettleBodyOf(settlement: CreditSettlement): ApiCreditSettle {
  if (settlement.action === 'use_on_bill') {
    return {
      method: 'use_on_bill',
      amount: settlement.amount,
      invoice_id: settlement.invoiceId,
    };
  }
  return {
    method: 'money',
    amount: splitsTotal(settlement.splits),
    branch_id: settlement.branchId,
    splits: settlement.splits.map(({ mode, amount }) => ({ mode, amount })),
    ...(settlement.paidAt ? { paid_at: settlement.paidAt } : {}),
  };
}

/**
 * What a settlement wrote: the credit after it, the amount settled now, and the entry it wrote —
 * its number, and the credit note a refund on an invoice wrote or the invoice a use on a bill
 * went to ("PAY-6 · CN-003", G-P12).
 */
export interface CreditSettleResult {
  credit: CreditRow;
  amount: number;
  paymentSeq: number | null;
  invoiceSeq: number | null;
  creditNoteSeq: number | null;
}

// ── Reads ──

type ApiSupplierRow = NonNullable<ApiData<'/app/suppliers', 'get'>>[number];

/** A Medical supplier's name (`GET /app/suppliers`) — a party Add pending keeps by name. */
export const supplierNameWire = wireSchema<ApiSupplierRow>()(
  z.object({ id: z.string(), name: z.string() }),
);

/**
 * Who a credit can be with — one row of Add pending's Who picker (`payments.md:157`): a patient,
 * a contact (a lead that never became a patient, a walk-in), or a supplier — a Clinic stock
 * vendor or a Medical supplier, kept by name (`party_name`).
 */
export type CreditPartyRow =
  | {
      kind: 'patient';
      contactId: string;
      patientId: string;
      seq: number;
      name: string;
      phone: string;
    }
  | { kind: 'contact'; contactId: string; name: string; phone: string }
  | { kind: 'vendor' | 'supplier'; id: string; name: string };

/**
 * The Pending read's params: which way (`direction` — the API takes one; both is none), the
 * state (`status`), Created and `q` (a `CR-` number, the supplier's name, or the person — D81),
 * and one person's or one invoice's credits. Newest first.
 */
export interface CreditListParams {
  direction?: CreditDirection[];
  status?: CreditStatus[];
  q?: string;
  created?: CreatedFilter;
  contactId?: string;
  invoiceId?: string;
}
