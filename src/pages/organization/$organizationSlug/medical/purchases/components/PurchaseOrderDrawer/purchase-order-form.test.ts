import { describe, expect, it } from 'vitest';

import {
  medicineRow,
  purchaseOrderRow,
  TEST_MEDICINE_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  emptyOrderLine,
  lineAmount,
  linesMissingRate,
  newOrderForm,
  ORDER_LINES_MAX,
  orderFormOf,
  orderInputOf,
  orderLinesProblem,
  orderServerFields,
  orderTotal,
  pickedLines,
  reorderLines,
  reorderSupplier,
  supplierRateOf,
  typedMedicineKey,
  typedMedicineName,
} from './purchase-order-form.ts';

const KR_ID = 'sup_krmedical000000000000';

/** Uncap: Ankur Pharma ₹452 · K R Medical Agency ₹440 (its best). */
const UNCAP = medicineRow({
  id: 'med_uncap0000000000000000',
  name: 'Uncap',
  supplierRates: [
    {
      supplierId: TEST_SUPPLIER_ID,
      supplierName: 'Ankur Pharma',
      rate: 452,
      free: 0,
      leadDays: 2,
    },
    {
      supplierId: KR_ID,
      supplierName: 'K R Medical Agency',
      rate: 440,
      free: 0,
      leadDays: 1,
    },
  ],
  bestRate: { supplierId: KR_ID, supplierName: 'K R Medical Agency', rate: 440 },
});

/** Arganlif: 2 of 10, Low (the server's), sold by K R Medical Agency at ₹677. */
const ARGANLIF = medicineRow({
  id: 'med_arganlif0000000000000',
  name: 'Arganlif Hair Serum 50 ml',
  stock: 2,
  maxStock: 10,
  stockLevel: 'low',
  supplierRates: [
    {
      supplierId: KR_ID,
      supplierName: 'K R Medical Agency',
      rate: 677,
      free: 0,
      leadDays: 1,
    },
  ],
  bestRate: { supplierId: KR_ID, supplierName: 'K R Medical Agency', rate: 677 },
});

/** Trichospire: Out of 10, sold by K R Medical Agency and Ankur Pharma. */
const TRICHOSPIRE = medicineRow({
  id: 'med_trichospire0000000000',
  name: 'Trichospire',
  stock: 0,
  maxStock: 10,
  stockLevel: 'out',
  supplierRates: [
    {
      supplierId: TEST_SUPPLIER_ID,
      supplierName: 'Ankur Pharma',
      rate: 300,
      free: 0,
      leadDays: 2,
    },
    {
      supplierId: KR_ID,
      supplierName: 'K R Medical Agency',
      rate: 310,
      free: 0,
      leadDays: 1,
    },
  ],
});

describe('the purchase order’s form (medical.md:254–267)', () => {
  it('totals qty × rate in paise — free units cost nothing — over the picked lines', () => {
    const lines = [
      { medicineId: 'a', qty: 4, free: 2, rate: 52_900 },
      { ...emptyOrderLine(), rate: 10_000 },
    ];
    expect(lineAmount(lines[0] ?? emptyOrderLine())).toBe(211_600);
    expect(orderTotal(lines)).toBe(211_600);
    expect(pickedLines(lines)).toHaveLength(1);
    expect(
      linesMissingRate([...lines, { medicineId: 'b', qty: 1, free: 0, rate: 0 }]),
    ).toEqual([2]);
  });

  // The Items step's head and the save's check read this one rule (QA-04's pattern).
  it('says why lines cannot be sent: none picked, more than 50, a rate missing', () => {
    expect(orderLinesProblem([])).toBe('empty');
    expect(orderLinesProblem([emptyOrderLine()])).toBe('empty');
    const many = Array.from({ length: ORDER_LINES_MAX + 1 }, (_line, index) => ({
      medicineId: `med-${index}`,
      qty: 1,
      free: 0,
      rate: 100,
    }));
    expect(orderLinesProblem(many)).toBe('tooMany');
    expect(orderLinesProblem(many.slice(0, ORDER_LINES_MAX))).toBeNull();
    expect(orderLinesProblem([{ medicineId: 'a', qty: 1, free: 0, rate: 0 }])).toBe(
      'rate',
    );
  });

  it('prices a medicine at the order’s supplier, else its best rate, else nothing — the API’s rupees as paise', () => {
    expect(supplierRateOf(UNCAP, TEST_SUPPLIER_ID)).toBe(45_200);
    expect(supplierRateOf(UNCAP, 'sup_other0000000000000000')).toBe(44_000);
    expect(supplierRateOf(undefined, null)).toBe(0);
  });

  it('"Reorder low stock": every medicine the server reads low or out, filled up, at the supplier most of them use', () => {
    const medicines = [UNCAP, ARGANLIF, TRICHOSPIRE];
    const supplierId = reorderSupplier(medicines);
    expect(supplierId).toBe(KR_ID);
    const lines = reorderLines(medicines, supplierId);
    expect(lines.map((line) => [line.medicineId, line.qty, line.rate])).toEqual([
      [ARGANLIF.id, 8, 67_700],
      [TRICHOSPIRE.id, 10, 31_000],
    ]);
    expect(reorderSupplier([])).toBeNull();
  });

  it('opens a saved order with its rates as paise, and sends a form as the contract’s fields in rupees', () => {
    const order = purchaseOrderRow({ stage: 'ordered', apiStage: 'ordered' });
    const form = orderFormOf(order);
    expect(form).toMatchObject({ supplierId: TEST_SUPPLIER_ID, billNo: 'T-82370' });
    expect(
      form.lines.map((line) => [line.medicineId, line.qty, line.free, line.rate]),
    ).toEqual([[TEST_MEDICINE_ID, 10, 1, 42_360]]);
    expect(orderInputOf(form)).toEqual({
      supplierId: TEST_SUPPLIER_ID,
      supplierBillNo: 'T-82370',
      date: '2026-10-04',
      items: [{ medicineId: TEST_MEDICINE_ID, qty: 10, free: 1, rate: 423.6 }],
    });
    const fresh = newOrderForm(TEST_SUPPLIER_ID, [emptyOrderLine()]);
    expect(orderInputOf({ ...fresh, billNo: '  ' })).toMatchObject({
      supplierId: TEST_SUPPLIER_ID,
      supplierBillNo: null,
      items: [],
    });
    expect(orderInputOf({ ...form, supplierId: null }).supplierId).toBe('');
  });

  it('sends a medicine typed on a line by its name, for the server to add (MD26)', () => {
    const key = typedMedicineKey(' Azel cream ');
    expect(typedMedicineName(key)).toBe('Azel cream');
    expect(typedMedicineName(TEST_MEDICINE_ID)).toBeNull();
    expect(typedMedicineName(null)).toBeNull();
    const form = newOrderForm(TEST_SUPPLIER_ID, [
      { medicineId: key, qty: 20, free: 2, rate: 18_000 },
    ]);
    expect(orderInputOf(form).items).toEqual([
      { medicineId: null, newMedicineName: 'Azel cream', qty: 20, free: 2, rate: 180 },
    ]);
  });

  it('maps a refused save’s fields onto the rows it sent — a blank row is not sent', () => {
    const fields = orderServerFields([
      { medicineId: TEST_MEDICINE_ID, qty: 1, free: 0, rate: 100 },
      emptyOrderLine(),
      { medicineId: typedMedicineKey('Azel cream'), qty: 1, free: 0, rate: 0 },
    ]);
    expect(fields).toMatchObject({
      supplierBillNumber: 'billNo',
      orderDate: 'date',
      items: 'lines',
      'items.0.rate': 'lines.0.rate',
      'items.1.rate': 'lines.2.rate',
      'items.1.newMedicineName': 'lines.2.medicineId',
    });
  });
});
