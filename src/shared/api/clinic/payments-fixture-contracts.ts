import { z } from 'zod';

import type { CreatedFilter } from './clinic-list-filters.ts';
import {
  civilDateSchema,
  dayCloseSchema,
  isoDateTimeSchema,
  OPENING_SOURCE_VALUES,
  paiseSchema,
  type PaymentDirection,
  type PaymentMode,
  paymentModeSchema,
  paymentSchema,
  pendingCreditSchema,
} from './clinic-schema.ts';
import type { LedgerKindFilter } from './payments-contracts.ts';

/*
 * The money records of the fixture world — the ledger entries, the pending credits and the day
 * closes as the rooms still on fixtures write them (the parked Medical room's sales, receipts,
 * refunds and PO payments; the fixture invoices server's "Paid now"). Money is paise here. The
 * Payments room itself reads clinozy-be (`payments-contracts.ts`, `credits-contracts.ts`,
 * `day-close-contracts.ts`); this goes with the last fixture room that writes money.
 */

// ── Ledger entries ──

/** The amount and the modes of an entry, before or after an edit. */
const paymentEditSideSchema = z.object({
  amount: paiseSchema,
  modes: z.array(paymentModeSchema),
});

/** One logged change of a fixture entry while its day is open. */
const paymentEditSchema = z.object({
  at: isoDateTimeSchema,
  byId: z.uuid(),
  from: paymentEditSideSchema,
  to: paymentEditSideSchema,
});

/**
 * A fixture ledger entry: the contract's `Payment` (`S:643–664`) with the plan's Reference, edit
 * log and bill photos (Appendix F).
 */
export const paymentRecordSchema = paymentSchema.extend({
  reference: z.string().max(60).nullable(),
  edits: z.array(paymentEditSchema),
  attachmentKeys: z.array(z.string()),
});

/** A fixture ledger entry, in paise. */
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;

// ── Pending credits ──

/** The fixture's reason chips of either direction (`payments.md:159`). */
const FIXTURE_CREDIT_REASON_KEYS = [
  'charged_twice',
  'advance_not_used',
  'package_cancelled',
  'overpaid',
  'returned_items',
  'other',
  'short_payment',
  'damaged_goods',
  'advance_given',
  'loan_to_staff',
] as const;

/**
 * A fixture pending credit: the contract's `PendingCredit` (`S:680–697`) with the plan's reason
 * chip, note, invoice, settle-by day, what is settled of it so far (paise) and when it was settled.
 */
export const pendingCreditRecordSchema = pendingCreditSchema.extend({
  reasonKey: z.enum(FIXTURE_CREDIT_REASON_KEYS).nullable(),
  note: z.string().max(300).nullable(),
  invoiceId: z.uuid().nullable(),
  settleBy: civilDateSchema.nullable(),
  adjusted: paiseSchema,
  settledAt: isoDateTimeSchema.nullable(),
});

/** A fixture pending credit. */
export type PendingCreditRecord = z.infer<typeof pendingCreditRecordSchema>;

// ── Day closes ──

/**
 * A fixture branch-day close: the contract's `DayClose` with the plan's recount source, who
 * accepted the opening, and the entries ticked in the review.
 */
export const dayCloseRecordSchema = dayCloseSchema.extend({
  openingSource: z.enum([...OPENING_SOURCE_VALUES, 'recounted']),
  openingAcceptedById: z.uuid().nullable(),
  checkedPaymentIds: z.array(z.uuid()),
});

/** A fixture day close. */
export type DayCloseRecord = z.infer<typeof dayCloseRecordSchema>;

// ── Reads ──

/**
 * The fixture ledger read's params — Medical › Payments' (`S:1662`): Show, What, Mode, Created,
 * `q` (a PAY- number, the party, an invoice number), the header branches (empty = all) and the
 * Medical scope (`scope=medical`, `S:71`): receipts on Medical invoices, Medical PO bills and
 * expenses in Medicines.
 */
export interface FixtureLedgerListParams {
  direction?: PaymentDirection;
  kind?: LedgerKindFilter[];
  mode?: PaymentMode[];
  created?: CreatedFilter;
  q?: string;
  branchIds?: string[];
  scope?: 'medical';
}

/**
 * A fixture supplier bill with a balance — Medical's "Pay all received" total: a received Medical
 * PO or a Clinic stock purchase of the fixture world, its due in paise.
 */
export interface FixtureSupplierBill {
  kind: 'medical_po' | 'stock_po';
  purchaseId: string;
  seq: number;
  billNo: string;
  supplierName: string;
  /** The purchase's calendar date. */
  date: string;
  due: number;
}
