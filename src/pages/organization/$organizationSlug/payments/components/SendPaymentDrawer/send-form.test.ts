import { describe, expect, it } from 'vitest';

import type { OpenSupplierBill } from '@/shared/api/app/payments-contracts.ts';
import { ledgerRow, TEST_MONEY_BRANCH_ID } from '@/tests/utils/payments-doubles.ts';

import {
  ageTone,
  amountText,
  billOf,
  emptySendForm,
  paidToQuick,
  SEND_QUICK_FILLS,
  sendAmount,
  sendFormOf,
  sendInputOf,
  sendMissing,
  sendPatchOf,
  withBill,
} from './send-form.ts';

const TODAY = '2026-10-10';

/** A received Medical PO, ₹2,980 due. */
const PO_431: OpenSupplierBill = {
  kind: 'medical_po',
  purchaseId: 'mpo_7x2k9q4m1v8n3b6c5z0wa',
  seq: 431,
  billNo: '1631',
  supplierName: 'Shree Ramdev Medical Agency',
  date: '2026-10-01',
  due: 2980,
  daysPending: 9,
};
/** A Clinic stock purchase, ₹1,710.50 due. */
const STOCK_15: OpenSupplierBill = {
  ...PO_431,
  kind: 'stock_po',
  purchaseId: 'spur_ft5aosl5u6tyxqidd2e1a',
  seq: 15,
  supplierName: 'Cranix Pharma',
  due: 1710.5,
};

/** "Tea & snacks", ₹260 in cash — an expense. */
const TEA = ledgerRow({
  direction: 'paid',
  kind: 'expense',
  amount: 260,
  splits: [{ mode: 'cash', amount: 260 }],
  contactId: null,
  contact: null,
  partyName: 'Tea & snacks',
  patientId: null,
  invoiceId: null,
  invoice: null,
  payeeName: 'Tea & snacks',
  expenseCategory: 'misc',
  note: 'For the team',
});

describe('the send form', () => {
  it('starts on Consumables, Cash and today, with nothing filled', () => {
    expect(emptySendForm(TEST_MONEY_BRANCH_ID, TODAY)).toEqual({
      branchId: TEST_MONEY_BRANCH_ID,
      bill: null,
      category: 'consumables',
      payeeName: '',
      note: '',
      amount: '',
      paidOn: TODAY,
      mode: 'cash',
    });
  });

  it('fills Paid to and the due (rupees) from a picked bill — and keeps them for Other spend', () => {
    const picked = withBill(emptySendForm(null, TODAY), STOCK_15);
    expect(picked).toMatchObject({
      bill: {
        kind: 'stock_po',
        purchaseId: 'spur_ft5aosl5u6tyxqidd2e1a',
        seq: 15,
        billNo: '1631',
        supplierName: 'Cranix Pharma',
      },
      payeeName: 'Cranix Pharma',
      amount: '1710.5',
      // A bill takes no category: the field keeps what it had.
      category: 'consumables',
    });
    expect(withBill(picked, null)).toMatchObject({
      bill: null,
      payeeName: 'Cranix Pharma',
      amount: '1710.5',
    });
  });

  it('finds the bill a `?bill=` link names among the open ones, by its public id', () => {
    expect(billOf([PO_431, STOCK_15], 'spur_ft5aosl5u6tyxqidd2e1a')).toBe(STOCK_15);
    expect(billOf([PO_431, STOCK_15], 'spur_paidmeanwhile000000')).toBeNull();
    expect(billOf([PO_431], undefined)).toBeNull();
  });

  it('tones a bill’s age: blush from 30 days, butter from 14', () => {
    expect(ageTone(30)).toBe('blush');
    expect(ageTone(14)).toBe('butter');
    expect(ageTone(3)).toBe('stone');
  });

  it('reads the typed rupees as paise, and shows paise as rupees', () => {
    expect(sendAmount({ amount: '3200' })).toBe(320_000);
    expect(sendAmount({ amount: '12.5' })).toBe(1250);
    expect(sendAmount({ amount: '' })).toBe(0);
    expect(amountText(320_000)).toBe('3200');
  });

  it('presets the three Quick fills of the design', () => {
    expect(SEND_QUICK_FILLS.map((fill) => [fill.id, fill.values])).toEqual([
      ['consumables', { category: 'consumables', amount: 320_000, mode: 'upi' }],
      ['tea', { category: 'misc', amount: 26_000, mode: 'cash' }],
      ['courier', { category: 'misc', amount: 15_000, mode: 'cash' }],
    ]);
  });

  it('asks for who was paid, then the amount', () => {
    expect(sendMissing(emptySendForm(null, TODAY))).toEqual(['payeeName', 'amount']);
    expect(sendMissing({ ...emptySendForm(null, TODAY), payeeName: ' X ' })).toEqual([
      'amount',
    ]);
  });

  it('sends a bill with its purchase and no category, other spend with its category — in rupees', () => {
    const bill = withBill(emptySendForm(TEST_MONEY_BRANCH_ID, TODAY), STOCK_15);
    expect(sendInputOf({ ...bill, note: ' Box 2 ' }, 'brn_fallback')).toEqual({
      branchId: TEST_MONEY_BRANCH_ID,
      bill: { kind: 'stock_po', purchaseId: 'spur_ft5aosl5u6tyxqidd2e1a' },
      payeeName: 'Cranix Pharma',
      amount: 1710.5,
      mode: 'cash',
      paidOn: TODAY,
      note: ' Box 2 ',
      attachmentKeys: [],
    });
    const spend = {
      ...emptySendForm(null, TODAY),
      category: 'rent' as const,
      payeeName: 'Landlord',
      amount: '25000',
      mode: 'upi' as const,
    };
    expect(sendInputOf(spend, 'brn_fallback')).toEqual({
      branchId: 'brn_fallback',
      bill: null,
      expenseCategory: 'rent',
      payeeName: 'Landlord',
      amount: 25_000,
      mode: 'upi',
      paidOn: TODAY,
      note: '',
      attachmentKeys: [],
    });
    expect(sendPatchOf(spend)).toEqual({
      payeeName: 'Landlord',
      expenseCategory: 'rent',
      amount: 25_000,
      mode: 'upi',
      note: '',
    });
  });

  it('opens an expense as its edit form, on its own day — a bill’s with its bill', () => {
    expect(sendFormOf(TEA, '2026-10-09')).toEqual({
      branchId: TEST_MONEY_BRANCH_ID,
      bill: null,
      category: 'misc',
      payeeName: 'Tea & snacks',
      note: 'For the team',
      amount: '260',
      paidOn: '2026-10-09',
      mode: 'cash',
    });
    const paid = sendFormOf(
      {
        ...TEA,
        kind: 'supplier_bill',
        expenseCategory: null,
        payeeName: 'ZZ Research Vendor',
        partyName: 'ZZ Research Vendor',
        bill: { kind: 'stock_po', purchaseId: 'spur_x', seq: 2, billNo: null },
      },
      TODAY,
    );
    expect(paid.bill).toEqual({
      kind: 'stock_po',
      purchaseId: 'spur_x',
      seq: 2,
      billNo: null,
      supplierName: 'ZZ Research Vendor',
    });
  });
});

describe('paidToQuick — the clinic’s own payees (feat-write-less)', () => {
  const rows = (...names: (string | null)[]) => names.map((payeeName) => ({ payeeName }));

  it('takes the newest four names, each once, then Electricity', () => {
    expect(
      paidToQuick(
        rows('Ankur', 'Meta ads', 'ankur', null, 'Tea', 'Courier', 'Rent'),
        'Electricity',
      ),
    ).toEqual(['Ankur', 'Meta ads', 'Tea', 'Courier', 'Electricity']);
  });

  it('is Electricity alone without history, and never twice', () => {
    expect(paidToQuick([], 'Electricity')).toEqual(['Electricity']);
    expect(paidToQuick(rows('electricity', 'Tea'), 'Electricity')).toEqual([
      'electricity',
      'Tea',
    ]);
  });
});
