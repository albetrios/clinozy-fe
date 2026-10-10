import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/shared/api/clinic/directory-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchTeamDirectory: vi.fn(),
}));
import { api } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import { fetchTeamDirectory } from '@/shared/api/clinic/directory-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import {
  ledgerRow,
  paymentWire,
  TEST_INVOICE_ID,
  TEST_MONEY_AUTHOR_ID,
  TEST_MONEY_BRANCH_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
  TEST_PAYMENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  deletePayment,
  fetchLedgerCount,
  fetchPayment,
  ledgerListQuery,
  listDayPayments,
  listInvoicePayments,
  listLedger,
  listOpenSupplierBills,
  listPatientPayments,
  listPaymentEdits,
  payExpense,
  receivePayment,
  restorePayment,
  reversePayment,
  updatePayment,
} from './payments-api.ts';
import { editSidesOf } from './payments-contracts.ts';

/** The clinic's day every range here is read on. */
const TODAY = '2026-10-10';

const STOCK_PURCHASE_ID = 'spur_0irgmlbrv8akvoipmawa8';
const MEDICAL_ORDER_ID = 'mpo_0irgmlbrv8akvoipmawa8';
const VENDOR_ID = 'svnd_ankur0000000000000000';

/** A list page as the API answers it. */
const page = (
  data: unknown[],
  pagination: Record<string, unknown> = {},
  meta: Record<string, unknown> = {},
) => ({
  data,
  meta: {
    request_id: 'req',
    pagination: { per_page: 50, next: null, has_more: false, ...pagination },
    ...meta,
  },
});

/** Answer each GET by its path. */
function answer(byPath: Record<string, (query: Record<string, unknown>) => unknown>) {
  vi.mocked(api.get).mockImplementation(((path: string, init?: { query?: object }) => {
    const reply = byPath[path];
    if (!reply) throw new Error(`unexpected GET ${path}`);
    return Promise.resolve(reply((init?.query ?? {}) as Record<string, unknown>));
  }) as never);
}

/** The query a GET to `path` was sent with (the last one). */
function queryOf(path: string) {
  const call = vi
    .mocked(api.get)
    .mock.calls.filter(([called]) => called === path)
    .at(-1);
  return (call?.[1] as { query?: Record<string, unknown> } | undefined)?.query;
}

/** Nisha, who recorded the entries. */
const NISHA = {
  id: TEST_MONEY_AUTHOR_ID,
  userId: 'usr_nisha',
  name: 'Nisha Shah',
  initials: 'NS',
  tone: 'sage' as const,
  roleIds: [],
  branchIds: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  queryClient.clear();
  signInTestMember();
  vi.mocked(fetchTeamDirectory).mockResolvedValue([NISHA]);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
});

describe('ledgerListQuery', () => {
  it('reads 50 a page, newest first, with nothing filtered by default', () => {
    expect(ledgerListQuery({}, TODAY)).toEqual({
      limit: 50,
      direction: undefined,
      kind: undefined,
      mode: undefined,
      branch_id: undefined,
      q: undefined,
      paid_date_from: undefined,
      paid_date_to: undefined,
      created_from: undefined,
      created_to: undefined,
    });
  });

  it('sends Show, What (an expense reads supplier bills too), Mode, the branches, the day and Created', () => {
    expect(
      ledgerListQuery(
        {
          direction: 'paid',
          kind: ['expense', 'refund'],
          mode: ['cash', 'upi'],
          branchIds: [TEST_MONEY_BRANCH_ID, 'brn_vesu00000000000000000'],
          q: '  Kavya ',
          day: '2026-10-09',
          created: 'today',
        },
        TODAY,
      ),
    ).toEqual({
      limit: 50,
      direction: 'paid',
      kind: 'expense,supplier_bill,refund',
      mode: 'cash,upi',
      branch_id: `${TEST_MONEY_BRANCH_ID},brn_vesu00000000000000000`,
      q: 'Kavya',
      paid_date_from: '2026-10-09',
      paid_date_to: '2026-10-09',
      created_from: clinicInstant(TODAY, '00:00'),
      created_to: clinicInstant('2026-10-11', '00:00'),
    });
  });
});

describe('listLedger', () => {
  it('reads one page, each row with its link numbers and its author from the team', async () => {
    answer({
      '/app/payments': () =>
        page([paymentWire()], { next: 'cur_2', has_more: true, estimated_total: 12 }),
    });

    const result = await listLedger({ q: 'Kavya' }, 'cur_1');

    expect(queryOf('/app/payments')).toMatchObject({
      q: 'Kavya',
      after: 'cur_1',
      limit: 50,
    });
    expect(result).toEqual({ rows: [ledgerRow()], next: 'cur_2', total: 12 });
    expect(fetchTeamDirectory).toHaveBeenCalledTimes(1);
  });

  it('reads no team for an empty page, and keeps a member who left as no one', async () => {
    answer({ '/app/payments': () => page([]) });
    expect(await listLedger({})).toEqual({ rows: [], next: null, total: null });
    expect(fetchTeamDirectory).not.toHaveBeenCalled();

    answer({
      '/app/payments': () =>
        page([paymentWire({ created_by_membership_id: 'mem_left00000000000000000' })]),
    });
    const [row] = (await listLedger({})).rows;
    expect(row?.by).toBeNull();
    expect(row?.createdById).toBe('mem_left00000000000000000');
  });
});

describe('fetchLedgerCount', () => {
  it('reads one row with the ledger’s params for the API’s count; none when left out', async () => {
    answer({ '/app/payments': () => page([paymentWire()], { estimated_total: 13 }) });
    expect(await fetchLedgerCount({ direction: 'paid', q: 'Kavya' })).toBe(13);
    expect(queryOf('/app/payments')).toMatchObject({
      direction: 'paid',
      q: 'Kavya',
      limit: 1,
    });
    answer({ '/app/payments': () => page([]) });
    expect(await fetchLedgerCount({})).toBeNull();
  });
});

describe('fetchPayment', () => {
  it('names a stock bill payment by its purchase, bill number and payee', async () => {
    answer({
      '/app/payments/{payment_id}': () => ({
        data: paymentWire({
          direction: 'paid',
          kind: 'supplier_bill',
          contact: null,
          patient_id: null,
          invoice_id: null,
          invoice: null,
          stock_purchase_id: STOCK_PURCHASE_ID,
          stock_purchase: { stock_purchase_number: 8, bill_number: 'ZZ-0001' },
          payee_name: 'Ankur Pharma',
          last_edit: null,
          edit_count: 0,
        }),
        meta: { request_id: 'req' },
      }),
    });

    const row = await fetchPayment(TEST_PAYMENT_ID);

    expect(api.get).toHaveBeenCalledWith('/app/payments/{payment_id}', {
      params: { payment_id: TEST_PAYMENT_ID },
    });
    expect(row).toMatchObject({
      partyName: 'Ankur Pharma',
      contactId: null,
      bill: {
        kind: 'stock_po',
        purchaseId: STOCK_PURCHASE_ID,
        seq: 8,
        billNo: 'ZZ-0001',
      },
      stockPurchaseId: STOCK_PURCHASE_ID,
      lastEdit: null,
    });
  });

  it('names a Medical PO payment by its order and supplier bill number', async () => {
    answer({
      '/app/payments/{payment_id}': () => ({
        data: paymentWire({
          kind: 'supplier_bill',
          medical_purchase_order_id: MEDICAL_ORDER_ID,
          medical_purchase_order: {
            purchase_order_number: 431,
            supplier_bill_number: null,
          },
        }),
        meta: { request_id: 'req' },
      }),
    });

    expect((await fetchPayment(TEST_PAYMENT_ID)).bill).toEqual({
      kind: 'medical_po',
      purchaseId: MEDICAL_ORDER_ID,
      seq: 431,
      billNo: null,
    });
  });
});

describe('the edit log', () => {
  it('reads every change, oldest first, and words the money of one as its two sides', async () => {
    answer({
      '/app/payments/{payment_id}/edits': () =>
        page([
          {
            id: 'pedit_koemr3ulrnhby9q904rcb',
            changes: {
              splits: {
                from: [{ mode: 'upi', amount: 600 }],
                to: [{ mode: 'upi', amount: 700 }],
              },
            },
            author_membership_id: TEST_MONEY_AUTHOR_ID,
            created_at: '2026-10-10T05:00:00.000Z',
          },
        ]),
    });

    const [edit] = await listPaymentEdits(TEST_PAYMENT_ID);

    expect(queryOf('/app/payments/{payment_id}/edits')).toEqual({
      limit: 100,
      after: undefined,
    });
    expect(edit).toMatchObject({ authorId: TEST_MONEY_AUTHOR_ID });
    expect(edit && editSidesOf(edit)).toEqual({
      from: { amount: 600, modes: ['upi'] },
      to: { amount: 700, modes: ['upi'] },
    });
    expect(editSidesOf({ changes: { note: { from: null, to: 'x' } } })).toBeNull();
  });
});

describe('one record’s entries', () => {
  it('reads a patient’s, an invoice’s and a branch-day’s, every page', async () => {
    answer({ '/app/payments': () => page([paymentWire()]) });

    expect(await listPatientPayments(TEST_MONEY_PATIENT_ID)).toEqual([ledgerRow()]);
    expect(queryOf('/app/payments')).toMatchObject({
      patient_id: TEST_MONEY_PATIENT_ID,
      limit: 100,
    });
    await listInvoicePayments(TEST_INVOICE_ID);
    expect(queryOf('/app/payments')).toMatchObject({ invoice_id: TEST_INVOICE_ID });
    await listDayPayments(TEST_MONEY_BRANCH_ID, '2026-10-09');
    expect(queryOf('/app/payments')).toMatchObject({
      branch_id: TEST_MONEY_BRANCH_ID,
      paid_date_from: '2026-10-09',
      paid_date_to: '2026-10-09',
    });
  });
});

describe('listOpenSupplierBills', () => {
  it('lists Medical POs and stock purchases with a balance, oldest first, Medical first on a day', async () => {
    answer({
      '/app/stock-purchases': () =>
        page([
          {
            id: STOCK_PURCHASE_ID,
            stock_purchase_number: 8,
            stock_vendor_id: VENDOR_ID,
            bill_number: 'ZZ-0001',
            purchase_date: '2026-10-02',
            due_amount: 2392.5,
          },
        ]),
      '/app/stock-vendors': () => page([{ id: VENDOR_ID, name: 'Ankur Pharma' }]),
      '/app/medical-purchase-orders': () =>
        page([
          {
            id: MEDICAL_ORDER_ID,
            purchase_order_number: 431,
            supplier: { id: 'sup_ramdev000000000000000', name: 'Shree Ramdev' },
            supplier_bill_number: '1631',
            order_date: '2026-10-02',
            due_amount: 2980,
          },
        ]),
    });

    const bills = await listOpenSupplierBills({ stock: true, medical: true });

    expect(queryOf('/app/stock-purchases')).toMatchObject({
      payment_status: 'unpaid,partial',
      sort: 'purchase_date',
      order: 'asc',
    });
    expect(queryOf('/app/medical-purchase-orders')).toMatchObject({
      stage: 'received',
      payment_status: 'unpaid,partial',
    });
    expect(bills).toEqual([
      {
        kind: 'medical_po',
        purchaseId: MEDICAL_ORDER_ID,
        seq: 431,
        billNo: '1631',
        supplierName: 'Shree Ramdev',
        date: '2026-10-02',
        due: 2980,
        daysPending: 8,
      },
      {
        kind: 'stock_po',
        purchaseId: STOCK_PURCHASE_ID,
        seq: 8,
        billNo: 'ZZ-0001',
        supplierName: 'Ankur Pharma',
        date: '2026-10-02',
        due: 2392.5,
        daysPending: 8,
      },
    ]);
  });

  it('reads only the kinds the member may read', async () => {
    expect(await listOpenSupplierBills({ stock: false, medical: false })).toEqual([]);
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('the writes', () => {
  const written = () => ({ data: paymentWire(), meta: { request_id: 'req' } });

  it('receives a payment against an invoice, with the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValue(written() as never);

    const row = await receivePayment({
      input: {
        branchId: TEST_MONEY_BRANCH_ID,
        contactId: TEST_MONEY_CONTACT_ID,
        invoiceId: TEST_INVOICE_ID,
        splits: [
          { mode: 'cash', amount: 100 },
          { mode: 'upi', amount: 50 },
        ],
        reference: ' REF9 ',
        note: '  ',
      },
      idempotencyKey: 'key-receive',
    });

    expect(api.post).toHaveBeenCalledWith('/app/payments', {
      body: {
        kind: 'receipt',
        branch_id: TEST_MONEY_BRANCH_ID,
        contact_id: TEST_MONEY_CONTACT_ID,
        invoice_id: TEST_INVOICE_ID,
        splits: [
          { mode: 'cash', amount: 100 },
          { mode: 'upi', amount: 50 },
        ],
        reference: 'REF9',
        note: null,
      },
      idempotencyKey: 'key-receive',
    });
    expect(row).toEqual(ledgerRow());
  });

  it('pays an expense in its category, on an earlier day at the clock’s time', async () => {
    vi.mocked(api.post).mockResolvedValue(written() as never);

    await payExpense({
      input: {
        branchId: TEST_MONEY_BRANCH_ID,
        bill: null,
        expenseCategory: 'consumables',
        payeeName: ' Tea & snacks ',
        amount: 120.5,
        mode: 'cash',
        paidOn: '2026-10-09',
        note: null,
        attachmentKeys: ['uploads/bill.jpg'],
      },
      idempotencyKey: 'key-pay',
    });

    expect(api.post).toHaveBeenCalledWith('/app/payments', {
      body: {
        kind: 'expense',
        expense_category: 'consumables',
        branch_id: TEST_MONEY_BRANCH_ID,
        splits: [{ mode: 'cash', amount: 120.5 }],
        payee_name: 'Tea & snacks',
        paid_at: clinicInstant('2026-10-09', '10:00'),
        note: null,
        attachment_keys: ['uploads/bill.jpg'],
      },
      idempotencyKey: 'key-pay',
    });
  });

  it('pays a supplier bill with its purchase and payee, never a category, today', async () => {
    vi.mocked(api.post).mockResolvedValue(written() as never);
    const fields = {
      branchId: TEST_MONEY_BRANCH_ID,
      payeeName: 'Ankur Pharma',
      amount: 500,
      mode: 'upi' as const,
      paidOn: TODAY,
      note: null,
      attachmentKeys: [],
    };

    await payExpense({
      input: { ...fields, bill: { kind: 'stock_po', purchaseId: STOCK_PURCHASE_ID } },
      idempotencyKey: 'key-stock',
    });
    await payExpense({
      input: { ...fields, bill: { kind: 'medical_po', purchaseId: MEDICAL_ORDER_ID } },
      idempotencyKey: 'key-medical',
    });

    const [stock, medical] = vi
      .mocked(api.post)
      .mock.calls.map(([, init]) => (init as { body: Record<string, unknown> }).body);
    expect(stock).toMatchObject({
      kind: 'supplier_bill',
      stock_purchase_id: STOCK_PURCHASE_ID,
      payee_name: 'Ankur Pharma',
      paid_at: undefined,
    });
    expect(stock).not.toHaveProperty('expense_category');
    expect(medical).toMatchObject({
      kind: 'supplier_bill',
      medical_purchase_order_id: MEDICAL_ORDER_ID,
    });
    expect(medical).not.toHaveProperty('expense_category');
  });

  it('changes only what differs, with the read’s updated_at — and sends nothing for no change', async () => {
    vi.mocked(api.patch).mockResolvedValue(written() as never);
    const record = ledgerRow();

    expect(
      await updatePayment({
        record,
        patch: { splits: record.splits, reference: 'REF9', note: 'At the desk' },
        idempotencyKey: 'key-none',
      }),
    ).toBe(record);
    expect(api.patch).not.toHaveBeenCalled();

    await updatePayment({
      record,
      patch: {
        splits: [{ mode: 'card', amount: 150 }],
        reference: 'REF9',
        note: ' ',
      },
      idempotencyKey: 'key-edit',
    });
    expect(api.patch).toHaveBeenCalledWith('/app/payments/{payment_id}', {
      params: { payment_id: TEST_PAYMENT_ID },
      body: {
        splits: [{ mode: 'card', amount: 150 }],
        note: null,
        expected_updated_at: record.updatedAt,
      },
      idempotencyKey: 'key-edit',
    });
  });

  it('changes money out’s one split from its amount and mode; a category only on an expense', async () => {
    vi.mocked(api.patch).mockResolvedValue(written() as never);
    const expense = ledgerRow({
      direction: 'paid',
      kind: 'expense',
      amount: 120,
      splits: [{ mode: 'cash', amount: 120 }],
      expenseCategory: 'misc',
      payeeName: 'Tea',
    });

    await updatePayment({
      record: expense,
      patch: { amount: 150, expenseCategory: 'consumables', paidOn: '2026-10-09' },
      idempotencyKey: 'key-expense',
    });
    expect(vi.mocked(api.patch).mock.calls.at(-1)?.[1]).toMatchObject({
      body: {
        splits: [{ mode: 'cash', amount: 150 }],
        expense_category: 'consumables',
        paid_at: clinicInstant('2026-10-09', '10:00'),
      },
    });

    await updatePayment({
      record: { ...expense, kind: 'supplier_bill' },
      patch: { expenseCategory: 'consumables', mode: 'upi' },
      idempotencyKey: 'key-bill',
    });
    expect(vi.mocked(api.patch).mock.calls.at(-1)?.[1]).toEqual({
      params: { payment_id: TEST_PAYMENT_ID },
      body: {
        splits: [{ mode: 'upi', amount: 120 }],
        expected_updated_at: expense.updatedAt,
      },
      idempotencyKey: 'key-bill',
    });
  });

  it('deletes with the reason and note, restores and reverses with the action’s key', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined } as never);
    vi.mocked(api.post).mockResolvedValue(written() as never);

    await deletePayment({ paymentId: TEST_PAYMENT_ID, reason: 'duplicate', note: null });
    expect(api.delete).toHaveBeenCalledWith('/app/payments/{payment_id}', {
      params: { payment_id: TEST_PAYMENT_ID },
      reason: 'duplicate',
      note: undefined,
    });

    await restorePayment(TEST_PAYMENT_ID, 'key-restore');
    expect(api.post).toHaveBeenCalledWith('/app/payments/{payment_id}/restore', {
      params: { payment_id: TEST_PAYMENT_ID },
      idempotencyKey: 'key-restore',
    });

    await reversePayment({
      paymentId: TEST_PAYMENT_ID,
      reason: ' Entered on the wrong day ',
      idempotencyKey: 'key-reverse',
    });
    expect(api.post).toHaveBeenCalledWith('/app/payments/{payment_id}/reverse', {
      params: { payment_id: TEST_PAYMENT_ID },
      body: { reason: 'Entered on the wrong day' },
      idempotencyKey: 'key-reverse',
    });
  });
});
