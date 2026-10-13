import { afterEach, describe, expect, it } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { ref } from './fixtures/refs.fixtures.ts';
import { resetAppFixtures } from './fixtures/world.fixtures.ts';
import {
  createMedicine,
  deleteMedicine,
  fetchAllMedicines,
  fetchMedicine,
  listMedicines,
  quickCreateMedicine,
  restoreMedicine,
  setNearExpiryDiscount,
  updateMedicine,
} from './medicines-api.ts';
import type { MedicineInput } from './medicines-contracts.ts';

afterEach(() => resetAppFixtures());

const GLYCOLAC = ref.medicine(456);

/** The 422 a write was refused with: its detail and fields. */
async function refusal(write: Promise<unknown>) {
  try {
    await write;
  } catch (error) {
    if (isHttpError(error)) {
      const body = error.data as { error: { detail: string; fields?: object } };
      return { status: error.status, ...body.error };
    }
    throw error;
  }
  throw new Error('the write went through');
}

const input = (fields: Partial<MedicineInput> = {}): MedicineInput => ({
  name: 'Azelan Gel',
  composition: null,
  manufacturerId: ref.manufacturer(1),
  prescriptionOnly: false,
  mrp: 30_000,
  gstPct: 12,
  minStock: 2,
  maxStock: 10,
  batches: [],
  supplierRates: [{ supplierId: ref.supplier(61), rate: 20_000, free: 0, leadDays: 2 }],
  ...fields,
});

describe('listMedicines (`S:1660`)', () => {
  it('reads every medicine by name with its stock, maker, nearest batch and best rate', async () => {
    const page = await listMedicines();
    expect(page.items).toHaveLength(9);
    expect(page.items.map((row) => row.name)[0]).toBe('Admosh UV Sunscreen 60g');
    const uncap = page.items.find((row) => row.seq === 458);
    expect(uncap).toMatchObject({
      stock: 8,
      manufacturer: { name: 'ALVI', tone: 'lav' },
      nearest: { batchNo: 'CSH26044' },
      bestRate: { supplierName: 'K R Medical Agency', rate: 44_000 },
      margin: 32,
    });
  });

  it('searches name, composition, maker, supplier and "#458"', async () => {
    const names = async (q: string) =>
      (await listMedicines({ q })).items.map((row) => row.name);
    expect(await names('azelaic')).toEqual(['Azelan 20% Cream', 'Beyolaic Cream']);
    expect(await names('#458')).toEqual(['Uncap Smooth Anti Acne PM Gel']);
    expect(await names('nh pharma')).toContain('Trichospire Hair Kit');
  });

  it('filters low stock, near expiry and makers, and sorts on request', async () => {
    const low = await listMedicines({ stock: 'low' });
    expect(low.items.every((row) => row.stock <= row.minStock)).toBe(true);
    expect(low.items.map((row) => row.seq).sort()).toEqual([451, 454, 457]);
    const soon = await listMedicines({ expiry: '90' });
    expect(soon.items.every((row) => (row.nearest?.daysLeft ?? 999) <= 90)).toBe(true);
    const alvi = await listMedicines({ manufacturer: [ref.manufacturer(1)] });
    expect(alvi.items.map((row) => row.seq)).toEqual([458]);
    const byMrp = await listMedicines({ sort: 'mrp', order: 'desc' });
    expect(byMrp.items[0]?.mrp).toBe(117_500);
  });
});

describe('medicine writes', () => {
  it('refuses a missing name, MRP or supplier rate with the design’s words', async () => {
    expect(await refusal(createMedicine(input({ name: ' ' })))).toMatchObject({
      status: 422,
      detail: 'Add a name',
    });
    expect(await refusal(createMedicine(input({ mrp: 0 })))).toMatchObject({
      detail: 'Enter the MRP',
    });
    const noRate = input({
      supplierRates: [{ supplierId: ref.supplier(61), rate: 0, free: 0, leadDays: 2 }],
    });
    expect(await refusal(createMedicine(noRate))).toMatchObject({
      detail: 'Enter a rate for every supplier price',
    });
  });

  it('creates a full medicine, numbered after the last', async () => {
    const created = await createMedicine(input());
    expect(created).toMatchObject({ seq: 459, isQuick: false });
    expect((await fetchMedicine(created.id)).bestRate?.supplierName).toBe(
      'K R Medical Agency',
    );
  });

  it('creates a quick medicine at MRP ₹0 on the order’s supplier; a full save drops the flag', async () => {
    const quick = await quickCreateMedicine({
      name: 'Azel cream',
      supplierId: ref.supplier(58),
    });
    expect(quick).toMatchObject({ isQuick: true, mrp: 0 });
    expect(quick.supplierRates).toEqual([
      { supplierId: ref.supplier(58), rate: 0, free: 0, leadDays: 2 },
    ]);
    const saved = await updateMedicine(quick.id, {
      mrp: 20_000,
      supplierRates: [
        { supplierId: ref.supplier(58), rate: 12_000, free: 0, leadDays: 2 },
      ],
    });
    expect(saved.isQuick).toBe(false);
  });

  it('sets and removes the near-expiry discount', async () => {
    await setNearExpiryDiscount([GLYCOLAC], 20);
    expect((await fetchMedicine(GLYCOLAC)).nearExpiryDiscountPct).toBe(20);
    await setNearExpiryDiscount([GLYCOLAC], 0);
    expect((await fetchMedicine(GLYCOLAC)).nearExpiryDiscountPct).toBe(0);
  });

  it('soft-deletes with a reason and restores', async () => {
    await deleteMedicine(GLYCOLAC, 'duplicate', null);
    expect((await fetchAllMedicines()).map((row) => row.id)).not.toContain(GLYCOLAC);
    await restoreMedicine(GLYCOLAC);
    expect((await fetchAllMedicines()).map((row) => row.id)).toContain(GLYCOLAC);
  });
});
