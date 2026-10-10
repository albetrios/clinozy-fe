import { describe, expect, it } from 'vitest';

import { stockItemRow, TEST_STOCK_VENDOR_ID } from '@/tests/utils/stock-doubles.ts';

import { itemFormOf, itemInputOf, newItemForm } from './stock-item-form.ts';

/** Soframycin as the API keeps it: 2.5 tubes of 30 g, half a tube a week, 1 to 10. */
const SOFRAMYCIN = stockItemRow({ qtyMilli: 2500, maxQty: 10 });

describe('the item form (clinic-stock.md:105–124)', () => {
  it('starts a new item on Consumables · pack in ml, 1 to 10, with nothing in stock', () => {
    expect(newItemForm('Cotton')).toEqual({
      name: 'Cotton',
      category: 'consumables',
      unit: 'pack',
      contents: '',
      measure: 'ml',
      inStock: '',
      usage: '',
      minQty: 1,
      maxQty: 10,
      vendorId: null,
    });
  });

  it('reads a saved item’s decimals as text and sends them back ×1000', () => {
    const form = itemFormOf(SOFRAMYCIN);
    expect(form).toMatchObject({
      contents: '30',
      measure: 'g',
      inStock: '2.5',
      usage: '0.5',
    });
    expect(itemInputOf({ ...form, name: ' Soframycin ' })).toEqual({
      name: 'Soframycin',
      category: 'creams_serums',
      unit: 'tube',
      sizePerUnit: 30_000,
      measureUnit: 'g',
      minQty: 1,
      maxQty: 10,
      usagePerWeekMilli: 500,
      vendorId: TEST_STOCK_VENDOR_ID,
      qtyMilli: 2500,
    });
  });

  it('keeps the levels as the API sent them — decimals too', () => {
    const form = itemFormOf({ ...SOFRAMYCIN, minQty: 1.5, maxQty: 4.5 });
    expect(form).toMatchObject({ minQty: 1.5, maxQty: 4.5 });
    expect(itemInputOf(form)).toMatchObject({ minQty: 1.5, maxQty: 4.5 });
  });

  it('sends contents and their measure together, or neither', () => {
    const none = itemFormOf({ ...SOFRAMYCIN, sizePerUnit: null, measureUnit: null });
    expect(none).toMatchObject({ contents: '', measure: 'ml' });
    expect(itemInputOf(none)).toMatchObject({ sizePerUnit: null, measureUnit: null });
  });
});
