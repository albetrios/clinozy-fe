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
  stockItemWire,
  stockMovementWire,
  stockPurchaseWire,
  stockVendorWire,
  TEST_STOCK_AUTHOR_ID,
  TEST_STOCK_ITEM_ID,
  TEST_STOCK_PURCHASE_ID,
  TEST_STOCK_VENDOR_ID,
} from '@/tests/utils/stock-doubles.ts';

import {
  fetchAllStockItems,
  fetchAllStockVendors,
  fetchStockItem,
  fetchStockPurchase,
  fetchStockVendor,
  listStockItems,
  listStockMovements,
  listStockPurchases,
  listStockVendors,
  stockItemListQuery,
  stockListSummary,
  stockMovementListQuery,
  stockPurchaseListQuery,
} from './stock-api.ts';

/** The clinic's day every range here is read on. */
const TODAY = '2026-10-10';

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

beforeEach(() => {
  vi.resetAllMocks();
  queryClient.clear();
  signInTestMember();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(clinicInstant(TODAY, '10:00')));
});
afterEach(() => {
  vi.useRealTimers();
  useOrganizationStore.getState().clearOrganization();
});

describe('the list queries', () => {
  it('reads items by name, 50 a page; Low stock is low and out; a sort maps to the API’s', () => {
    expect(stockItemListQuery({}, TODAY)).toEqual({
      limit: 50,
      q: undefined,
      stock_level: undefined,
      category: undefined,
      created_from: undefined,
      created_to: undefined,
      sort: undefined,
      order: undefined,
    });
    expect(
      stockItemListQuery(
        {
          q: ' gloves ',
          stock: 'low',
          category: ['masks', 'peels'],
          sort: 'lasts',
          order: 'asc',
        },
        TODAY,
      ),
    ).toMatchObject({
      q: 'gloves',
      stock_level: 'low,out',
      category: 'masks,peels',
      sort: 'lasts_days',
      order: 'asc',
    });
    expect(stockItemListQuery({ sort: 'stock', order: 'desc' }, TODAY)).toMatchObject({
      sort: 'quantity',
      order: 'desc',
    });
  });

  it('reads purchases latest bill first unless sorted, with their statuses and vendor', () => {
    expect(
      stockPurchaseListQuery(
        { status: ['unpaid', 'partial'], vendor: TEST_STOCK_VENDOR_ID, created: 'today' },
        TODAY,
      ),
    ).toEqual({
      limit: 50,
      q: undefined,
      payment_status: 'unpaid,partial',
      stock_vendor_id: TEST_STOCK_VENDOR_ID,
      created_from: clinicInstant(TODAY, '00:00'),
      created_to: clinicInstant('2026-10-11', '00:00'),
      sort: undefined,
      order: undefined,
    });
    expect(stockPurchaseListQuery({ sort: 'due', order: 'desc' }, TODAY)).toMatchObject({
      sort: 'due_amount',
      order: 'desc',
    });
  });

  it('reads movements newest first by type and item — never a search', () => {
    expect(
      stockMovementListQuery(
        { type: ['used', 'opening'], item: TEST_STOCK_ITEM_ID },
        TODAY,
      ),
    ).toEqual({
      limit: 50,
      type: 'used,opening',
      stock_item_id: TEST_STOCK_ITEM_ID,
      created_from: undefined,
      created_to: undefined,
    });
  });
});

describe('items', () => {
  it('maps a page — quantities ×1000, the server’s level and runway — each with its vendor', async () => {
    answer({
      '/app/stock-items': () =>
        page([stockItemWire()], { next: 'cur_2', has_more: true, estimated_total: 12 }),
      '/app/stock-vendors': () => page([stockVendorWire()]),
    });
    const { rows, next, total } = await listStockItems({ stock: 'low' }, 'cur_1');
    expect(queryOf('/app/stock-items')).toMatchObject({
      after: 'cur_1',
      stock_level: 'low,out',
    });
    expect(next).toBe('cur_2');
    expect(total).toBe(12);
    expect(rows).toEqual([
      {
        id: TEST_STOCK_ITEM_ID,
        seq: 167,
        name: 'Soframycin 30 gm',
        category: 'creams_serums',
        unit: 'tube',
        sizePerUnit: 30_000,
        measureUnit: 'g',
        qtyMilli: 3000,
        minQty: 1,
        maxQty: 5,
        usagePerWeekMilli: 500,
        vendorId: TEST_STOCK_VENDOR_ID,
        level: 'ok',
        lastsDays: 42,
        lastRate: 250.5,
        createdAt: '2026-10-01T05:00:00.000Z',
        updatedAt: '2026-10-09T08:00:00.000Z',
        vendor: {
          id: TEST_STOCK_VENDOR_ID,
          name: 'Ankur Pharma',
          phone: '+919876500011',
        },
      },
    ]);
  });

  it('reads the vendor list once for every page, and keeps a gone vendor as none', async () => {
    answer({
      '/app/stock-items': () =>
        page([
          stockItemWire(),
          stockItemWire({
            id: 'sitm_gauze000000000000000',
            stock_vendor_id: 'svnd_gone',
          }),
          stockItemWire({ id: 'sitm_mask0000000000000000', stock_vendor_id: null }),
        ]),
      '/app/stock-vendors': () => page([stockVendorWire()]),
    });
    const first = await listStockItems({});
    await listStockItems({ q: 'mask' });
    expect(first.rows.map((row) => row.vendor?.name ?? null)).toEqual([
      'Ankur Pharma',
      null,
      null,
    ]);
    expect(
      vi.mocked(api.get).mock.calls.filter(([path]) => path === '/app/stock-vendors'),
    ).toHaveLength(1);
  });

  it('reads every item, the latest first, and one item by its id', async () => {
    answer({
      '/app/stock-items': (query) =>
        query.after
          ? page([
              stockItemWire({ id: 'sitm_gauze000000000000000', stock_item_number: 1 }),
            ])
          : page([stockItemWire()], { next: 'cur_2', has_more: true }),
      '/app/stock-items/{stock_item_id}': () => ({
        data: stockItemWire({ quantity: 0, stock_level: 'out', lasts_days: 0 }),
      }),
      '/app/stock-vendors': () => page([stockVendorWire()]),
    });
    const all = await fetchAllStockItems();
    expect(all.map((item) => item.seq)).toEqual([167, 1]);
    expect(queryOf('/app/stock-items')).toMatchObject({
      limit: 100,
      sort: 'stock_item_number',
      order: 'desc',
    });
    expect(await fetchStockItem(TEST_STOCK_ITEM_ID)).toMatchObject({
      qtyMilli: 0,
      level: 'out',
      lastsDays: 0,
      vendor: { name: 'Ankur Pharma' },
    });
    expect(api.get).toHaveBeenCalledWith('/app/stock-items/{stock_item_id}', {
      params: { stock_item_id: TEST_STOCK_ITEM_ID },
    });
  });

  it('refuses an answer the contract does not hold', async () => {
    answer({ '/app/stock-items': () => page([stockItemWire({ stock_level: 'empty' })]) });
    await expect(listStockItems({})).rejects.toThrow();
  });
});

describe('purchases', () => {
  it('maps a page — money in rupees, the server’s due and status — each with its vendor', async () => {
    answer({
      '/app/stock-purchases': () => page([stockPurchaseWire()], { estimated_total: 2 }),
      '/app/stock-vendors': () => page([stockVendorWire()]),
    });
    const { rows, total } = await listStockPurchases({ status: ['partial'] });
    expect(total).toBe(2);
    expect(rows[0]).toEqual({
      id: TEST_STOCK_PURCHASE_ID,
      seq: 16,
      vendorId: TEST_STOCK_VENDOR_ID,
      billNo: 'INV-221',
      date: '2026-10-09',
      lines: [
        {
          lineNumber: 1,
          itemId: TEST_STOCK_ITEM_ID,
          qtyMilli: 5000,
          rate: 250.5,
          amount: 1252.5,
        },
      ],
      bill: 2392.5,
      paid: 892.5,
      due: 1500,
      status: 'partial',
      paymentIds: ['pay_35tperctcuf576w6l4i3j'],
      createdAt: '2026-10-01T05:00:00.000Z',
      updatedAt: '2026-10-09T08:00:00.000Z',
      vendor: { id: TEST_STOCK_VENDOR_ID, name: 'Ankur Pharma', phone: '+919876500011' },
    });
  });

  it('reads one purchase, and an empty page without the vendor list', async () => {
    answer({
      '/app/stock-purchases': () => page([]),
      '/app/stock-purchases/{stock_purchase_id}': () => ({ data: stockPurchaseWire() }),
      '/app/stock-vendors': () => page([stockVendorWire()]),
    });
    expect((await listStockPurchases({})).rows).toEqual([]);
    expect(queryOf('/app/stock-vendors')).toBeUndefined();
    expect(await fetchStockPurchase(TEST_STOCK_PURCHASE_ID)).toMatchObject({
      seq: 16,
      vendor: { name: 'Ankur Pharma' },
    });
  });
});

describe('movements', () => {
  it('maps a page — the change and balance ×1000 — with its item and author', async () => {
    vi.mocked(fetchTeamDirectory).mockResolvedValue([
      {
        id: TEST_STOCK_AUTHOR_ID,
        userId: 'usr_nisha',
        name: 'Dr. Nisha Shah',
        initials: 'NS',
        tone: 'sky',
        roleIds: [],
        branchIds: [],
      },
    ]);
    answer({
      '/app/stock-item-movements': () =>
        page(
          [
            stockMovementWire(),
            stockMovementWire({
              id: 'smov_revert0000000000000',
              type: 'reverted',
              quantity_change: 0.5,
              quantity_after: 3,
              used_for: null,
              reverts_stock_item_movement_id: 'smov_use000000000000000000',
              reverts_type: 'used',
              reverts_created_at: '2026-10-10T05:35:00.000Z',
              revert_reason: 'wrong_quantity',
              author_membership_id: 'mem_left00000000000000000',
            }),
            stockMovementWire({
              id: 'smov_receipt000000000000',
              type: 'received',
              stock_item_id: 'sitm_gone0000000000000000',
              stock_purchase_id: TEST_STOCK_PURCHASE_ID,
              stock_purchase_number: 16,
              bill_number: 'AP-1042',
              reverted_by_stock_item_movement_id: 'smov_x',
              author_membership_id: null,
            }),
          ],
          { estimated_total: 3 },
        ),
      '/app/stock-items': () => page([stockItemWire()]),
      '/app/stock-vendors': () => page([stockVendorWire()]),
    });
    const { rows, total } = await listStockMovements({ type: ['used'] });
    expect(total).toBe(3);
    const [use, revert, receipt] = rows;
    expect(use).toMatchObject({
      kind: 'used',
      deltaMilli: -500,
      afterMilli: 2500,
      usedFor: 'LHR · Dharti Galani',
      item: { id: TEST_STOCK_ITEM_ID, name: 'Soframycin 30 gm', unit: 'tube' },
      by: { name: 'Dr. Nisha Shah', initials: 'NS', tone: 'sky' },
      reverted: false,
      reverts: null,
      purchase: null,
    });
    // A member who left shows no avatar; the original's type and time are the server's.
    expect(revert).toMatchObject({
      by: null,
      reverts: {
        movementId: 'smov_use000000000000000000',
        kind: 'used',
        at: '2026-10-10T05:35:00.000Z',
        reason: 'wrong_quantity',
      },
    });
    // A deleted item is none; the purchase's number and bill are the server's.
    expect(receipt).toMatchObject({
      item: null,
      by: null,
      reverted: true,
      purchase: { id: TEST_STOCK_PURCHASE_ID, seq: 16, billNo: 'AP-1042' },
    });
  });

  it('reads neither the items nor the team for an empty page', async () => {
    answer({ '/app/stock-item-movements': () => page([]) });
    expect((await listStockMovements({})).rows).toEqual([]);
    expect(fetchTeamDirectory).not.toHaveBeenCalled();
  });
});

describe('vendors', () => {
  it('reads a page by payable and one vendor, each with the server’s purchase count', async () => {
    answer({
      '/app/stock-vendors': () => page([stockVendorWire()], { estimated_total: 1 }),
      '/app/stock-vendors/{stock_vendor_id}': () => ({
        data: stockVendorWire({ payable: 0 }),
      }),
    });
    const { rows } = await listStockVendors({
      q: ' ankur ',
      sort: 'payable',
      order: 'desc',
    });
    expect(queryOf('/app/stock-vendors')).toMatchObject({
      limit: 50,
      q: 'ankur',
      sort: 'payable',
      order: 'desc',
    });
    expect(rows).toEqual([
      {
        id: TEST_STOCK_VENDOR_ID,
        name: 'Ankur Pharma',
        phone: '+919876500011',
        isQuick: false,
        payable: 1500,
        createdAt: '2026-10-01T05:00:00.000Z',
        updatedAt: '2026-10-09T08:00:00.000Z',
        purchaseCount: 2,
      },
    ]);
    expect(await fetchStockVendor(TEST_STOCK_VENDOR_ID)).toMatchObject({
      payable: 0,
      purchaseCount: 2,
    });
  });

  it('reads every vendor, 100 at a time, by name', async () => {
    answer({
      '/app/stock-vendors': (query) =>
        query.after
          ? page([stockVendorWire({ id: 'svnd_ibreia00000000000000', name: 'Ibreia' })])
          : page([stockVendorWire()], { next: 'cur_2', has_more: true }),
    });
    expect((await fetchAllStockVendors()).map((vendor) => vendor.name)).toEqual([
      'Ankur Pharma',
      'Ibreia',
    ]);
    expect(queryOf('/app/stock-vendors')).toMatchObject({
      limit: 100,
      sort: 'name',
      after: 'cur_2',
    });
  });
});

describe('stockListSummary', () => {
  it('reads Purchases’ count and due over its filters, one row', async () => {
    answer({
      '/app/stock-purchases': () =>
        page([stockPurchaseWire()], { estimated_total: 4 }, { due_total: 2310 }),
    });
    expect(await stockListSummary('purchases', { status: ['unpaid'] }, TODAY)).toEqual({
      total: 4,
      due: 2310,
    });
    expect(queryOf('/app/stock-purchases')).toMatchObject({
      limit: 1,
      payment_status: 'unpaid',
    });
  });

  it('reads Movements’ count — nothing due', async () => {
    answer({
      '/app/stock-item-movements': () => page([], { estimated_total: 7 }),
    });
    expect(await stockListSummary('movements', { type: ['used'] }, TODAY)).toEqual({
      total: 7,
      due: null,
    });
  });

  it('reads Vendors’ count and what is owed to them (`payable_total`), following the search', async () => {
    answer({
      '/app/stock-vendors': (query) =>
        page(
          [],
          { estimated_total: query.q ? 1 : 5 },
          { payable_total: query.q ? 1500 : 1750 },
        ),
    });
    expect(await stockListSummary('vendors', {}, TODAY)).toEqual({ total: 5, due: 1750 });
    expect(queryOf('/app/stock-vendors')).toEqual({ q: undefined, limit: 1 });
    expect(await stockListSummary('vendors', { q: 'ankur' }, TODAY)).toEqual({
      total: 1,
      due: 1500,
    });
    expect(queryOf('/app/stock-purchases')).toBeUndefined();
  });

  it('says nothing it was not told — no total, no due', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] } as never);
    expect(await stockListSummary('purchases', {}, TODAY)).toEqual({
      total: null,
      due: null,
    });
  });
});
