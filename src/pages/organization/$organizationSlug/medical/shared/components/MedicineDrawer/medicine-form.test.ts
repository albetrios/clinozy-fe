import { describe, expect, it } from 'vitest';

import { medicineRow } from '@/tests/utils/medical-doubles.ts';

import {
  bestFormRate,
  DEFAULT_LEAD_DAYS,
  emptyBatch,
  emptyMedicineForm,
  formStock,
  hsnCodeIsInvalid,
  medicineFormOf,
  type MedicineFormValues,
  medicineInputOf,
  medicineRowProblem,
  missingMedicineFields,
  mrpPaiseOf,
  nextSupplierRate,
  stockBarScale,
  unitsPerPackLocked,
} from './medicine-form.ts';

const MAKER = '11111111-1111-4111-8111-111111111111';
const AKSHAR = '22222222-2222-4222-8222-222222222222';
const KR = '33333333-3333-4333-8333-333333333333';

const form = (values: Partial<MedicineFormValues> = {}): MedicineFormValues => ({
  ...emptyMedicineForm({ name: 'Azelan 20% Cream', manufacturerId: MAKER }),
  mrp: '650',
  ...values,
});

describe('the medicine drawer form (medical.md:170–188)', () => {
  it('starts a new medicine on the typed name and first maker, GST 12%, reorder at 2, fill up to 10', () => {
    expect(emptyMedicineForm({ name: '  Azel cream ', manufacturerId: MAKER })).toEqual({
      name: 'Azel cream',
      manufacturerId: MAKER,
      composition: '',
      prescriptionOnly: false,
      hsnCode: '',
      packLabel: '',
      unitsPerPack: 1,
      mrp: '',
      gstPct: 12,
      minStock: 2,
      maxStock: 10,
      batches: [],
      supplierRates: [],
    });
    expect(emptyMedicineForm().manufacturerId).toBeNull();
  });

  it('reads a saved medicine back — the API’s rupees as the MRP typed and the rows’ paise', () => {
    const saved = medicineRow({
      name: 'Glycolac Cream',
      composition: null,
      prescriptionOnly: true,
      mrp: 162.5,
      batches: [
        {
          id: 'mbt_glyco0260000000000000',
          batchNo: '026-312',
          expiry: '11/26',
          qty: 3,
          purchaseRate: 123,
          mrp: 165.5,
          supplierId: AKSHAR,
          expired: false,
        },
      ],
      supplierRates: [
        {
          supplierId: AKSHAR,
          supplierName: 'Akshar Medicines',
          rate: 123,
          free: 0,
          leadDays: 2,
        },
      ],
    });
    const values = medicineFormOf(saved);
    expect(values.mrp).toBe('162.5');
    expect(values.composition).toBe('');
    expect(values.prescriptionOnly).toBe(true);
    expect(mrpPaiseOf(values)).toBe(16_250);
    expect(formStock(values)).toBe(3);
    // A saved batch keeps its id — the API keeps the batch by it.
    expect(values.batches).toEqual([
      {
        id: 'mbt_glyco0260000000000000',
        batchNo: '026-312',
        expiry: '11/26',
        qty: 3,
        purchaseRate: 12_300,
        mrp: 16_550,
        supplierId: AKSHAR,
      },
    ]);
    expect(values.supplierRates).toEqual([
      { supplierId: AKSHAR, rate: 12_300, free: 0, leadDays: 2 },
    ]);
  });

  it('names the required fields still empty', () => {
    expect(missingMedicineFields(form())).toEqual([]);
    expect(
      missingMedicineFields(form({ name: ' ', manufacturerId: null, mrp: '0' })),
    ).toEqual(['name', 'manufacturerId', 'mrp']);
  });

  it('finds the best picked price', () => {
    expect(bestFormRate(form())).toBeNull();
    const best = bestFormRate(
      form({
        supplierRates: [
          { supplierId: AKSHAR, rate: 45_000, free: 0, leadDays: 2 },
          { supplierId: KR, rate: 44_000, free: 0, leadDays: 2 },
          { supplierId: '', rate: 100, free: 0, leadDays: 2 },
        ],
      }),
    );
    expect(best?.supplierId).toBe(KR);
  });

  it('flags a picked supplier without a rate before anything else', () => {
    expect(
      medicineRowProblem(
        form({
          supplierRates: [
            { supplierId: AKSHAR, rate: 0, free: 0, leadDays: 2 },
            { supplierId: '', rate: 0, free: 0, leadDays: 2 },
          ],
          batches: [{ batchNo: '', expiry: '13/27', qty: 2, purchaseRate: 0, mrp: 0 }],
        }),
      ),
    ).toEqual({ rule: 'rates', fields: ['supplierRates.0.rate'] });
  });

  it('flags a started batch without its number, then a bad expiry; a blank one passes', () => {
    expect(
      medicineRowProblem(
        form({
          batches: [{ batchNo: '', expiry: '11/26', qty: 2, purchaseRate: 0, mrp: 0 }],
        }),
      ),
    ).toEqual({ rule: 'batchNo', fields: ['batches.0.batchNo'] });
    expect(
      medicineRowProblem(
        form({
          batches: [
            emptyBatch(),
            { batchNo: 'B1', expiry: '13/27', qty: 2, purchaseRate: 0, mrp: 0 },
          ],
        }),
      ),
    ).toEqual({ rule: 'expiry', fields: ['batches.1.expiry'] });
    expect(medicineRowProblem(form({ batches: [emptyBatch()] }))).toBeNull();
  });

  it('sends the contract’s fields: trimmed, in rupees, blank rows dropped, a saved batch by its id', () => {
    expect(
      medicineInputOf(
        form({
          name: ' Azelan 20% Cream ',
          composition: '  ',
          mrp: '650.5',
          hsnCode: ' 3004 ',
          packLabel: ' 1*10 ',
          unitsPerPack: 10,
          batches: [
            emptyBatch(),
            {
              batchNo: ' B1 ',
              expiry: '11/27 ',
              qty: 4,
              purchaseRate: 30_000,
              mrp: 12_555,
            },
            {
              id: 'mbt_saved0000000000000000',
              batchNo: 'B0',
              expiry: '01/27',
              qty: 1,
              purchaseRate: 0,
              mrp: 0,
            },
          ],
          supplierRates: [
            { supplierId: '', rate: 0, free: 0, leadDays: 2 },
            { supplierId: AKSHAR, rate: 30_000, free: 1, leadDays: 3 },
          ],
        }),
      ),
    ).toEqual({
      name: 'Azelan 20% Cream',
      composition: null,
      manufacturerId: MAKER,
      prescriptionOnly: false,
      hsnCode: '3004',
      packLabel: '1*10',
      unitsPerPack: 10,
      mrp: 650.5,
      gstPct: 12,
      minStock: 2,
      maxStock: 10,
      batches: [
        {
          batchNo: 'B1',
          expiry: '11/27',
          qty: 4,
          purchaseRate: 300,
          mrp: 125.55,
          supplierId: null,
        },
        {
          id: 'mbt_saved0000000000000000',
          batchNo: 'B0',
          expiry: '01/27',
          qty: 1,
          purchaseRate: null,
          mrp: null,
          supplierId: null,
        },
      ],
      supplierRates: [{ supplierId: AKSHAR, rate: 300, free: 1, leadDays: 3 }],
    });
  });

  it('offers the next supplier of the maker without a price, else any, else none', () => {
    const suppliers = [
      { id: KR, manufacturerIds: ['other'] },
      { id: AKSHAR, manufacturerIds: [MAKER] },
    ];
    expect(nextSupplierRate(form(), suppliers, MAKER)).toEqual({
      supplierId: AKSHAR,
      rate: 0,
      free: 0,
      leadDays: DEFAULT_LEAD_DAYS,
    });
    const priced = form({
      supplierRates: [{ supplierId: AKSHAR, rate: 1, free: 0, leadDays: 2 }],
    });
    expect(nextSupplierRate(priced, suppliers, MAKER).supplierId).toBe(KR);
    expect(
      nextSupplierRate(priced, [{ id: AKSHAR, manufacturerIds: [MAKER] }], MAKER)
        .supplierId,
    ).toBe('');
  });

  it('takes an HSN code of 4, 6 or 8 digits; locks the units per pack while stocked (D7)', () => {
    expect(hsnCodeIsInvalid(form())).toBe(false);
    expect(hsnCodeIsInvalid(form({ hsnCode: '3004' }))).toBe(false);
    expect(hsnCodeIsInvalid(form({ hsnCode: '300490' }))).toBe(false);
    expect(hsnCodeIsInvalid(form({ hsnCode: '30049' }))).toBe(true);
    expect(hsnCodeIsInvalid(form({ hsnCode: 'HSN' }))).toBe(true);
    expect(unitsPerPackLocked(null)).toBe(false);
    expect(unitsPerPackLocked(medicineRow({ stock: 0 }))).toBe(false);
    expect(unitsPerPackLocked(medicineRow({ stock: 3 }))).toBe(true);
    expect(medicineInputOf(form({ unitsPerPack: 0 })).unitsPerPack).toBe(1);
  });

  it('places the levels on a bar that reaches a quarter past the fill-up level', () => {
    const at = stockBarScale(3, 2, 10);
    expect(at(2)).toBe('16%');
    expect(at(10)).toBe('80%');
    expect(at(3)).toBe('24%');
    expect(stockBarScale(40, 2, 10)(40)).toBe('100%');
    expect(stockBarScale(0, 0, 0)(0)).toBe('0%');
  });
});
