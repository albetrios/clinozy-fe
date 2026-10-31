import { describe, expect, it } from 'vitest';

import {
  medicineRow,
  medicineWire as medicineWireDouble,
  TEST_MAKER_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  medicineForm,
  medicineInputSchema,
  medicineWire,
  quickMedicineBodyOf,
  saleUnitPaise,
  screenExpiryOf,
  toMedicineRow,
  wireExpiryOf,
} from './medicines-contracts.ts';

describe('expiry months', () => {
  it('"2027-12" on the wire is "12/27" on screen, and back', () => {
    expect(screenExpiryOf('2027-12')).toBe('12/27');
    expect(wireExpiryOf('12/27')).toBe('2027-12');
    expect(wireExpiryOf(screenExpiryOf('2031-01'))).toBe('2031-01');
  });

  it('leaves a value in neither shape as it is', () => {
    expect(screenExpiryOf('soon')).toBe('soon');
    expect(wireExpiryOf('13/27')).toBe('13/27');
  });
});

describe('toMedicineRow', () => {
  it('reads what the server derives — the nearest batch’s days left on the clinic’s day', () => {
    const row = toMedicineRow(medicineWire.parse(medicineWireDouble()), '2027-12-01');
    expect(row.nearest).toEqual({ batchNo: '026-312', expiry: '12/27', daysLeft: 30 });
    expect(row.stockLevel).toBe('ok');
    expect(row.margin).toBeCloseTo(35.38);
  });

  it('a medicine with no discount reads 0; no stock, no nearest batch', () => {
    const row = toMedicineRow(
      medicineWire.parse(
        medicineWireDouble({ nearest_expiry: null, near_expiry_discount_percent: null }),
      ),
    );
    expect(row.nearest).toBeNull();
    expect(row.nearExpiryDiscountPct).toBe(0);
  });
});

describe('the input schema', () => {
  const valid = {
    name: 'Azelaic gel 15g',
    composition: null,
    manufacturerId: TEST_MAKER_ID,
    prescriptionOnly: false,
    hsnCode: null,
    packLabel: null,
    unitsPerPack: 1,
    mrp: 650,
    gstPct: 12,
    minStock: 2,
    maxStock: 20,
    batches: [],
    supplierRates: [],
  };

  it('takes a full record', () => {
    expect(medicineInputSchema.safeParse(valid).success).toBe(true);
  });

  it('refuses a missing name or MRP, a rate of 0, a reorder level above the fill-up', () => {
    const issues = (fields: object) =>
      medicineInputSchema
        .safeParse({ ...valid, ...fields })
        .error?.issues.map((issue) => issue.message);
    expect(issues({ name: ' ' })).toContain('Add a name');
    expect(issues({ mrp: 0 })).toContain('Enter the MRP');
    expect(
      issues({ supplierRates: [{ supplierId: 'sup_a', rate: 0, free: 0, leadDays: 2 }] }),
    ).toContain('Enter a rate for every supplier price');
    expect(issues({ minStock: 30 })).toContain('Reorder at can’t be above Fill up to');
  });

  it('takes an HSN code of 4, 6 or 8 digits, a pack label and 1–1000 units per pack', () => {
    const ok = (fields: object) =>
      medicineInputSchema.safeParse({ ...valid, ...fields }).success;
    expect(ok({ hsnCode: '3004', packLabel: '1*10', unitsPerPack: 10 })).toBe(true);
    expect(ok({ hsnCode: '300490' })).toBe(true);
    expect(ok({ hsnCode: '30049099' })).toBe(true);
    expect(ok({ hsnCode: '30049' })).toBe(false);
    expect(ok({ hsnCode: '3004AB' })).toBe(false);
    expect(ok({ unitsPerPack: 0 })).toBe(false);
    expect(ok({ unitsPerPack: 1001 })).toBe(false);
    expect(ok({ packLabel: 'x'.repeat(31) })).toBe(false);
  });
});

describe('the new record fields (change-pharmacy-record-fields)', () => {
  it('reads the HSN code, pack, units per pack and each batch’s MRP', () => {
    const row = toMedicineRow(
      medicineWire.parse(
        medicineWireDouble({
          hsn_code: '3004',
          pack_label: '1*10',
          units_per_pack: 10,
          batches: [
            {
              id: 'mbt_strip0000000000000000',
              batch_number: 'B1',
              expiry_month: '2027-12',
              quantity: 34,
              purchase_rate: 90,
              mrp: 125.55,
              supplier_id: null,
              is_expired: false,
            },
          ],
        }),
      ),
    );
    expect(row).toMatchObject({ hsnCode: '3004', packLabel: '1*10', unitsPerPack: 10 });
    expect(row.batches[0]?.mrp).toBeCloseTo(125.55, 2);
  });

  it('prices a unit at the first batch’s MRP over its units, rounded down (D2, D6)', () => {
    const batch = medicineRow().batches[0]!;
    const strip = medicineRow({
      mrp: 120,
      unitsPerPack: 10,
      batches: [
        { ...batch, id: 'mbt_old', qty: 0, mrp: 99 },
        { ...batch, id: 'mbt_new', mrp: 125.55 },
      ],
    });
    expect(saleUnitPaise(strip)).toBe(1_255);
    expect(saleUnitPaise({ ...strip, batches: [{ ...batch, mrp: null }] })).toBe(1_200);
    expect(saleUnitPaise(medicineRow())).toBe(65_000);
  });
});

describe('quick medicines and forms', () => {
  it('a quick medicine is its trimmed name, under its maker when known', () => {
    expect(quickMedicineBodyOf({ name: ' Azel cream ' })).toEqual({
      name: 'Azel cream',
      is_quick: true,
    });
  });

  it('a lotion is topical, a tablet oral', () => {
    expect(medicineForm('Cetaphil Lotion 250ml')).toBe('topical');
    expect(medicineForm('Doxy 100 tablet')).toBe('oral');
  });
});
