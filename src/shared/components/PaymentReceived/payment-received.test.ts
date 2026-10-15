import { describe, expect, it } from 'vitest';

import type { FeedbackItem, PatientReview } from '@/shared/api/app/feedback-contracts.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

import {
  modesOf,
  receivedFromLedgerRow,
  reviewAskState,
  reviewsOf,
} from './payment-received.ts';

function review(id: string, source: PatientReview['source']): PatientReview {
  return {
    id,
    patientId: 'pat_x',
    appointmentId: null,
    source,
    rating: 5,
    text: null,
    link: null,
    fileKeys: [],
    date: '2026-10-01',
    needsAction: false,
    actions: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('payment-received', () => {
  it('names each mode once, in the order paid', () => {
    expect(modesOf([{ mode: 'upi' }, { mode: 'cash' }, { mode: 'upi' }])).toEqual([
      'upi',
      'cash',
    ]);
  });

  it('reads a receipt: paid in full, part paid, or an advance', () => {
    const paid = receivedFromLedgerRow(
      ledgerRow({
        invoice: { seq: 785, number: '2026-27/0785', type: 'clinic', due: 0 },
      }),
    );
    expect(paid.outcome).toEqual({ kind: 'paid', invoiceSeq: 785 });
    const due = receivedFromLedgerRow(
      ledgerRow({
        invoice: { seq: 785, number: '2026-27/0785', type: 'clinic', due: 1200 },
      }),
    );
    expect(due.outcome).toEqual({ kind: 'due', invoiceSeq: 785, due: 1200 });
    expect(receivedFromLedgerRow(ledgerRow({ invoice: null })).outcome).toEqual({
      kind: 'advance',
    });
  });

  it('keeps the payer, their patient file and the branch for the review ask', () => {
    const row = ledgerRow({ partyName: 'Kavya Mehta' });
    expect(receivedFromLedgerRow(row)).toMatchObject({
      payerName: 'Kavya Mehta',
      patientId: row.patientId,
      contactId: row.contactId,
      branchId: row.branchId,
      paymentSeq: row.seq,
    });
  });

  it('asks unless there is a Google review, and keeps the newest three', () => {
    const items: FeedbackItem[] = [
      { kind: 'review', id: 'a', review: review('a', 'whatsapp') },
      { kind: 'checkIn', id: 'c', checkIn: {} as never },
      { kind: 'review', id: 'b', review: review('b', 'google') },
      { kind: 'review', id: 'd', review: review('d', 'video') },
      { kind: 'review', id: 'e', review: review('e', 'instagram') },
    ];
    const reviews = reviewsOf(items);
    expect(reviews.map((entry) => entry.id)).toEqual(['a', 'b', 'd', 'e']);
    const state = reviewAskState(reviews);
    expect(state.google?.id).toBe('b');
    expect(state.recent.map((entry) => entry.id)).toEqual(['a', 'b', 'd']);
    expect(state.total).toBe(4);
    expect(reviewAskState([review('x', 'whatsapp')]).google).toBeNull();
  });
});
