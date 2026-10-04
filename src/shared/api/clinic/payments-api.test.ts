import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { invoiceBalance } from './clinic-money.ts';
import { settleCredit } from './credits-api.ts';
import { branchRef, MAIN_BRANCH } from './fixtures/organization.fixtures.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  attachPaymentFile,
  deletePayment,
  fetchPayment,
  listLedger,
  listOpenInvoices,
  listOpenSupplierBills,
  payExpense,
  paymentQueryKeys,
  receivePayment,
  restorePayment,
  updatePayment,
} from './payments-api.ts';
import type { LedgerListParams } from './payments-contracts.ts';

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const MAIN = branchRef(MAIN_BRANCH);
const RHEA = patientRef('Rhea Shah');
const KIRAN = patientRef('Kiran Desai');
const DHRUV = patientRef('Dhruv Patel');

/** The rejection a call ends in, so its status and fields can be read. */
async function failureOf(call: Promise<unknown>) {
  const error = await call.then(
    () => null,
    (caught: unknown) => caught,
  );
  if (!isHttpError(error)) throw new Error('expected an HTTP error');
  const body = (
    error.data as { error: { code: string; detail: string; fields?: object } }
  ).error;
  return { status: error.status, ...body };
}

const seqs = async (params: LedgerListParams = {}) =>
  (await listLedger(params)).items.map((row) => row.seq);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('paymentQueryKeys', () => {
  it('nests every key under ["clinic", "payments"], so one invalidation reaches them all', () => {
    expect(paymentQueryKeys.list({ direction: 'paid' })).toEqual([
      'clinic',
      'payments',
      'list',
      { direction: 'paid' },
    ]);
    for (const key of [
      paymentQueryKeys.detail('X'),
      paymentQueryKeys.openInvoices('P'),
      paymentQueryKeys.openBills(),
    ]) {
      expect(key.slice(0, 2)).toEqual(paymentQueryKeys.all);
    }
  });
});

describe('the ledger (listLedger, S:1699)', () => {
  it('merges receipts, refunds and expenses, newest first', async () => {
    expect(await seqs()).toEqual([
      5509, 309, 310, 5513, 5512, 311, 306, 5507, 305, 5505, 301, 5488, 5501, 5480, 5470,
      5466,
    ]);
  });

  it('names each row: its party, invoice, author, and whether its day is closed', async () => {
    const rows = (await listLedger()).items;
    const bySeq = (seq: number) => rows.find((row) => row.seq === seq);
    expect(bySeq(5512)).toMatchObject({
      partyName: 'Rhea Shah',
      patientSeq: expect.any(Number),
      invoice: { seq: 785, type: 'medical', due: 70_000 },
      by: { id: staffRef('FA'), initials: 'FA' },
      locked: false,
    });
    expect(bySeq(311)).toMatchObject({
      partyName: 'Medline Surgicals',
      patientSeq: null,
      expenseCategory: 'consumables',
      locked: false,
    });
    // Yesterday stays open until tonight's midnight (Q-G2); older days are closed.
    expect(bySeq(306)?.locked).toBe(false);
    expect(bySeq(305)?.locked).toBe(true);
    expect(bySeq(5466)?.locked).toBe(true);
  });

  it('closes every past day before yesterday — the auto-close job (Q-G2)', async () => {
    await listLedger();
    const closes = clinicFixtures.dayCloses.snapshot();
    const auto = closes.filter((close) => close.openingAcceptedAt === null);
    expect(auto.map((close) => close.date).sort()).toEqual([
      '2026-06-10',
      '2026-06-12',
      '2026-08-29',
      '2026-09-01',
      '2026-09-03',
      '2026-09-07',
    ]);
    // Cash taken as expected: 12 Jun opens on 10 Jun's ₹2,000 and takes ₹400 in.
    expect(auto.find((close) => close.date === '2026-06-12')).toMatchObject({
      openingCash: 200_000,
      openingSource: 'carried',
      countedCash: 240_000,
      closedById: null,
    });
    // Idempotent: a second read closes nothing more.
    await listLedger();
    expect(clinicFixtures.dayCloses.snapshot()).toHaveLength(closes.length);
  });

  it('filters by Show, What, Mode, the day under review and the branch', async () => {
    expect(await seqs({ direction: 'paid' })).toEqual([
      309, 310, 311, 306, 305, 301, 5466,
    ]);
    expect(await seqs({ kind: ['refund'] })).toEqual([5466]);
    // A supplier bill is an expense.
    expect(await seqs({ kind: ['expense'], mode: ['cash'] })).toEqual([310, 306]);
    expect(await seqs({ mode: ['card'] })).toEqual([5509, 309]);
    expect(await seqs({ day: '2026-10-02' })).toEqual([306, 5507]);
    expect(await seqs({ branchIds: [ref.branch(99)] })).toEqual([]);
  });

  it('searches the PAY- number, the party, an invoice number and the note', async () => {
    expect(await seqs({ q: 'PAY-5512' })).toEqual([5512]);
    expect(await seqs({ q: 'medline' })).toEqual([311]);
    expect(await seqs({ q: '#785' })).toEqual([5512]);
    expect(await seqs({ q: 'gauze' })).toEqual([311]);
  });

  it('reads one entry, or a 404 for an unknown one', async () => {
    expect((await fetchPayment(ref.payment(310))).partyName).toBe('Tea & snacks');
    expect((await failureOf(fetchPayment(ref.payment(1)))).status).toBe(404);
  });
});

describe('Receive payment (receivePayment, S:1708)', () => {
  it('records a receipt against an invoice; the invoice’s due follows', async () => {
    const row = await receivePayment({
      branchId: MAIN,
      patientId: KIRAN,
      invoiceId: ref.invoice(784),
      splits: [
        { mode: 'cash', amount: 400_000 },
        { mode: 'upi', amount: 455_000 },
      ],
      reference: '4321',
      note: null,
    });
    expect(row).toMatchObject({
      seq: 5514,
      direction: 'received',
      kind: 'receipt',
      amount: 855_000,
      reference: '4321',
      partyName: 'Kiran Desai',
      locked: false,
    });
    const invoice = await clinicFixtures.invoices.get(ref.invoice(784));
    expect(invoiceBalance(invoice, clinicFixtures.payments.snapshot()).due).toBe(0);
  });

  it('requires a patient — the prototype saved without one (§7.3)', async () => {
    const failure = await failureOf(
      receivePayment({
        branchId: MAIN,
        patientId: '' as string,
        invoiceId: null,
        splits: [{ mode: 'cash', amount: 50_000 }],
        reference: null,
        note: null,
      }),
    );
    expect(failure).toMatchObject({ status: 422, detail: 'Pick a patient' });
  });

  it('refuses an amount above the invoice’s due (S:1708)', async () => {
    const failure = await failureOf(
      receivePayment({
        branchId: MAIN,
        patientId: RHEA,
        invoiceId: ref.invoice(785),
        splits: [{ mode: 'upi', amount: 70_100 }],
        reference: null,
        note: null,
      }),
    );
    expect(failure.status).toBe(422);
    expect(failure.fields).toHaveProperty('splits');
  });

  it('refuses an invoice of another patient, and an empty amount', async () => {
    const other = await failureOf(
      receivePayment({
        branchId: MAIN,
        patientId: RHEA,
        invoiceId: ref.invoice(784),
        splits: [{ mode: 'upi', amount: 100 }],
        reference: null,
        note: null,
      }),
    );
    expect(other.fields).toHaveProperty('invoiceId');
    const empty = await failureOf(
      receivePayment({
        branchId: MAIN,
        patientId: RHEA,
        invoiceId: null,
        splits: [{ mode: 'upi', amount: 0 }],
        reference: null,
        note: null,
      }),
    );
    expect(empty).toMatchObject({ status: 422, detail: 'Enter an amount' });
  });

  it('answers a closed day with a conflict', async () => {
    await clinicFixtures.dayCloses.create({
      branchId: MAIN,
      date: '2026-10-03',
      openingCash: 200_000,
      openingSource: 'default_float',
      openingAcceptedAt: NOW.toISOString(),
      countedCash: 200_000,
      closedAt: NOW.toISOString(),
      closedById: staffRef('RS'),
    });
    const failure = await failureOf(
      receivePayment({
        branchId: MAIN,
        patientId: RHEA,
        invoiceId: null,
        splits: [{ mode: 'cash', amount: 10_000 }],
        reference: null,
        note: null,
      }),
    );
    expect(failure).toMatchObject({ status: 409, code: 'conflict' });
  });
});

describe('Send payment (payExpense, S:1709)', () => {
  it('adds clinic spend on the day it was paid', async () => {
    const row = await payExpense({
      branchId: MAIN,
      billRef: null,
      payeeName: 'Tea & snacks',
      expenseCategory: 'misc',
      amount: 26_000,
      mode: 'cash',
      paidOn: '2026-10-02',
      note: null,
      attachmentKeys: ['uploads/bill-1.jpg'],
    });
    expect(row).toMatchObject({
      kind: 'expense',
      direction: 'paid',
      splits: [{ mode: 'cash', amount: 26_000 }],
      attachmentKeys: ['uploads/bill-1.jpg'],
    });
    expect(row.paidAt.startsWith('2026-10-02')).toBe(true);
  });

  it('pays a supplier bill: the PO’s paid rises and a settled Medical PO is Paid (Q-M1)', async () => {
    const bill = (await listOpenSupplierBills()).find((open) => open.seq === 431);
    expect(bill).toMatchObject({ kind: 'medical_po', due: 298_000, billNo: '1631' });
    const row = await payExpense({
      branchId: MAIN,
      billRef: { kind: 'medical_po', purchaseId: ref.purchaseOrder(431), billNo: '1631' },
      payeeName: 'Shree Ramdev Medical Agency',
      expenseCategory: 'medicines',
      amount: 298_000,
      mode: 'upi',
      paidOn: '2026-10-03',
      note: null,
      attachmentKeys: [],
    });
    expect(row).toMatchObject({
      kind: 'supplier_bill',
      bill: { kind: 'medical_po', seq: 431, billNo: '1631' },
    });
    const order = await clinicFixtures.purchaseOrders.get(ref.purchaseOrder(431));
    expect(order).toMatchObject({ paid: 298_000, stage: 'paid' });
    expect((await listOpenSupplierBills()).map((open) => open.seq)).not.toContain(431);
  });

  it('lists the open bills oldest first, and refuses more than a bill’s due', async () => {
    const bills = await listOpenSupplierBills();
    expect(bills.map((open) => [open.kind, open.seq, open.due])).toEqual([
      ['stock_po', 15, 171_000],
      // The same day: a Medical PO before a Clinic stock purchase, as drawn.
      ['medical_po', 431, 298_000],
      ['stock_po', 16, 60_000],
    ]);
    const failure = await failureOf(
      payExpense({
        branchId: MAIN,
        billRef: { kind: 'stock_po', purchaseId: ref.stockPurchase(16), billNo: 'SW-77' },
        payeeName: 'Vendor',
        expenseCategory: 'consumables',
        amount: 60_100,
        mode: 'cash',
        paidOn: '2026-10-03',
        note: null,
        attachmentKeys: [],
      }),
    );
    expect(failure.status).toBe(422);
  });

  it('asks who was paid and the amount', async () => {
    const failure = await failureOf(
      payExpense({
        branchId: MAIN,
        billRef: null,
        payeeName: ' ',
        expenseCategory: 'misc',
        amount: 0,
        mode: 'cash',
        paidOn: '2026-10-03',
        note: null,
        attachmentKeys: [],
      }),
    );
    expect(failure).toMatchObject({
      status: 422,
      detail: 'Add who was paid and the amount',
    });
  });
});

describe('changing and deleting an entry (S:1710, S:1546)', () => {
  it('logs a change of the amount or the modes on the entry', async () => {
    const row = await updatePayment(ref.payment(5512), {
      splits: [{ mode: 'upi', amount: 70_000 }],
    });
    expect(row.amount).toBe(70_000);
    expect(row.edits).toEqual([
      {
        at: NOW.toISOString(),
        byId: staffRef('RS'),
        from: { amount: 60_000, modes: ['upi'] },
        to: { amount: 70_000, modes: ['upi'] },
      },
    ]);
    // A note alone is no logged change.
    const again = await updatePayment(ref.payment(5512), { note: 'Paid at the desk' });
    expect(again.edits).toHaveLength(1);
  });

  it('keeps a receipt within its invoice’s due, its own amount counted back', async () => {
    const failure = await failureOf(
      updatePayment(ref.payment(5512), { splits: [{ mode: 'upi', amount: 130_100 }] }),
    );
    expect(failure.status).toBe(422);
  });

  it('changes an expense’s payee, amount and mode', async () => {
    const row = await updatePayment(ref.payment(310), { amount: 30_000, mode: 'upi' });
    expect(row).toMatchObject({
      amount: 30_000,
      splits: [{ mode: 'upi', amount: 30_000 }],
    });
    expect(row.edits.at(-1)?.from).toEqual({ amount: 26_000, modes: ['cash'] });
  });

  it('refuses to touch a closed day’s entry: "PAY-305 · Day closed"', async () => {
    const edit = await failureOf(updatePayment(ref.payment(305), { amount: 1 }));
    expect(edit).toMatchObject({ status: 409, detail: 'PAY-305 · Day closed' });
    const removal = await failureOf(deletePayment(ref.payment(305), 'mistake', null));
    expect(removal.status).toBe(409);
  });

  it('refuses to touch an entry a pending credit settled: it is the credit’s', async () => {
    const { paymentSeq } = await settleCredit(ref.pendingCredit(2), {
      action: 'give_back',
      splits: [{ mode: 'cash', amount: 50_000 }],
    });
    const settled = clinicFixtures.payments.snapshot((row) => row.seq === paymentSeq)[0];
    if (!settled) throw new Error('the settlement wrote an entry');
    const edit = await failureOf(updatePayment(settled.id, { note: 'Changed' }));
    expect(edit).toMatchObject({ status: 409, detail: `PAY-${paymentSeq} · From CR-2` });
    const removal = await failureOf(deletePayment(settled.id, 'mistake', null));
    expect(removal.status).toBe(409);
  });

  it('files an uploaded bill photo on its entry, after the save', async () => {
    const row = await payExpense({
      branchId: MAIN,
      billRef: null,
      payeeName: 'Courier',
      expenseCategory: 'misc',
      amount: 15_000,
      mode: 'cash',
      paidOn: '2026-10-03',
      note: null,
      attachmentKeys: [],
    });
    await attachPaymentFile({ paymentId: row.id, key: 'org/bills/bill-1.jpg' });
    await attachPaymentFile({ paymentId: row.id, key: 'org/bills/bill-2.jpg' });
    expect((await clinicFixtures.payments.get(row.id)).attachmentKeys).toEqual([
      'org/bills/bill-1.jpg',
      'org/bills/bill-2.jpg',
    ]);
  });

  it('deletes an open-day entry and restores it, a supplier bill’s purchase following', async () => {
    const row = await payExpense({
      branchId: MAIN,
      billRef: { kind: 'stock_po', purchaseId: ref.stockPurchase(15), billNo: 'CX-118' },
      payeeName: 'Cranix Pharma',
      expenseCategory: 'consumables',
      amount: 171_000,
      mode: 'cash',
      paidOn: '2026-10-03',
      note: null,
      attachmentKeys: [],
    });
    const paid = async () =>
      (await clinicFixtures.stockPurchases.get(ref.stockPurchase(15))).paid;
    expect(await paid()).toBe(171_000);
    await deletePayment(row.id, 'duplicate', null);
    expect(await paid()).toBe(0);
    expect(await seqs({ q: `PAY-${row.seq}` })).toEqual([]);
    await restorePayment(row.id);
    expect(await paid()).toBe(171_000);
    expect(await seqs({ q: `PAY-${row.seq}` })).toEqual([row.seq]);
  });
});

describe('listOpenInvoices (S:1702)', () => {
  it('lists a patient’s invoices with a due, oldest first', async () => {
    expect(await listOpenInvoices(RHEA)).toEqual([
      expect.objectContaining({ seq: 785, type: 'medical', bill: 130_000, due: 70_000 }),
    ]);
    expect(await listOpenInvoices(DHRUV)).toEqual([]);
  });
});
