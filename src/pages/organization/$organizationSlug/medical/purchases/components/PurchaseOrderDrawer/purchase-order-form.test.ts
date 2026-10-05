import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchAllMedicines } from '@/shared/api/clinic/medicines-api.ts';

import { fetchPurchaseOrder } from '../../../shared/medical-api.ts';
import {
  emptyOrderLine,
  lineAmount,
  linesMissingRate,
  newOrderForm,
  orderFormOf,
  orderInputOf,
  orderTotal,
  pickedLines,
  reorderLines,
  reorderSupplier,
  supplierRateOf,
} from './purchase-order-form.ts';

afterEach(() => resetClinicFixtures());

describe('the purchase order’s form (medical.md:254–267)', () => {
  it('totals qty × rate — free units cost nothing — over the picked lines', () => {
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

  it('prices a medicine at the order’s supplier, else its best rate, else nothing', async () => {
    const medicines = await fetchAllMedicines();
    const uncap = medicines.find((row) => row.seq === 458);
    expect(supplierRateOf(uncap, ref.supplier(52))).toBe(45_200);
    expect(supplierRateOf(uncap, ref.supplier(59))).toBe(44_000);
    expect(supplierRateOf(undefined, null)).toBe(0);
  });

  it('"Reorder low stock": every medicine at or below its level, filled up, at the supplier most of them use', async () => {
    const medicines = await fetchAllMedicines();
    const supplierId = reorderSupplier(medicines);
    const lines = reorderLines(medicines, supplierId);
    // Arganlif (2 of 10), Admosh (2 of 10) and Trichospire (out, of 10).
    expect(lines.map((line) => [line.medicineId, line.qty])).toEqual(
      expect.arrayContaining([
        [ref.medicine(457), 8],
        [ref.medicine(454), 8],
        [ref.medicine(451), 10],
      ]),
    );
    expect(lines).toHaveLength(3);
    expect(lines.every((line) => line.rate > 0)).toBe(true);
    expect(supplierId).not.toBeNull();
    expect(reorderSupplier([])).toBeNull();
  });

  it('opens a saved order and sends a form as the contract’s fields', async () => {
    const order = await fetchPurchaseOrder(ref.purchaseOrder(430));
    const form = orderFormOf(order);
    expect(form).toMatchObject({ supplierId: ref.supplier(61), billNo: 'T-82370' });
    expect(form.lines.map((line) => [line.qty, line.free, line.rate])).toEqual([
      [4, 0, 52_900],
      [10, 2, 21_200],
    ]);
    const fresh = newOrderForm(ref.supplier(61), [emptyOrderLine()]);
    expect(orderInputOf({ ...fresh, billNo: '  ' })).toMatchObject({
      supplierId: ref.supplier(61),
      supplierBillNo: null,
      items: [],
    });
    expect(orderInputOf({ ...form, supplierId: null }).supplierId).toBe('');
  });
});
