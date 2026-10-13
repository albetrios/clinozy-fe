import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { branchRef, MAIN_BRANCH } from './fixtures/organization.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { staffRef } from './fixtures/staff.fixtures.ts';
import { appFixtures, resetAppFixtures } from './fixtures/world.fixtures.ts';
import {
  deleteFixturePayment,
  fixtureLedgerQueryKeys,
  listFixtureLedger,
  listFixtureOpenSupplierBills,
  payFixtureExpense,
  restoreFixturePayment,
} from './payments-fixture-api.ts';
import type { FixtureLedgerListParams } from './payments-fixture-contracts.ts';

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const MAIN = branchRef(MAIN_BRANCH);

const seqs = async (params: FixtureLedgerListParams = {}) =>
  (await listFixtureLedger(params)).items.map((row) => row.seq);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetAppFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetAppFixtures();
});

describe('fixtureLedgerQueryKeys', () => {
  it('keeps the fixture ledger apart from clinozy-be’s', () => {
    expect(fixtureLedgerQueryKeys.list({ scope: 'medical' })).toEqual([
      'app',
      'fixture-payments',
      'list',
      { scope: 'medical' },
    ]);
    expect(fixtureLedgerQueryKeys.openBills().slice(0, 2)).toEqual(
      fixtureLedgerQueryKeys.all,
    );
  });
});

describe('the fixture ledger (Medical › Payments)', () => {
  it('reads the world’s entries newest first, as live ledger rows in rupees', async () => {
    const rows = (await listFixtureLedger()).items;
    const receipt = rows.find((row) => row.seq === 5512);
    expect(receipt).toMatchObject({
      partyName: 'Rhea Shah',
      invoice: { seq: 785, number: 'INV-785', type: 'medical', due: 700 },
      by: { id: staffRef('FA'), initials: 'FA' },
      isSettled: false,
      editCount: 0,
      lastEdit: null,
      contact: null,
    });
    expect(receipt?.amount).toBe(
      (await appFixtures.payments.get(ref.payment(5512))).amount / 100,
    );
    // Yesterday stays open until tonight's midnight (Q-G2); older days are closed.
    expect(rows.find((row) => row.seq === 305)?.isSettled).toBe(true);
  });

  it('keeps to Medical’s own entries under the Medical scope, and filters as the ledger does', async () => {
    const medical = (await listFixtureLedger({ scope: 'medical' })).items;
    expect(medical.length).toBeGreaterThan(0);
    expect(
      medical.every(
        (row) =>
          row.invoice?.type === 'medical' ||
          row.bill?.kind === 'medical_po' ||
          row.expenseCategory === 'medicines',
      ),
    ).toBe(true);
    expect(await seqs({ kind: ['refund'] })).toEqual([5466]);
    expect(await seqs({ q: 'PAY-5512', branchIds: [MAIN] })).toEqual([5512]);
  });
});

describe('the fixture supplier bills', () => {
  it('lists the open bills oldest first, a Medical PO before a stock purchase on a day', async () => {
    expect(
      (await listFixtureOpenSupplierBills()).map((open) => [
        open.kind,
        open.seq,
        open.due,
      ]),
    ).toEqual([
      ['stock_po', 15, 171_000],
      ['medical_po', 431, 298_000],
      ['stock_po', 16, 60_000],
    ]);
  });

  it('pays a bill, deletes the payment and restores it — the purchase following', async () => {
    const row = await payFixtureExpense({
      branchId: MAIN,
      billRef: { kind: 'medical_po', purchaseId: ref.purchaseOrder(431), billNo: '1631' },
      payeeName: 'Shree Ramdev Medical Agency',
      expenseCategory: 'medicines',
      amount: 298_000,
      mode: 'upi',
      paidOn: '2026-10-03',
      note: null,
    });
    expect(row).toMatchObject({
      kind: 'supplier_bill',
      amount: 2980,
      bill: { kind: 'medical_po', seq: 431, billNo: '1631' },
      medicalPurchaseOrderId: ref.purchaseOrder(431),
    });
    const order = () => appFixtures.purchaseOrders.get(ref.purchaseOrder(431));
    expect(await order()).toMatchObject({ paid: 298_000, stage: 'paid' });

    await deleteFixturePayment(row.id, 'duplicate', null);
    expect(await order()).toMatchObject({ paid: 0, stage: 'received' });
    expect(await seqs({ q: `PAY-${row.seq}` })).toEqual([]);

    await restoreFixturePayment(row.id);
    expect(await order()).toMatchObject({ paid: 298_000, stage: 'paid' });
  });

  it('refuses more than a bill’s due, and any change to a closed day’s entry', async () => {
    const above = await payFixtureExpense({
      branchId: MAIN,
      billRef: { kind: 'stock_po', purchaseId: ref.stockPurchase(16), billNo: 'SW-77' },
      payeeName: 'Vendor',
      expenseCategory: 'consumables',
      amount: 60_100,
      mode: 'cash',
      paidOn: '2026-10-03',
      note: null,
    }).catch((caught: unknown) => caught);
    expect(isHttpError(above) && above.status).toBe(422);

    const closed = await deleteFixturePayment(ref.payment(305), 'mistake', null).catch(
      (caught: unknown) => caught,
    );
    expect(isHttpError(closed) && closed.status).toBe(409);
    expect(isHttpError(closed) && closed.message).toBe('PAY-305 · Day closed');
  });
});
