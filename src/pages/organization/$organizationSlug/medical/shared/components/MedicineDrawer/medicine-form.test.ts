import { describe, expect, it } from 'vitest';

import type { MedicineRecord } from '@/shared/api/app/medicines-contracts.ts';

import {
  bestFormRate,
  DEFAULT_LEAD_DAYS,
  emptyBatch,
  emptyMedicineForm,
  formStock,
  medicineFormOf,
  type MedicineFormValues,
  medicineInputOf,
  medicineRowProblem,
  missingMedicineFields,
  mrpPaiseOf,
  nextSupplierRate,
  stockBarScale,
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
      mrp: '',
      gstPct: 12,
      minStock: 2,
      maxStock: 10,
      batches: [],
      supplierRates: [],
    });
    expect(emptyMedicineForm().manufacturerId).toBeNull();
  });

  it('reads a saved medicine back with its MRP in rupees', () => {
    const saved = {
      name: 'Glycolac Cream',
      manufacturerId: MAKER,
      composition: null,
      prescriptionOnly: true,
      mrp: 16_250,
      gstPct: 12,
      minStock: 2,
      maxStock: 10,
      batches: [{ batchNo: '026-312', expiry: '11/26', qty: 3, purchaseRate: 12_300 }],
      supplierRates: [{ supplierId: AKSHAR, rate: 12_300, free: 0, leadDays: 2 }],
    } as unknown as MedicineRecord;
    const values = medicineFormOf(saved);
    expect(values.mrp).toBe('162.5');
    expect(values.composition).toBe('');
    expect(values.prescriptionOnly).toBe(true);
    expect(mrpPaiseOf(values)).toBe(16_250);
    expect(formStock(values)).toBe(3);
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
          batches: [{ batchNo: '', expiry: '13/27', qty: 2, purchaseRate: 0 }],
        }),
      ),
    ).toEqual({ rule: 'rates', fields: ['supplierRates.0.rate'] });
  });

  it('flags a started batch without its number, then a bad expiry; a blank one passes', () => {
    expect(
      medicineRowProblem(
        form({ batches: [{ batchNo: '', expiry: '11/26', qty: 2, purchaseRate: 0 }] }),
      ),
    ).toEqual({ rule: 'batchNo', fields: ['batches.0.batchNo'] });
    expect(
      medicineRowProblem(
        form({
          batches: [
            emptyBatch(),
            { batchNo: 'B1', expiry: '13/27', qty: 2, purchaseRate: 0 },
          ],
        }),
      ),
    ).toEqual({ rule: 'expiry', fields: ['batches.1.expiry'] });
    expect(medicineRowProblem(form({ batches: [emptyBatch()] }))).toBeNull();
  });

  it('sends the contract’s fields: trimmed, paise, blank rows dropped', () => {
    expect(
      medicineInputOf(
        form({
          name: ' Azelan 20% Cream ',
          composition: '  ',
          mrp: '650.5',
          batches: [
            emptyBatch(),
            { batchNo: ' B1 ', expiry: '11/27 ', qty: 4, purchaseRate: 30_000 },
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
      mrp: 65_050,
      gstPct: 12,
      minStock: 2,
      maxStock: 10,
      batches: [{ batchNo: 'B1', expiry: '11/27', qty: 4, purchaseRate: 30_000 }],
      supplierRates: [{ supplierId: AKSHAR, rate: 30_000, free: 1, leadDays: 3 }],
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

  it('places the levels on a bar that reaches a quarter past the fill-up level', () => {
    const at = stockBarScale(3, 2, 10);
    expect(at(2)).toBe('16%');
    expect(at(10)).toBe('80%');
    expect(at(3)).toBe('24%');
    expect(stockBarScale(40, 2, 10)(40)).toBe('100%');
    expect(stockBarScale(0, 0, 0)(0)).toBe('0%');
  });
});
