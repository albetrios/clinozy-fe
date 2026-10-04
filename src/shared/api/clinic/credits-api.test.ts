import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { invoiceBalance } from './clinic-money.ts';
import {
  createCredit,
  creditQueryKeys,
  deleteCredit,
  fetchCredit,
  listPendingCredits,
  restoreCredit,
  settleCredit,
  updateCredit,
} from './credits-api.ts';
import type { CreditInput } from './credits-contracts.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';

/** 10:00 on 3 Oct, clinic time — the seed day (27 Sep) is today. */
const NOW = new Date('2026-10-03T04:30:00Z');
const TANVI = patientRef('Tanvi Shah');
const RHEA = patientRef('Rhea Shah');
const CR_TWO = ref.pendingCredit(2);
const CR_ONE = ref.pendingCredit(1);

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

const GIVE: CreditInput = {
  direction: 'give',
  partyName: 'Rhea Shah',
  patientId: RHEA,
  amount: 50_000,
  reasonKey: 'overpaid',
  invoiceId: ref.invoice(785),
  settleBy: null,
  note: null,
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('creditQueryKeys', () => {
  it('nests every key under ["clinic", "credits"]', () => {
    expect(creditQueryKeys.list({ status: ['open'] }).slice(0, 2)).toEqual(
      creditQueryKeys.all,
    );
    expect(creditQueryKeys.detail('X').slice(0, 2)).toEqual(creditQueryKeys.all);
  });
});

describe('Pending (listPendingCredits, S:1700)', () => {
  it('reads the credits newest number first, each naming its patient and source entry', async () => {
    const { items } = await listPendingCredits();
    // CR-2 above CR-1 as the prototype lists them, though CR-1's "Since" is later.
    expect(items.map((credit) => credit.seq)).toEqual([2, 1]);
    expect(items[0]).toMatchObject({
      partyName: 'Tanvi Shah',
      patientId: TANVI,
      patientSeq: expect.any(Number),
      source: { seq: 5466, direction: 'paid', kind: 'refund' },
      status: 'open',
      adjusted: 0,
    });
    expect(items[1]).toMatchObject({ patientSeq: null, source: { seq: 305 } });
  });

  it('filters by which way, state and search', async () => {
    const seqsOf = async (params: Parameters<typeof listPendingCredits>[0]) =>
      (await listPendingCredits(params)).items.map((credit) => credit.seq);
    expect(await seqsOf({ direction: ['give'] })).toEqual([2]);
    expect(await seqsOf({ status: ['used'] })).toEqual([]);
    expect(await seqsOf({ q: 'CR-1' })).toEqual([1]);
    expect(await seqsOf({ q: 'gloves' })).toEqual([1]);
  });
});

describe('Add / Edit pending (S:1712)', () => {
  it('stores the chip’s text as the reason, and a Settle by day opens a task', async () => {
    const tasks = clinicFixtures.tasks.snapshot().length;
    const credit = await createCredit({ ...GIVE, settleBy: '2026-10-10' });
    expect(credit).toMatchObject({
      seq: 3,
      reason: 'Overpaid',
      reasonKey: 'overpaid',
      status: 'open',
      adjusted: 0,
    });
    expect(clinicFixtures.tasks.snapshot()).toHaveLength(tasks + 1);
  });

  it('stores the note as the reason for "Other", and asks for one', async () => {
    const credit = await createCredit({
      ...GIVE,
      reasonKey: 'other',
      note: 'Refund to the same UPI id',
    });
    expect(credit.reason).toBe('Refund to the same UPI id');
    const failure = await failureOf(createCredit({ ...GIVE, reasonKey: 'other' }));
    expect(failure).toMatchObject({ status: 422, detail: 'Add a note for “Other”' });
  });

  it('asks who and the amount, and refuses another patient’s invoice', async () => {
    expect((await failureOf(createCredit({ ...GIVE, partyName: '' }))).detail).toBe(
      'Pick who',
    );
    expect((await failureOf(createCredit({ ...GIVE, amount: 0 }))).detail).toBe(
      'Enter the amount',
    );
    const other = await failureOf(createCredit({ ...GIVE, invoiceId: ref.invoice(784) }));
    expect(other.fields).toHaveProperty('invoiceId');
  });

  it('edits an open credit; a settled one is a conflict', async () => {
    const updated = await updateCredit(CR_ONE, {
      direction: 'take',
      partyName: 'Medline Surgicals',
      patientId: null,
      amount: 90_000,
      reasonKey: 'damaged_goods',
      invoiceId: null,
      settleBy: null,
      note: null,
    });
    expect(updated).toMatchObject({ amount: 90_000, reason: 'Damaged goods returned' });
    await settleCredit(CR_ONE, {
      action: 'got_back',
      splits: [{ mode: 'cash', amount: 90_000 }],
    });
    const failure = await failureOf(
      updateCredit(CR_ONE, {
        ...GIVE,
        direction: 'take',
        patientId: null,
        invoiceId: null,
      }),
    );
    expect(failure.status).toBe(409);
  });

  it('deletes and restores a credit', async () => {
    await deleteCredit(CR_TWO, 'duplicate', null);
    expect((await failureOf(fetchCredit(CR_TWO))).status).toBe(404);
    await restoreCredit(CR_TWO);
    expect((await fetchCredit(CR_TWO)).seq).toBe(2);
  });
});

describe('settling a credit (settleCredit, S:1713)', () => {
  it('gives a patient’s money back as a refund — in part, the rest staying open', async () => {
    const result = await settleCredit(CR_TWO, {
      action: 'give_back',
      splits: [{ mode: 'upi', amount: 20_000 }],
    });
    expect(result).toMatchObject({ amount: 20_000, creditNoteSeq: null });
    expect(result.credit).toMatchObject({ status: 'open', adjusted: 20_000 });
    const entry = clinicFixtures.payments.snapshot(
      (row) => row.seq === result.paymentSeq,
    )[0];
    expect(entry).toMatchObject({
      direction: 'paid',
      kind: 'refund',
      patientId: TANVI,
      pendingCreditId: CR_TWO,
      note: 'Charged twice for corn removal',
    });

    const rest = await settleCredit(CR_TWO, {
      action: 'give_back',
      splits: [{ mode: 'cash', amount: 30_000 }],
    });
    expect(rest.credit).toMatchObject({ status: 'given_back', adjusted: 50_000 });
    expect(rest.credit.settledAt).not.toBeNull();
  });

  it('writes a credit note when the credit names its invoice', async () => {
    const credit = await createCredit(GIVE);
    const result = await settleCredit(credit.id, {
      action: 'give_back',
      splits: [{ mode: 'upi', amount: 50_000 }],
    });
    expect(result.creditNoteSeq).toBe(1);
    const note = clinicFixtures.creditNotes.snapshot()[0];
    expect(note).toMatchObject({ invoiceId: ref.invoice(785), amount: 50_000 });
  });

  it('takes a party’s money in as money back', async () => {
    const result = await settleCredit(CR_ONE, {
      action: 'got_back',
      splits: [{ mode: 'cash', amount: 80_000 }],
    });
    expect(result.credit.status).toBe('got_back');
    const entry = clinicFixtures.payments.snapshot(
      (row) => row.seq === result.paymentSeq,
    )[0];
    expect(entry).toMatchObject({
      direction: 'received',
      kind: 'money_back',
      payeeName: 'Medline Surgicals',
    });
  });

  it('refuses nothing, and more than what is owed', async () => {
    expect(
      (await failureOf(settleCredit(CR_TWO, { action: 'give_back', splits: [] }))).detail,
    ).toBe('Enter the amount');
    expect(
      (
        await failureOf(
          settleCredit(CR_TWO, {
            action: 'give_back',
            splits: [{ mode: 'cash', amount: 50_100 }],
          }),
        )
      ).detail,
    ).toBe('More than what is owed');
  });

  it('uses a give credit on the patient’s oldest due invoice as a Credit receipt (Q-G9)', async () => {
    const result = await settleCredit(CR_TWO, { action: 'use_on_bill' });
    // Tanvi's INV-772 owes ₹600; the credit is ₹500 — all of it is used.
    expect(result).toMatchObject({ amount: 50_000, invoiceSeq: 772 });
    expect(result.credit).toMatchObject({ status: 'used', adjusted: 50_000 });
    const invoice = await clinicFixtures.invoices.get(ref.invoice(772));
    expect(invoiceBalance(invoice, clinicFixtures.payments.snapshot()).due).toBe(10_000);
    const entry = clinicFixtures.payments.snapshot(
      (row) => row.seq === result.paymentSeq,
    )[0];
    expect(entry?.splits).toEqual([{ mode: 'credit', amount: 50_000 }]);
  });

  it('answers "nothing due" with a conflict, and a take credit never adjusts', async () => {
    await settleCredit(CR_TWO, { action: 'use_on_bill' });
    const second = await createCredit({
      ...GIVE,
      partyName: 'Tanvi Shah',
      patientId: TANVI,
      invoiceId: null,
      amount: 20_000,
    });
    // INV-772 has ₹100 left: a partial use, the rest open.
    const partial = await settleCredit(second.id, { action: 'use_on_bill' });
    expect(partial.credit).toMatchObject({ status: 'open', adjusted: 10_000 });
    const nothing = await failureOf(settleCredit(second.id, { action: 'use_on_bill' }));
    expect(nothing).toMatchObject({ status: 409, code: 'conflict' });
    const take = await failureOf(settleCredit(CR_ONE, { action: 'use_on_bill' }));
    expect(take.status).toBe(409);
  });
});
