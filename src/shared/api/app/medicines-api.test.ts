import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  medicineRow,
  medicineWire,
  TEST_BATCH_ID,
  TEST_MAKER_ID,
  TEST_MEDICINE_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';

import { appInstant } from './app-time.ts';
import {
  activeMedicalOrganizationId,
  createMedicine,
  deleteMedicine,
  fetchAllMedicines,
  fetchMedicine,
  listMedicines,
  medicineListQuery,
  medicineQueryKeys,
  quickCreateMedicine,
  restoreMedicine,
  setNearExpiryDiscount,
  setNearExpiryDiscountWithin,
  updateMedicine,
} from './medicines-api.ts';
import type { MedicineInput } from './medicines-contracts.ts';

/** The clinic's day every range here is read on. */
const TODAY = '2026-10-10';

/** A list page as the API answers it. */
const page = (data: unknown[], next: string | null = null) => ({
  data,
  meta: {
    request_id: 'req',
    pagination: {
      per_page: 50,
      next,
      has_more: next !== null,
      estimated_total: data.length,
    },
  },
});

/** The drawer's fields for Azelaic gel as saved. */
const input = (fields: Partial<MedicineInput> = {}): MedicineInput => ({
  name: 'Azelaic gel 15g',
  composition: 'Azelaic acid 15%',
  manufacturerId: TEST_MAKER_ID,
  prescriptionOnly: false,
  mrp: 650,
  gstPct: 12,
  minStock: 2,
  maxStock: 20,
  batches: [
    {
      id: TEST_BATCH_ID,
      batchNo: '026-312',
      expiry: '12/27',
      qty: 12,
      purchaseRate: 420,
      supplierId: TEST_SUPPLIER_ID,
    },
  ],
  supplierRates: [{ supplierId: TEST_SUPPLIER_ID, rate: 420, free: 0, leadDays: 2 }],
  ...fields,
});

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
  it('carry the organization, every list under one prefix', () => {
    expect(activeMedicalOrganizationId()).toBe('org_test');
    expect(medicineQueryKeys.list('org_test', { q: 'azel' })).toEqual([
      'app',
      'medicines',
      'org_test',
      'list',
      { q: 'azel' },
    ]);
    expect(medicineQueryKeys.detail('org_test', TEST_MEDICINE_ID)).toEqual([
      'app',
      'medicines',
      'org_test',
      'detail',
      TEST_MEDICINE_ID,
    ]);
  });
});

describe('medicineListQuery (`medical.md:41–47`)', () => {
  it('reads 50 by name unless sorted; Low stock is low and out; a window and makers', () => {
    expect(medicineListQuery({}, TODAY)).toEqual({
      limit: 50,
      q: undefined,
      stock_level: undefined,
      expiring_within_days: undefined,
      manufacturer_id: undefined,
      created_from: undefined,
      created_to: undefined,
      sort: undefined,
      order: undefined,
    });
    expect(
      medicineListQuery(
        {
          q: ' azel ',
          stock: 'low',
          expiry: '60',
          manufacturer: [TEST_MAKER_ID, 'mfr_other00000000000000000'],
          created: 'today',
          sort: 'margin',
          order: 'desc',
        },
        TODAY,
      ),
    ).toEqual({
      limit: 50,
      q: 'azel',
      stock_level: 'low,out',
      expiring_within_days: '60',
      manufacturer_id: `${TEST_MAKER_ID},mfr_other00000000000000000`,
      created_from: appInstant(TODAY, '00:00'),
      created_to: appInstant('2026-10-11', '00:00'),
      sort: 'margin_percent',
      order: 'desc',
    });
    expect(
      medicineListQuery({ sort: 'manufacturer', order: 'asc' }, TODAY),
    ).toMatchObject({
      sort: 'manufacturer_name',
    });
  });
});

describe('the reads', () => {
  it('a page maps each medicine to its row — rupees, "MM/YY", the days left', async () => {
    vi.mocked(api.get).mockResolvedValue(page([medicineWire()], 'cursor_b') as never);
    const result = await listMedicines({ stock: 'low' }, 'cursor_a');
    expect(vi.mocked(api.get).mock.calls[0]?.[1]).toMatchObject({
      query: { stock_level: 'low,out', after: 'cursor_a' },
    });
    expect(result.next).toBe('cursor_b');
    expect(result.rows[0]).toMatchObject({
      id: TEST_MEDICINE_ID,
      seq: 458,
      mrp: 650,
      manufacturer: { id: TEST_MAKER_ID, name: 'SUN PHARMA', tone: 'sky' },
      nearest: { batchNo: '026-312', expiry: '12/27' },
      bestRate: { supplierId: TEST_SUPPLIER_ID, rate: 420 },
      batches: [{ id: TEST_BATCH_ID, expiry: '12/27', purchaseRate: 420 }],
      nearExpiryDiscountPct: 0,
    });
    expect(result.rows[0]?.nearest?.daysLeft).toBeGreaterThan(400);
  });

  it('the catalogue reads every page, 100 at a time, by name', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(page([medicineWire()], 'cursor_b') as never)
      .mockResolvedValueOnce(
        page([
          medicineWire({ id: 'med_second0000000000000000', name: 'Benzac' }),
        ]) as never,
      );
    const rows = await fetchAllMedicines();
    expect(rows.map((row) => row.name)).toEqual(['Azelaic gel 15g', 'Benzac']);
    expect(vi.mocked(api.get).mock.calls[1]?.[1]).toMatchObject({
      query: { limit: 100, after: 'cursor_b', sort: 'name' },
    });
  });

  it('one medicine by its id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: medicineWire() } as never);
    expect((await fetchMedicine(TEST_MEDICINE_ID)).name).toBe('Azelaic gel 15g');
    expect(vi.mocked(api.get).mock.calls[0]).toEqual([
      '/app/medicines/{medicine_id}',
      { params: { medicine_id: TEST_MEDICINE_ID } },
    ]);
  });
});

describe('the writes', () => {
  it('a new medicine is a full record, the expiry month as the API takes it', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: medicineWire() } as never);
    await createMedicine(
      input({ batches: [{ ...input().batches[0]!, id: undefined }] }),
      'key',
    );
    expect(vi.mocked(api.post).mock.calls[0]).toEqual([
      '/app/medicines',
      {
        body: {
          name: 'Azelaic gel 15g',
          composition: 'Azelaic acid 15%',
          manufacturer_id: TEST_MAKER_ID,
          is_prescription_only: false,
          mrp: 650,
          gst_percent: 12,
          min_stock: 2,
          max_stock: 20,
          batches: [
            {
              batch_number: '026-312',
              expiry_month: '2027-12',
              quantity: 12,
              purchase_rate: 420,
              supplier_id: TEST_SUPPLIER_ID,
            },
          ],
          supplier_prices: [
            { supplier_id: TEST_SUPPLIER_ID, rate: 420, free_quantity: 0, lead_days: 2 },
          ],
          is_quick: false,
        },
        idempotencyKey: 'key',
      },
    ]);
  });

  it('a save sends only what changed, with the read’s updated_at', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: medicineWire({ mrp: 700 }) } as never);
    const saved = await updateMedicine(medicineRow(), input({ mrp: 700 }), 'key');
    expect(saved.mrp).toBe(700);
    expect(vi.mocked(api.patch).mock.calls[0]).toEqual([
      '/app/medicines/{medicine_id}',
      {
        params: { medicine_id: TEST_MEDICINE_ID },
        body: { mrp: 700, expected_updated_at: medicineRow().updatedAt },
        idempotencyKey: 'key',
      },
    ]);
  });

  it('a save of nothing changed writes nothing; a quick record saved as it is turns full', async () => {
    expect(await updateMedicine(medicineRow(), input(), 'key')).toEqual(medicineRow());
    expect(api.patch).not.toHaveBeenCalled();
    vi.mocked(api.patch).mockResolvedValue({ data: medicineWire() } as never);
    await updateMedicine(medicineRow({ isQuick: true }), input(), 'key');
    expect(vi.mocked(api.patch).mock.calls[0]?.[1]).toMatchObject({
      body: { name: 'Azelaic gel 15g' },
    });
  });

  it('a quick medicine is the typed name under its maker', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: medicineWire({ is_quick: true }),
    } as never);
    await quickCreateMedicine(
      { name: ' Azel cream ', manufacturerId: TEST_MAKER_ID },
      'key',
    );
    expect(vi.mocked(api.post).mock.calls[0]?.[1]).toEqual({
      body: { name: 'Azel cream', is_quick: true, manufacturer_id: TEST_MAKER_ID },
      idempotencyKey: 'key',
    });
  });

  it('the row’s near-expiry discount changes each medicine; 0 removes it', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: medicineWire() } as never);
    await setNearExpiryDiscount([medicineRow()], 20, 'key');
    await setNearExpiryDiscount([medicineRow()], 0, 'undo');
    expect(vi.mocked(api.patch).mock.calls.map((call) => call[1])).toEqual([
      {
        params: { medicine_id: TEST_MEDICINE_ID },
        body: { near_expiry_discount_percent: 20 },
        idempotencyKey: 'key:0',
      },
      {
        params: { medicine_id: TEST_MEDICINE_ID },
        body: { near_expiry_discount_percent: null },
        idempotencyKey: 'undo:0',
      },
    ]);
  });

  it('"Sell all at 20% off" is one write over the window, answering how many', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { updated_count: 3 } } as never);
    expect(await setNearExpiryDiscountWithin(30, 20, 'key')).toBe(3);
    expect(vi.mocked(api.post).mock.calls[0]).toEqual([
      '/app/medicines/near-expiry-discount',
      { body: { expiring_within_days: 30, discount_percent: 20 }, idempotencyKey: 'key' },
    ]);
  });

  it('a delete carries its reason and note; the restore its key', async () => {
    vi.mocked(api.delete).mockResolvedValue({} as never);
    vi.mocked(api.post).mockResolvedValue({ data: medicineWire() } as never);
    await deleteMedicine(TEST_MEDICINE_ID, 'other', 'Discontinued');
    await deleteMedicine(TEST_MEDICINE_ID, 'duplicate', null);
    await restoreMedicine(TEST_MEDICINE_ID, 'key');
    expect(vi.mocked(api.delete).mock.calls.map((call) => call[1])).toEqual([
      {
        params: { medicine_id: TEST_MEDICINE_ID },
        reason: 'other',
        note: 'Discontinued',
      },
      { params: { medicine_id: TEST_MEDICINE_ID }, reason: 'duplicate' },
    ]);
    expect(vi.mocked(api.post).mock.calls[0]).toEqual([
      '/app/medicines/{medicine_id}/restore',
      { params: { medicine_id: TEST_MEDICINE_ID }, idempotencyKey: 'key' },
    ]);
  });
});
