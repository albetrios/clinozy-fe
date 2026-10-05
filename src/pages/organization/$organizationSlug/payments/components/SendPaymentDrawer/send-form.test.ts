import { describe, expect, it } from 'vitest';

import type {
  LedgerRow,
  OpenSupplierBill,
} from '@/shared/api/clinic/payments-contracts.ts';

import {
  ageTone,
  amountText,
  billOf,
  emptySendForm,
  SEND_QUICK_FILLS,
  sendAmount,
  sendFormOf,
  sendInputOf,
  sendMissing,
  sendPatchOf,
  withBill,
} from './send-form.ts';

const BRANCH = '00000000-0000-4000-8000-0000000b0001';
const TODAY = '2026-10-03';

const PO_431: OpenSupplierBill = {
  kind: 'medical_po',
  purchaseId: '6a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  seq: 431,
  billNo: '1631',
  supplierName: 'Shree Ramdev Medical Agency',
  date: '2026-09-24',
  due: 298_000,
  daysPending: 9,
};
const STOCK_15: OpenSupplierBill = {
  ...PO_431,
  kind: 'stock_po',
  purchaseId: '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  seq: 15,
  supplierName: 'Cranix Pharma',
  due: 171_000,
};

describe('the send form', () => {
  it('starts on Consumables, Cash and today, with nothing filled', () => {
    const values = emptySendForm(BRANCH, TODAY);
    expect(values).toMatchObject({
      category: 'consumables',
      mode: 'cash',
      paidOn: TODAY,
      bill: null,
    });
    expect(sendMissing(values)).toEqual(['payeeName', 'amount']);
  });

  it('fills Paid to, the due and the category from a picked bill — and keeps them for Other spend', () => {
    const picked = withBill(emptySendForm(BRANCH, TODAY), PO_431);
    expect(picked).toMatchObject({
      bill: { kind: 'medical_po', purchaseId: PO_431.purchaseId, billNo: '1631' },
      payeeName: 'Shree Ramdev Medical Agency',
      amount: '2980',
      category: 'medicines',
    });
    expect(withBill(emptySendForm(BRANCH, TODAY), STOCK_15).category).toBe('consumables');
    expect(withBill(picked, null)).toMatchObject({
      bill: null,
      payeeName: picked.payeeName,
    });
    expect(sendMissing(picked)).toEqual([]);
  });

  it('finds the bill a `?bill=` link names among the open ones', () => {
    expect(billOf([PO_431, STOCK_15], `is:${STOCK_15.purchaseId}`)).toBe(STOCK_15);
    expect(billOf([PO_431], undefined)).toBeNull();
  });

  it('tones a bill’s age: blush from 30 days, butter from 14', () => {
    expect(ageTone(31)).toBe('blush');
    expect(ageTone(14)).toBe('butter');
    expect(ageTone(12)).toBe('stone');
  });

  it('reads the typed rupees as paise, and shows paise as rupees', () => {
    expect(sendAmount({ amount: '3200' })).toBe(320_000);
    expect(sendAmount({ amount: '12.5' })).toBe(1_250);
    expect(sendAmount({ amount: '' })).toBe(0);
    expect(amountText(26_000)).toBe('260');
    expect(amountText(0)).toBe('');
  });

  it('presets the three Quick fills of the design', () => {
    expect(
      SEND_QUICK_FILLS.map((fill) => [fill.id, fill.values.amount, fill.values.mode]),
    ).toEqual([
      ['consumables', 320_000, 'upi'],
      ['tea', 26_000, 'cash'],
      ['courier', 15_000, 'cash'],
    ]);
  });

  it('sends the bill or the payee, the amount in paise and the trimmed note', () => {
    const values = {
      ...withBill(emptySendForm(null, TODAY), PO_431),
      note: '  ',
    };
    expect(sendInputOf(values, BRANCH, ['bills/1.jpg'])).toEqual({
      branchId: BRANCH,
      billRef: { kind: 'medical_po', purchaseId: PO_431.purchaseId, billNo: '1631' },
      payeeName: 'Shree Ramdev Medical Agency',
      expenseCategory: 'medicines',
      amount: 298_000,
      mode: 'cash',
      paidOn: TODAY,
      note: null,
      attachmentKeys: ['bills/1.jpg'],
    });
    expect(sendPatchOf({ ...values, note: 'Gloves' })).toEqual({
      payeeName: 'Shree Ramdev Medical Agency',
      expenseCategory: 'medicines',
      amount: 298_000,
      mode: 'cash',
      note: 'Gloves',
    });
  });

  it('opens an expense as its edit form, on its own day', () => {
    const entry = {
      branchId: BRANCH,
      payeeName: 'Tea & snacks',
      partyName: 'Tea & snacks',
      expenseCategory: 'misc',
      note: null,
      amount: 26_000,
      splits: [{ mode: 'cash', amount: 26_000 }],
    } as unknown as LedgerRow;
    expect(sendFormOf(entry, '2026-10-02')).toEqual({
      branchId: BRANCH,
      bill: null,
      category: 'misc',
      payeeName: 'Tea & snacks',
      note: '',
      amount: '260',
      paidOn: '2026-10-02',
      mode: 'cash',
    });
  });
});
