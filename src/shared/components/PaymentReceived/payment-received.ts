import type { PaymentMode } from '@/shared/api/app/app-schema.ts';
import type { FeedbackItem, PatientReview } from '@/shared/api/app/feedback-contracts.ts';
import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';

import { PAYMENT_RECEIVED_REVIEW_LIMIT } from './payment-received.constants.ts';

/** What the money did, for the view's last line. Money in rupees. */
export type ReceivedOutcome =
  | { kind: 'paid'; invoiceSeq: number }
  | { kind: 'due'; invoiceSeq: number; due: number }
  | { kind: 'advance' }
  | { kind: 'creditSettled'; creditSeq: number }
  | { kind: 'creditLeft'; creditSeq: number; left: number };

/**
 * A payment just received, as the view shows it — the same facts whichever drawer took it
 * (Receive payment, an invoice paid now, a credit got back). Money in rupees.
 */
export interface ReceivedPayment {
  amount: number;
  modes: readonly PaymentMode[];
  /** The payer's name, as the receipt names them. */
  payerName: string;
  /** "PAY-5512"'s number, when the entry came back. */
  paymentSeq: number | null;
  outcome: ReceivedOutcome;
  /** The payer's patient file — the review ask needs one (D9). */
  patientId: string | null;
  contactId: string | null;
  /** The branch whose Google review link the ask sends. */
  branchId: string;
}

/** The modes a payment's splits used, each once, in the order paid. */
export function modesOf(splits: readonly { mode: PaymentMode }[]): PaymentMode[] {
  return [...new Set(splits.map((split) => split.mode))];
}

/** A receipt as the view shows it: its invoice paid in full, part paid, or an advance. */
export function receivedFromLedgerRow(row: LedgerRow): ReceivedPayment {
  let outcome: ReceivedOutcome = { kind: 'advance' };
  if (row.invoice) {
    outcome =
      row.invoice.due > 0
        ? { kind: 'due', invoiceSeq: row.invoice.seq, due: row.invoice.due }
        : { kind: 'paid', invoiceSeq: row.invoice.seq };
  }
  return {
    amount: row.amount,
    modes: modesOf(row.splits),
    payerName: row.partyName,
    paymentSeq: row.seq,
    outcome,
    patientId: row.patientId,
    contactId: row.contactId,
    branchId: row.branchId,
  };
}

/** The patient's reviews, newest first (the feedback list also carries check-ins). */
export function reviewsOf(items: readonly FeedbackItem[]): PatientReview[] {
  return items.flatMap((item) => (item.kind === 'review' ? [item.review] : []));
}

/** The review ask's state for a patient (D11): asked for a Google review unless they left one. */
export interface ReviewAskState {
  /** Their newest Google review — they are thanked, not asked. */
  google: PatientReview | null;
  /** The newest few, for "Previous reviews". */
  recent: PatientReview[];
  total: number;
}

/** {@link ReviewAskState} from the patient's reviews, newest first. */
export function reviewAskState(reviews: readonly PatientReview[]): ReviewAskState {
  return {
    google: reviews.find((review) => review.source === 'google') ?? null,
    recent: reviews.slice(0, PAYMENT_RECEIVED_REVIEW_LIMIT),
    total: reviews.length,
  };
}
