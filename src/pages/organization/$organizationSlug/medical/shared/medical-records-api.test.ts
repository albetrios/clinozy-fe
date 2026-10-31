import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  receivePayment: vi.fn(),
}));
import { api } from '@/core/http/api.ts';
import { receivePayment } from '@/shared/api/app/payments-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  manufacturerRow,
  manufacturerWire,
  medicalRepVisitWire,
  medicalRepWire,
  mrRow,
  paidSaleRow,
  purchaseOrderRow,
  purchaseOrderWire,
  saleRow,
  saleWire,
  supplierCreditWire,
  supplierRow,
  supplierWire,
  TEST_BATCH_ID,
  TEST_BUYER_CONTACT_ID,
  TEST_MAKER_ID,
  TEST_MEDICAL_BRANCH_ID,
  TEST_MEDICINE_ID,
  TEST_MR_ID,
  TEST_PURCHASE_ORDER_ID,
  TEST_PURCHASE_ORDER_ITEM_ID,
  TEST_SALE_ID,
  TEST_SALE_INVOICE_ID,
  TEST_SALE_INVOICE_ITEM_ID,
  TEST_SUPPLIER_CREDIT_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

import {
  cancelPurchaseOrder,
  collectSale,
  createManufacturer,
  createPurchaseOrder,
  createSale,
  createSupplierCredit,
  deleteSupplier,
  logMrVisit,
  quickCreateSupplier,
  receivePurchaseOrder,
  restoreSale,
  restoreSupplierCredit,
  returnSale,
  updateManufacturer,
  updateMedicalRep,
  updatePurchaseOrder,
  updatePurchaseOrderNote,
  updateSupplier,
  voidSale,
  voidSupplierCredit,
} from './medical-records-api.ts';

const KEY = { idempotencyKey: 'key' } as const;

/** The body a call was sent with. */
const bodyOf = (call: unknown[] | undefined) =>
  (call?.[1] as { body?: unknown } | undefined)?.body;

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
});
afterEach(() => {
  useOrganizationStore.getState().clearOrganization();
});

describe('suppliers, manufacturers and MRs', () => {
  it('a quick supplier is the typed name and its picker’s makers, marked quick', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: supplierWire() } as never);
    await quickCreateSupplier({
      name: ' Om Pharma ',
      manufacturerIds: [TEST_MAKER_ID],
      ...KEY,
    });
    expect(vi.mocked(api.post).mock.calls[0]).toEqual([
      '/app/suppliers',
      {
        body: {
          name: 'Om Pharma',
          phone: null,
          gst_number: null,
          email: null,
          address: null,
          manufacturer_ids: [TEST_MAKER_ID],
          is_quick: true,
        },
        idempotencyKey: 'key',
      },
    ]);
  });

  it('a supplier save sends what changed with the read’s updated_at; nothing changed, nothing', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: supplierWire() } as never);
    const record = supplierRow();
    const same = {
      name: record.name,
      phone: record.phone,
      gstNumber: record.gstNumber,
      email: record.email,
      address: record.address,
      manufacturerIds: [...record.manufacturerIds],
    };
    expect(await updateSupplier({ record, input: same, ...KEY })).toBe(record);
    expect(api.patch).not.toHaveBeenCalled();
    await updateSupplier({ record, input: { ...same, gstNumber: ' ' }, ...KEY });
    expect(bodyOf(vi.mocked(api.patch).mock.calls[0])).toEqual({
      gst_number: null,
      expected_updated_at: record.updatedAt,
    });
    await updateSupplier({
      record,
      input: { ...same, email: ' orders@ankur.in ', address: 'Ring Road, Surat' },
      ...KEY,
    });
    expect(bodyOf(vi.mocked(api.patch).mock.calls[1])).toEqual({
      email: 'orders@ankur.in',
      address: 'Ring Road, Surat',
      expected_updated_at: record.updatedAt,
    });
  });

  it('a supplier delete carries its reason', async () => {
    vi.mocked(api.delete).mockResolvedValue({} as never);
    await deleteSupplier(TEST_SUPPLIER_ID, 'not_needed', null);
    expect(vi.mocked(api.delete).mock.calls[0]).toEqual([
      '/app/suppliers/{supplier_id}',
      { params: { supplier_id: TEST_SUPPLIER_ID }, reason: 'not_needed' },
    ]);
  });

  it('a manufacturer is upper case, its links to suppliers and MRs sent whole', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: manufacturerWire() } as never);
    vi.mocked(api.patch).mockResolvedValue({ data: manufacturerWire() } as never);
    await createManufacturer({
      input: {
        name: 'sun pharma',
        tone: 'sky',
        supplierIds: [TEST_SUPPLIER_ID],
        mrIds: [],
      },
      ...KEY,
    });
    expect(bodyOf(vi.mocked(api.post).mock.calls[0])).toEqual({
      name: 'SUN PHARMA',
      tone: 'sky',
      supplier_ids: [TEST_SUPPLIER_ID],
      medical_rep_ids: [],
      is_quick: false,
    });
    await updateManufacturer({
      record: manufacturerRow(),
      input: {
        name: 'SUN PHARMA',
        tone: 'sky',
        supplierIds: [TEST_SUPPLIER_ID],
        mrIds: [],
      },
      ...KEY,
    });
    expect(bodyOf(vi.mocked(api.patch).mock.calls[0])).toEqual({
      medical_rep_ids: [],
      expected_updated_at: manufacturerRow().updatedAt,
    });
  });

  it('an MR’s next visit, and a logged visit', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: medicalRepWire() } as never);
    vi.mocked(api.post).mockResolvedValue({ data: medicalRepVisitWire() } as never);
    await updateMedicalRep({
      record: mrRow(),
      input: {
        name: 'Rahul Mehta',
        phone: mrRow().phone,
        nextVisitOn: '2026-10-27',
        manufacturerIds: [TEST_MAKER_ID],
      },
      ...KEY,
    });
    expect(bodyOf(vi.mocked(api.patch).mock.calls[0])).toEqual({
      next_visit_on: '2026-10-27',
      expected_updated_at: mrRow().updatedAt,
    });
    await logMrVisit({
      input: {
        mrId: TEST_MR_ID,
        date: '2026-10-10',
        nextVisitOn: null,
        samples: ' Azelaic gel ×4 ',
        notes: '',
      },
      ...KEY,
    });
    expect(vi.mocked(api.post).mock.calls[0]).toEqual([
      '/app/medical-reps/{medical_rep_id}/visits',
      {
        params: { medical_rep_id: TEST_MR_ID },
        body: { visit_date: '2026-10-10', samples: 'Azelaic gel ×4' },
        idempotencyKey: 'key',
      },
    ]);
  });
});

describe('purchase orders', () => {
  it('a new order: its lines, a typed medicine by name (MD26)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: purchaseOrderWire() } as never);
    await createPurchaseOrder({
      input: {
        supplierId: TEST_SUPPLIER_ID,
        supplierBillNo: null,
        date: '2026-10-10',
        items: [
          { medicineId: TEST_MEDICINE_ID, qty: 10, free: 1, rate: 423.6 },
          {
            medicineId: null,
            newMedicineName: ' Azel cream ',
            qty: 5,
            free: 0,
            rate: 120,
          },
        ],
      },
      ...KEY,
    });
    expect(bodyOf(vi.mocked(api.post).mock.calls[0])).toEqual({
      supplier_id: TEST_SUPPLIER_ID,
      items: [
        { medicine_id: TEST_MEDICINE_ID, quantity: 10, free_quantity: 1, rate: 423.6 },
        { new_medicine_name: 'Azel cream', quantity: 5, free_quantity: 0, rate: 120 },
      ],
      order_date: '2026-10-10',
    });
  });

  it('a save sends the line list whole when a line changed', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: purchaseOrderWire() } as never);
    const record = purchaseOrderRow({ apiStage: 'ordered', stage: 'ordered' });
    await updatePurchaseOrder({
      record,
      input: {
        supplierId: TEST_SUPPLIER_ID,
        supplierBillNo: 'T-82370',
        date: '2026-10-04',
        items: [{ medicineId: TEST_MEDICINE_ID, qty: 12, free: 1, rate: 423.6 }],
      },
      ...KEY,
    });
    expect(bodyOf(vi.mocked(api.patch).mock.calls[0])).toEqual({
      items: [
        { medicine_id: TEST_MEDICINE_ID, quantity: 12, free_quantity: 1, rate: 423.6 },
      ],
      expected_updated_at: record.updatedAt,
    });
  });

  it('a line takes the MRP printed on its packs and the order its note (D8, D10)', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: purchaseOrderWire() } as never);
    await createPurchaseOrder({
      input: {
        supplierId: TEST_SUPPLIER_ID,
        supplierBillNo: null,
        date: '2026-10-10',
        note: ' 30 DAYS DUE ',
        items: [
          { medicineId: TEST_MEDICINE_ID, qty: 10, free: 0, rate: 90, mrp: 125.55 },
        ],
      },
      ...KEY,
    });
    expect(bodyOf(vi.mocked(api.post).mock.calls[0])).toEqual({
      supplier_id: TEST_SUPPLIER_ID,
      items: [
        {
          medicine_id: TEST_MEDICINE_ID,
          quantity: 10,
          free_quantity: 0,
          rate: 90,
          mrp: 125.55,
        },
      ],
      note: '30 DAYS DUE',
      order_date: '2026-10-10',
    });
  });

  it('a received order changes its note alone; the same note writes nothing (D10)', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: purchaseOrderWire() } as never);
    const record = purchaseOrderRow({ note: 'without gst bill' });
    expect(
      await updatePurchaseOrderNote({ record, note: ' without gst bill ', ...KEY }),
    ).toBe(record);
    expect(api.patch).not.toHaveBeenCalled();
    await updatePurchaseOrderNote({ record, note: '30 DAYS DUE', ...KEY });
    expect(vi.mocked(api.patch).mock.calls[0]?.[1]).toEqual({
      params: { medical_purchase_order_id: TEST_PURCHASE_ORDER_ID },
      body: { note: '30 DAYS DUE', expected_updated_at: record.updatedAt },
      idempotencyKey: 'key',
    });
    await updatePurchaseOrderNote({ record, note: ' ', ...KEY });
    expect(bodyOf(vi.mocked(api.patch).mock.calls[1])).toEqual({
      note: null,
      expected_updated_at: record.updatedAt,
    });
  });

  it('a cancel is the delete with why', async () => {
    vi.mocked(api.delete).mockResolvedValue({} as never);
    await cancelPurchaseOrder(TEST_PURCHASE_ORDER_ID, 'other', 'Rates changed');
    expect(vi.mocked(api.delete).mock.calls[0]?.[1]).toEqual({
      params: { medical_purchase_order_id: TEST_PURCHASE_ORDER_ID },
      reason: 'other',
      note: 'Rates changed',
    });
  });

  it('Receive goods: each line arrived or not, an unexpected one, the expiry as the API takes it', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: purchaseOrderWire() } as never);
    await receivePurchaseOrder({
      id: TEST_PURCHASE_ORDER_ID,
      input: {
        lines: [
          {
            id: TEST_PURCHASE_ORDER_ITEM_ID,
            arrived: true,
            batchNo: '026-312',
            expiry: '12/27',
            mrp: 125.55,
          },
          {
            id: 'mpoi_missing0000000000000',
            arrived: false,
            batchNo: null,
            expiry: null,
          },
        ],
        extras: [
          {
            medicineId: TEST_MEDICINE_ID,
            qty: 2,
            free: 0,
            rate: 400,
            batchNo: '026-400',
            expiry: '03/28',
          },
        ],
        supplierBillNo: ' T-82370 ',
        note: ' 30 DAYS DUE ',
      },
      ...KEY,
    });
    expect(bodyOf(vi.mocked(api.post).mock.calls[0])).toEqual({
      items: [
        {
          id: TEST_PURCHASE_ORDER_ITEM_ID,
          is_received: true,
          batch_number: '026-312',
          expiry_month: '2027-12',
          mrp: 125.55,
        },
        { id: 'mpoi_missing0000000000000', is_received: false },
        {
          medicine_id: TEST_MEDICINE_ID,
          quantity: 2,
          free_quantity: 0,
          rate: 400,
          batch_number: '026-400',
          expiry_month: '2028-03',
        },
      ],
      supplier_bill_number: 'T-82370',
      note: '30 DAYS DUE',
    });
  });
});

describe('sales', () => {
  it('a new sale: the buyer and lines the server prices, "Paid now" as splits', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: saleWire() } as never);
    await createSale({
      input: {
        branchId: TEST_MEDICAL_BRANCH_ID,
        contactId: TEST_BUYER_CONTACT_ID,
        items: [
          { medicineId: TEST_MEDICINE_ID, qty: 2, discountPct: 0, description: null },
        ],
        overallDiscount: 0,
        memberIds: [],
        prescriptionId: 'rx_rx5800000000000000000',
        remark: null,
        payment: { splits: [{ mode: 'upi', amount: 1300 }] },
      },
      ...KEY,
    });
    expect(bodyOf(vi.mocked(api.post).mock.calls[0])).toEqual({
      branch_id: TEST_MEDICAL_BRANCH_ID,
      contact_id: TEST_BUYER_CONTACT_ID,
      // 0% is sent: left out, the server would apply the near-expiry discount.
      items: [{ medicine_id: TEST_MEDICINE_ID, quantity: 2, discount_percent: 0 }],
      patient_prescription_id: 'rx_rx5800000000000000000',
      payment: { splits: [{ mode: 'upi', amount: 1300 }] },
    });
  });

  it('a new sale sends a medicine’s description trimmed, and reads it on the sale’s lines', async () => {
    const answered = saleWire();
    vi.mocked(api.post).mockResolvedValue({
      data: {
        ...answered,
        items: answered.items.map((item) => ({ ...item, description: 'Apply at night' })),
      },
    } as never);
    const sale = await createSale({
      input: {
        branchId: TEST_MEDICAL_BRANCH_ID,
        contactId: TEST_BUYER_CONTACT_ID,
        items: [
          {
            medicineId: TEST_MEDICINE_ID,
            qty: 2,
            discountPct: 0,
            description: ' Apply at night ',
          },
        ],
        overallDiscount: 0,
        memberIds: [],
        prescriptionId: null,
        remark: null,
        payment: null,
      },
      ...KEY,
    });
    expect(bodyOf(vi.mocked(api.post).mock.calls[0])).toMatchObject({
      items: [
        {
          medicine_id: TEST_MEDICINE_ID,
          quantity: 2,
          discount_percent: 0,
          description: 'Apply at night',
        },
      ],
    });
    expect(sale.lines[0]?.description).toBe('Apply at night');
  });

  it('Collect is one receipt for the whole due, against the invoice', async () => {
    vi.mocked(receivePayment).mockResolvedValue(ledgerRow());
    await collectSale({ sale: saleRow(), mode: 'cash', ...KEY });
    expect(receivePayment).toHaveBeenCalledWith({
      input: {
        branchId: TEST_MEDICAL_BRANCH_ID,
        contactId: TEST_BUYER_CONTACT_ID,
        invoiceId: TEST_SALE_INVOICE_ID,
        splits: [{ mode: 'cash', amount: 1300 }],
        reference: null,
        note: null,
      },
      idempotencyKey: 'key',
    });
    await expect(
      collectSale({ sale: saleRow({ customer: null }), mode: 'cash', ...KEY }),
    ).rejects.toThrow();
  });

  it('a return as store credit sends the lines coming back and the mode', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: saleWire() } as never);
    await returnSale({
      id: paidSaleRow().id,
      input: {
        lines: [
          { invoiceItemId: TEST_SALE_INVOICE_ITEM_ID, qty: 1 },
          { invoiceItemId: 'iitm_other00000000000000000', qty: 0 },
        ],
        reason: 'unused',
        mode: 'credit',
        note: null,
      },
      ...KEY,
    });
    expect(vi.mocked(api.post).mock.calls[0]).toEqual([
      '/app/medical-sales/{medical_sale_id}/returns',
      {
        params: { medical_sale_id: TEST_SALE_ID },
        body: {
          items: [{ invoice_item_id: TEST_SALE_INVOICE_ITEM_ID, quantity: 1 }],
          reason: 'unused',
          refund_mode: 'credit',
        },
        idempotencyKey: 'key',
      },
    ]);
  });

  it('a void carries its reason; the Undo restores', async () => {
    vi.mocked(api.delete).mockResolvedValue({} as never);
    vi.mocked(api.post).mockResolvedValue({ data: saleWire() } as never);
    await voidSale(TEST_SALE_ID, 'billed_by_mistake', null);
    await restoreSale(TEST_SALE_ID, 'key');
    expect(vi.mocked(api.delete).mock.calls[0]?.[1]).toEqual({
      params: { medical_sale_id: TEST_SALE_ID },
      reason: 'billed_by_mistake',
    });
    expect(vi.mocked(api.post).mock.calls[0]?.[0]).toBe(
      '/app/medical-sales/{medical_sale_id}/restore',
    );
  });
});

describe('supplier credits', () => {
  it('Return expiring stock: the batch and the packs, under the supplier', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: supplierCreditWire() } as never);
    const credit = await createSupplierCredit({
      input: { supplierId: TEST_SUPPLIER_ID, batchId: TEST_BATCH_ID, qty: 2 },
      ...KEY,
    });
    expect(credit).toMatchObject({ amount: 840, status: 'open' });
    expect(vi.mocked(api.post).mock.calls[0]).toEqual([
      '/app/suppliers/{supplier_id}/credits',
      {
        params: { supplier_id: TEST_SUPPLIER_ID },
        body: { medicine_batch_id: TEST_BATCH_ID, quantity: 2 },
        idempotencyKey: 'key',
      },
    ]);
  });

  it('a void with why, and its Undo', async () => {
    vi.mocked(api.delete).mockResolvedValue({} as never);
    vi.mocked(api.post).mockResolvedValue({ data: supplierCreditWire() } as never);
    const ref = { supplierId: TEST_SUPPLIER_ID, creditId: TEST_SUPPLIER_CREDIT_ID };
    await voidSupplierCredit({ ...ref, reason: 'other', note: 'Supplier sent a note' });
    await restoreSupplierCredit({ ...ref, ...KEY });
    expect(vi.mocked(api.delete).mock.calls[0]).toEqual([
      '/app/suppliers/{supplier_id}/credits/{supplier_credit_id}',
      {
        params: {
          supplier_id: TEST_SUPPLIER_ID,
          supplier_credit_id: TEST_SUPPLIER_CREDIT_ID,
        },
        reason: 'other',
        note: 'Supplier sent a note',
      },
    ]);
    expect(vi.mocked(api.post).mock.calls[0]?.[0]).toBe(
      '/app/suppliers/{supplier_id}/credits/{supplier_credit_id}/restore',
    );
  });
});
