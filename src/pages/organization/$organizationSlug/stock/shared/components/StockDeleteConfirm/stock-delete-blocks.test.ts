import { renderHook } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { describe, expect, it } from 'vitest';

import {
  stockItemRow,
  stockPurchaseRow,
  stockVendorRow,
} from '@/tests/utils/stock-doubles.ts';

import { STOCK_DRAWER_KEYS, STOCK_DRAWERS_NS } from '../../stock-drawers.constants.ts';
import {
  isStockDeleteBlock,
  itemDeleteBlock,
  purchaseDeleteBlock,
  useStockDeleteBlockText,
  vendorDeleteBlock,
} from './stock-delete-blocks.ts';

describe('what refuses a delete (the API’s 409 reasons)', () => {
  it('an item with stock, a purchase with money paid, a vendor still owed — known before asking', () => {
    expect(itemDeleteBlock(stockItemRow())).toBe('item_has_stock');
    expect(itemDeleteBlock(stockItemRow({ qtyMilli: 0 }))).toBeNull();
    expect(purchaseDeleteBlock(stockPurchaseRow())).toBe('purchase_paid');
    expect(purchaseDeleteBlock(stockPurchaseRow({ paid: 0 }))).toBeNull();
    expect(vendorDeleteBlock(stockVendorRow())).toBe('vendor_has_dues');
    expect(vendorDeleteBlock(stockVendorRow({ payable: 0 }))).toBeNull();
  });

  it('reads the refusals the room words itself, and nothing else', () => {
    expect(isStockDeleteBlock('not_enough_stock')).toBe(true);
    expect(isStockDeleteBlock('record_changed')).toBe(false);
    expect(isStockDeleteBlock('toString')).toBe(false);
    expect(isStockDeleteBlock(undefined)).toBe(false);
  });

  it('words each refusal with its own copy', () => {
    const { result } = renderHook(() => ({
      text: useStockDeleteBlockText(),
      t: useTranslation(STOCK_DRAWERS_NS).t,
    }));
    const { text, t } = result.current;
    const K = STOCK_DRAWER_KEYS.confirm.blocked;
    expect(text('item_has_stock')).toBe(t(K.itemHasStock));
    expect(text('purchase_paid')).toBe(t(K.purchasePaid));
    expect(text('vendor_has_dues')).toBe(t(K.vendorHasDues));
    expect(text('not_enough_stock')).toBe(t(K.stockUsed));
  });
});
