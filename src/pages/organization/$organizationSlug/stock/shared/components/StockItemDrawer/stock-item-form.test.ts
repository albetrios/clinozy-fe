import { describe, expect, it } from 'vitest';

import type { StockItemRow } from '../../stock-contracts.ts';
import { itemFormOf, itemInputOf, newItemForm } from './stock-item-form.ts';

const SOFRAMYCIN = {
  id: 'i1',
  seq: 167,
  name: 'Soframycin 30 gm',
  category: 'creams_serums',
  unit: 'tube',
  sizePerUnit: 30_000,
  measureUnit: 'g',
  qtyMilli: 2500,
  minQty: 1,
  maxQty: 10,
  usagePerWeekMilli: 500,
  vendorId: 'v1',
} as StockItemRow;

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
      vendorId: 'v1',
      qtyMilli: 2500,
    });
  });

  it('sends contents and their measure together, or neither', () => {
    const none = itemFormOf({ ...SOFRAMYCIN, sizePerUnit: null, measureUnit: null });
    expect(none).toMatchObject({ contents: '', measure: 'ml' });
    expect(itemInputOf(none)).toMatchObject({ sizePerUnit: null, measureUnit: null });
  });
});
