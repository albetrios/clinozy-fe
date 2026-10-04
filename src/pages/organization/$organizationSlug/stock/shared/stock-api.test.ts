import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  fetchStockItem,
  fetchStockPurchase,
  fetchStockVendor,
  listStockItems,
  listStockMovements,
  listStockPurchases,
  listStockVendors,
  stockFacets,
  stockListSummary,
} from './stock-api.ts';

afterEach(() => resetClinicFixtures());

const names = (rows: readonly { name: string }[]) => rows.map((row) => row.name);

describe('items (`S:1681`)', () => {
  it('reads each item with its vendor, level and runway, by name', async () => {
    const { items, nextCursor } = await listStockItems();
    expect(nextCursor).toBeNull();
    expect(names(items)).toEqual([
      'D-Tan Mask',
      'Fucibet',
      'Gauze swabs',
      'Nitrile gloves (M)',
      'Noprik Plus numbing cream 50 gm',
      'Retises Nano Peel 1%',
      'Richclin Gel',
      'Soframycin 30 gm',
      'Water bottles',
      'Yellow Peel (Reti peel)',
    ]);
    expect(await fetchStockItem(ref.stockItem(167))).toMatchObject({
      seq: 167,
      level: 'ok',
      lastsDays: 42,
      vendor: { name: 'Ankur Pharma' },
    });
    expect(items[0]).toMatchObject({ level: 'out', lastsDays: 0, vendor: null });
  });

  it('filters Low stock, categories and runways; searches name, category or vendor', async () => {
    expect(names((await listStockItems({ stock: 'low' })).items)).toEqual([
      'D-Tan Mask',
      'Retises Nano Peel 1%',
    ]);
    expect(names((await listStockItems({ category: ['masks'] })).items)).toEqual([
      'D-Tan Mask',
    ]);
    expect(names((await listStockItems({ lasts: ['w6', 'd0'] })).items)).toEqual([
      'D-Tan Mask',
      'Soframycin 30 gm',
    ]);
    expect((await listStockItems({ q: 'cream' })).items).toHaveLength(4);
    expect(names((await listStockItems({ q: 'sidhdhi' })).items)).toEqual([
      'Gauze swabs',
      'Nitrile gloves (M)',
      'Noprik Plus numbing cream 50 gm',
    ]);
  });

  it('sorts by any column, No usage last', async () => {
    const byLasts = await listStockItems({ sort: 'lasts', order: 'asc' });
    expect(byLasts.items.slice(0, 3).map((row) => row.seq)).toEqual([161, 164, 159]);
    const byStock = await listStockItems({ sort: 'stock', order: 'desc' });
    expect(byStock.items[0]?.name).toBe('Water bottles');
    const bySeq = await listStockItems({ sort: 'seq', order: 'desc' });
    expect(bySeq.items[0]?.seq).toBe(167);
    const byCategory = await listStockItems({ sort: 'category', order: 'asc' });
    expect(byCategory.items[0]?.category).toBe('consumables');
    await clinicFixtures.stockItems.update(ref.stockItem(167), { usagePerWeekMilli: 0 });
    const noUsage = await listStockItems({ sort: 'lasts', order: 'asc' });
    expect(noUsage.items.at(-1)?.seq).toBe(167);
  });
});

describe('purchases (`S:1683`)', () => {
  it('reads each bill with its vendor, due and status, the latest first', async () => {
    const { items } = await listStockPurchases();
    expect(items.map((row) => row.seq)).toEqual([16, 15, 14, 12]);
    expect(await fetchStockPurchase(ref.stockPurchase(15))).toMatchObject({
      vendor: { name: 'Cranix Pharma' },
      bill: 171_000,
      due: 171_000,
      status: 'unpaid',
    });
    expect(items[0]).toMatchObject({ due: 60_000, status: 'partly' });
    await expect(fetchStockPurchase(ref.stockPurchase(99))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('filters statuses and a vendor, searches the bill, sorts the money', async () => {
    const seqs = async (params: Parameters<typeof listStockPurchases>[0]) =>
      (await listStockPurchases(params)).items.map((row) => row.seq);
    expect(await seqs({ status: ['unpaid', 'partly'] })).toEqual([16, 15]);
    expect(await seqs({ vendor: ref.stockVendor(2) })).toEqual([15]);
    expect(await seqs({ q: 'sw-77' })).toEqual([16]);
    expect(await seqs({ q: '#14' })).toEqual([14]);
    expect(await seqs({ sort: 'bill', order: 'asc' })).toEqual([16, 15, 14, 12]);
    expect(await seqs({ sort: 'due', order: 'desc' })).toEqual([15, 16, 14, 12]);
    expect(await seqs({ sort: 'vendor', order: 'asc' })).toEqual([12, 15, 16, 14]);
  });
});

describe('movements (`S:1682`)', () => {
  it('lists every change and a Payment per purchase with money paid, newest first', async () => {
    const { items } = await listStockMovements();
    expect(items).toHaveLength(7);
    expect(items[0]).toMatchObject({
      kind: 'used',
      item: { name: 'Noprik Plus numbing cream 50 gm', unit: 'tube' },
      note: 'LHR · Dharti Galani',
      deltaMilli: -1000,
      reverted: false,
      by: { initials: 'KP' },
    });
    const payments = items.filter((row) => row.kind === 'payment');
    expect(payments.map((row) => row.purchase.seq)).toEqual([16, 14, 12]);
    expect(payments[0]).toMatchObject({
      vendorName: 'Shivam Water',
      amount: 60_000,
      by: { name: 'Riya Shah' },
    });
  });

  it('filters types and an item, searches the party or its note', async () => {
    expect((await listStockMovements({ type: ['payment'] })).items).toHaveLength(3);
    expect((await listStockMovements({ type: ['used'] })).items).toHaveLength(2);
    const soframycin = await listStockMovements({ item: ref.stockItem(167) });
    expect(soframycin.items.map((row) => row.kind)).toEqual(['used']);
    expect((await listStockMovements({ q: 'dharti' })).items).toHaveLength(1);
    expect((await listStockMovements({ q: 'SW-77' })).items).toHaveLength(2);
  });

  it('strikes a reverted change through', async () => {
    const [first] = clinicFixtures.stockMovements.snapshot();
    if (!first) throw new Error('no movement');
    await clinicFixtures.stockMovements.update(first.id, { revertedById: first.id });
    const { items } = await listStockMovements({ type: ['used'] });
    expect(items.find((row) => row.id === first.id)).toMatchObject({ reverted: true });
  });
});

describe('vendors (`S:1684`, Q-K1)', () => {
  it('reads each vendor with their purchases and payable, by name', async () => {
    const { items } = await listStockVendors();
    expect(names(items)).toEqual([
      'Ankur Pharma',
      'Cranix Pharma',
      'Ibreia',
      'Shivam Water',
      'Sidhdhi Healthcare',
    ]);
    expect(await fetchStockVendor(ref.stockVendor(2))).toMatchObject({
      purchaseCount: 1,
      payable: 171_000,
      oldestOpenPurchase: { seq: 15, due: 171_000 },
    });
    expect(items.find((row) => row.name === 'Ibreia')).toMatchObject({
      purchaseCount: 0,
      payable: 0,
      oldestOpenPurchase: null,
    });
    await expect(fetchStockVendor(ref.stockVendor(99))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('searches a name or phone and sorts by payable', async () => {
    expect(names((await listStockVendors({ q: 'pharma' })).items)).toEqual([
      'Ankur Pharma',
      'Cranix Pharma',
    ]);
    const byPayable = await listStockVendors({ sort: 'payable', order: 'desc' });
    expect(names(byPayable.items).slice(0, 2)).toEqual(['Cranix Pharma', 'Shivam Water']);
  });
});

describe('footer figures and facets', () => {
  it('counts the rows and what is due on them', async () => {
    expect(await stockListSummary('purchases', {})).toEqual({ total: 4, due: 231_000 });
    expect(await stockListSummary('vendors', {})).toEqual({ total: 5, due: 231_000 });
    expect(await stockListSummary('movements', {})).toEqual({ total: 7, due: 0 });
  });

  it('names the values each automatic section can offer', async () => {
    const items = await stockFacets('items');
    expect(items.rows).toBe(10);
    expect(items.values.category).toEqual([
      'creams_serums',
      'peels',
      'masks',
      'consumables',
      'other',
    ]);
    expect(items.values.lasts).toEqual([
      'd0',
      'w2',
      'w4',
      'w6',
      'w7',
      'w13',
      'w17',
      'w20',
      'w27',
    ]);
    expect(await stockFacets('purchases')).toEqual({
      rows: 4,
      values: { status: ['paid', 'partly', 'unpaid'] },
    });
    expect(await stockFacets('movements')).toEqual({
      rows: 7,
      values: { type: ['used', 'received', 'damaged', 'payment'] },
    });
  });
});
