import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';
import { appInstant } from '@/shared/api/app/app-time.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  manufacturerWire,
  medicalRepVisitWire,
  medicalRepWire,
  prescriptionToFillWire,
  purchaseOrderWire,
  saleDueWire,
  saleWire,
  supplierCreditWire,
  supplierWire,
  TEST_BUYER_CONTACT_ID,
  TEST_MAKER_ID,
  TEST_MR_ID,
  TEST_PRESCRIPTION_ID,
  TEST_PURCHASE_ORDER_ID,
  TEST_SALE_ID,
  TEST_SUPPLIER_CREDIT_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  fetchAllManufacturers,
  fetchMedicalSale,
  fetchMrVisits,
  fetchOldestOpenPurchaseOrder,
  fetchPurchaseOrderSheet,
  fetchSupplierAccount,
  listManufacturers,
  listMedicalReps,
  listMedicalSales,
  listPrescriptionsToFill,
  listPurchaseOrders,
  listSaleReminders,
  listSupplierCredits,
  listSuppliers,
  medicalListSummary,
  medicalQueryKeys,
  purchaseOrderListQuery,
  saleListQuery,
} from './medical-api.ts';

/** The clinic's day every range here is read on. */
const TODAY = '2026-10-10';

/** A list page as the API answers it. */
const page = (
  data: unknown[],
  next: string | null = null,
  meta: Record<string, unknown> = {},
) => ({
  data,
  meta: {
    request_id: 'req',
    pagination: {
      per_page: 50,
      next,
      has_more: next !== null,
      estimated_total: data.length,
    },
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

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(appInstant(TODAY, '10:00')));
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
});

describe('the keys', () => {
  it('all sit under the room’s prefix and the organization', () => {
    expect(medicalQueryKeys.sales('org_test', { status: 'unpaid' })).toEqual([
      'app',
      'medical',
      'org_test',
      'sales',
      { status: 'unpaid' },
    ]);
    expect(medicalQueryKeys.catalogue('org_test', 'suppliers')).toEqual([
      'app',
      'medical',
      'org_test',
      'catalogue',
      'suppliers',
    ]);
  });
});

describe('Sales', () => {
  it('the query: search, status, Created, the sorts as the API names them', () => {
    expect(saleListQuery({}, TODAY)).toEqual({
      limit: 50,
      q: undefined,
      status: undefined,
      created_from: undefined,
      created_to: undefined,
      sort: undefined,
      order: undefined,
    });
    expect(
      saleListQuery(
        {
          q: ' S-978 ',
          status: 'unpaid',
          created: 'today',
          sort: 'customer',
          order: 'asc',
        },
        TODAY,
      ),
    ).toEqual({
      limit: 50,
      q: 'S-978',
      status: 'unpaid',
      created_from: appInstant(TODAY, '00:00'),
      created_to: appInstant('2026-10-11', '00:00'),
      sort: 'contact_name',
      order: 'asc',
    });
  });

  it('a page maps each sale — its buyer, invoice, lines and money in rupees', async () => {
    answer({ '/app/medical-sales': () => page([saleWire()], 'cursor_b') });
    const result = await listMedicalSales({ status: 'unpaid' }, 'cursor_a');
    expect(queryOf('/app/medical-sales')).toMatchObject({
      status: 'unpaid',
      after: 'cursor_a',
    });
    expect(result.next).toBe('cursor_b');
    expect(result.rows[0]).toMatchObject({
      id: TEST_SALE_ID,
      seq: 978,
      status: 'unpaid',
      customer: { id: TEST_BUYER_CONTACT_ID, name: 'Priya Shah' },
      invoice: { number: 'INV-25-0042', total: 1300, due: 1300 },
      bill: 1300,
      due: 1300,
      lines: [{ name: 'Azelaic gel 15g', qty: 2, expiry: '12/27', amount: 1300 }],
    });
  });

  it('one sale, its returns as kept (a store credit names its credit)', async () => {
    answer({
      '/app/medical-sales/{medical_sale_id}': () => ({
        data: saleWire({
          status: 'returned',
          returned_amount: 650,
          returns: [
            {
              id: 'msrt_one00000000000000000',
              reason: 'unused',
              refund_mode: 'credit',
              note: null,
              amount: 650,
              invoice_credit_note_id: 'cn_one000000000000000000',
              pending_credit_id: 'pcr_one00000000000000000',
              items: [
                {
                  invoice_item_id: 'iitm_line00000000000000000',
                  quantity: 1,
                  amount: 650,
                  is_restocked: true,
                },
              ],
              returned_by_membership_id: null,
              created_at: '2026-10-10T06:00:00.000Z',
            },
          ],
        }),
      }),
    });
    const sale = await fetchMedicalSale(TEST_SALE_ID);
    expect(sale.returned).toBe(650);
    expect(sale.returns[0]).toMatchObject({
      refundMode: 'credit',
      pendingCreditId: 'pcr_one00000000000000000',
      items: [{ qty: 1, restocked: true }],
    });
  });

  it('the reminders: who owes, from the clinic — a sale without a buyer has no one', async () => {
    answer({
      '/app/medical-sales/dues': () =>
        page([saleDueWire(), saleDueWire({ contact: null, patient_id: null })]),
      '/tenancy/organization': () => ({ data: { name: 'Skin Studio' } }),
    });
    const reminders = await listSaleReminders({ q: 'Priya' }, TODAY);
    expect(queryOf('/app/medical-sales/dues')).toMatchObject({ limit: 100, q: 'Priya' });
    expect(reminders.clinicName).toBe('Skin Studio');
    expect(reminders.customers).toEqual([
      {
        customer: {
          id: TEST_BUYER_CONTACT_ID,
          name: 'Priya Shah',
          phone: '+919900011122',
          patientId: expect.any(String),
        },
        due: 1300,
        sales: [{ id: TEST_SALE_ID, seq: 978, due: 1300, soldAt: expect.any(String) }],
      },
    ]);
  });

  it('Prescriptions to fill: the approved ones no sale has filled, with their patient', async () => {
    answer({
      '/app/patient-prescriptions': () =>
        page([prescriptionToFillWire(), prescriptionToFillWire({ patient: null })]),
    });
    const queue = await listPrescriptionsToFill();
    expect(queryOf('/app/patient-prescriptions')).toEqual({
      limit: 20,
      status: 'approved',
      is_filled: 'false',
      sort: 'prescription_date',
      order: 'desc',
    });
    expect(queue).toEqual([
      {
        id: TEST_PRESCRIPTION_ID,
        seq: 58,
        patientId: expect.any(String),
        contactId: TEST_BUYER_CONTACT_ID,
        patientName: 'Priya Shah',
        date: '2026-10-10',
        medicines: ['Azelaic gel 15g'],
      },
    ]);
  });
});

describe('Purchases', () => {
  it('the Stage filter: Paid is a received order paid in full', () => {
    expect(purchaseOrderListQuery({ stage: 'ordered' }, TODAY)).toMatchObject({
      stage: 'ordered',
    });
    expect(purchaseOrderListQuery({ stage: 'received' }, TODAY)).toMatchObject({
      stage: 'received',
      payment_status: 'unpaid,partial',
    });
    expect(
      purchaseOrderListQuery({ stage: 'paid', sort: 'total', order: 'desc' }, TODAY),
    ).toMatchObject({ stage: 'received', payment_status: 'paid', sort: 'total' });
  });

  it('a received order paid in full shows as Paid', async () => {
    answer({
      '/app/medical-purchase-orders': () =>
        page([
          purchaseOrderWire(),
          purchaseOrderWire({
            id: 'mpo_paid0000000000000000',
            payment_status: 'paid',
            paid_amount: 4236,
            due_amount: 0,
          }),
        ]),
    });
    const { rows } = await listPurchaseOrders();
    expect(rows.map((row) => [row.apiStage, row.stage])).toEqual([
      ['received', 'received'],
      ['received', 'paid'],
    ]);
    expect(rows[0]?.lines[0]).toMatchObject({ expiry: '12/27', rate: 423.6 });
  });

  it('"Pay ₹X" reads the supplier’s oldest received order still due', async () => {
    answer({ '/app/medical-purchase-orders': () => page([purchaseOrderWire()]) });
    expect((await fetchOldestOpenPurchaseOrder(TEST_SUPPLIER_ID))?.id).toBe(
      TEST_PURCHASE_ORDER_ID,
    );
    expect(queryOf('/app/medical-purchase-orders')).toEqual({
      supplier_id: TEST_SUPPLIER_ID,
      stage: 'received',
      payment_status: 'unpaid,partial',
      sort: 'order_date',
      order: 'asc',
      limit: 1,
    });
    answer({ '/app/medical-purchase-orders': () => page([]) });
    expect(await fetchOldestOpenPurchaseOrder(TEST_SUPPLIER_ID)).toBeNull();
  });

  it('the print sheet: the order, the clinic, and its main branch', async () => {
    answer({
      '/app/medical-purchase-orders/{medical_purchase_order_id}': () => ({
        data: purchaseOrderWire(),
      }),
      '/tenancy/organization': () => ({
        data: { name: 'Skin Studio', specialties: ['skin'], currency: 'INR' },
      }),
      '/app/branches/my': () =>
        page([
          { is_main: false, phone: '+910000000000', gst_number: null },
          { is_main: true, phone: '+912612345678', gst_number: '24ABCDE1234F1Z5' },
        ]),
    });
    const sheet = await fetchPurchaseOrderSheet(TEST_PURCHASE_ORDER_ID);
    expect(sheet.order.seq).toBe(431);
    expect(sheet.organization.name).toBe('Skin Studio');
    expect(sheet.branch).toEqual({
      phone: '+912612345678',
      gstNumber: '24ABCDE1234F1Z5',
    });
  });
});

describe('Suppliers', () => {
  it('a page with the filters as the API takes them', async () => {
    answer({ '/app/suppliers': () => page([supplierWire()]) });
    const { rows } = await listSuppliers({
      manufacturer: TEST_MAKER_ID,
      hasPayable: true,
      sort: 'payable',
      order: 'desc',
    });
    expect(queryOf('/app/suppliers')).toMatchObject({
      manufacturer_id: TEST_MAKER_ID,
      has_payable: 'true',
      sort: 'payable',
      order: 'desc',
    });
    expect(rows[0]).toMatchObject({
      payable: 827,
      ageingDays: 5,
      manufacturerIds: [TEST_MAKER_ID],
      orderTotal: 4236,
    });
  });

  it('an Account: its orders and credits, the latest first', async () => {
    answer({
      '/app/medical-purchase-orders': () => page([purchaseOrderWire()]),
      '/app/suppliers/{supplier_id}/credits': () => page([supplierCreditWire()]),
    });
    expect(await fetchSupplierAccount(TEST_SUPPLIER_ID)).toEqual([
      {
        kind: 'credit',
        id: TEST_SUPPLIER_CREDIT_ID,
        batchNo: '026-312',
        date: '2026-10-08',
        amount: 840,
      },
      {
        kind: 'order',
        id: TEST_PURCHASE_ORDER_ID,
        seq: 431,
        billNo: 'T-82370',
        date: '2026-10-04',
        stage: 'received',
        amount: 4236,
        due: 827,
      },
    ]);
  });

  it('the credits: every supplier’s, or one supplier’s', async () => {
    answer({
      '/app/supplier-credits': () => page([supplierCreditWire()]),
      '/app/suppliers/{supplier_id}/credits': () => page([supplierCreditWire()]),
    });
    const all = await listSupplierCredits({ status: 'open' });
    expect(queryOf('/app/supplier-credits')).toMatchObject({ limit: 50, status: 'open' });
    expect(all.rows[0]).toMatchObject({
      amount: 840,
      status: 'open',
      batchNo: '026-312',
    });
    await listSupplierCredits({ supplier: TEST_SUPPLIER_ID });
    expect(vi.mocked(api.get).mock.calls.at(-1)?.[1]).toMatchObject({
      params: { supplier_id: TEST_SUPPLIER_ID },
    });
  });

  it('the footer reads what the filtered suppliers are owed', async () => {
    answer({
      '/app/suppliers': () => page([supplierWire()], null, { payable_total: 2980 }),
    });
    expect(await medicalListSummary('suppliers', { hasPayable: true }, TODAY)).toEqual({
      total: 1,
      payable: 2980,
    });
    expect(queryOf('/app/suppliers')).toMatchObject({ has_payable: 'true', limit: 1 });
  });
});

describe('Manufacturers and MRs', () => {
  it('a manufacturers page by name, filtered by one supplier and one MR', async () => {
    answer({ '/app/manufacturers': () => page([manufacturerWire()]) });
    const { rows } = await listManufacturers({
      supplier: TEST_SUPPLIER_ID,
      mr: TEST_MR_ID,
    });
    expect(queryOf('/app/manufacturers')).toMatchObject({
      supplier_id: TEST_SUPPLIER_ID,
      medical_rep_id: TEST_MR_ID,
      sort: 'name',
    });
    expect(rows[0]).toMatchObject({
      name: 'SUN PHARMA',
      medicineCount: 14,
      suppliers: [{ id: TEST_SUPPLIER_ID, name: 'Ankur Pharma' }],
      mrs: [{ id: TEST_MR_ID, name: 'Rahul Mehta' }],
    });
  });

  it('the whole manufacturer list reads every page', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(page([manufacturerWire()], 'cursor_b') as never)
      .mockResolvedValueOnce(
        page([
          manufacturerWire({ id: 'mfr_other00000000000000000', name: 'ALVI' }),
        ]) as never,
      );
    expect((await fetchAllManufacturers()).map((maker) => maker.name)).toEqual([
      'SUN PHARMA',
      'ALVI',
    ]);
  });

  it('an MRs page and an MR’s visits, the latest first', async () => {
    answer({
      '/app/medical-reps': () => page([medicalRepWire({ is_visit_overdue: true })]),
      '/app/medical-reps/{medical_rep_id}/visits': () => page([medicalRepVisitWire()]),
    });
    const { rows } = await listMedicalReps({ q: 'Rahul' });
    expect(rows[0]).toMatchObject({ name: 'Rahul Mehta', visitOverdue: true });
    const visits = await fetchMrVisits(TEST_MR_ID);
    expect(queryOf('/app/medical-reps/{medical_rep_id}/visits')).toMatchObject({
      sort: 'visit_date',
      order: 'desc',
    });
    expect(visits[0]).toMatchObject({ mrId: TEST_MR_ID, date: '2026-10-01' });
  });
});
