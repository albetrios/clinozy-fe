import { describe, expect, it } from 'vitest';

import {
  organizationStockCheck,
  organizationStockCreate,
  organizationStockItemEdit,
  organizationStockPurchaseEdit,
  organizationStockTab,
  organizationStockVendorEdit,
} from './stock-builders.ts';

describe('the Clinic stock room builders', () => {
  it('build the Clinic stock tabs and their dialog routes (S:72–83)', () => {
    const slug = { organizationSlug: 'acme' };
    expect(organizationStockTab('acme', 'movements')).toEqual({
      to: '/organization/$organizationSlug/stock/movements',
      params: slug,
    });
    expect(organizationStockCreate('acme', 'purchases')).toEqual({
      to: '/organization/$organizationSlug/stock/purchases/create',
      params: slug,
    });
    expect(organizationStockItemEdit('acme', 'I1')).toEqual({
      to: '/organization/$organizationSlug/stock/items/$itemId/edit',
      params: { ...slug, itemId: 'I1' },
    });
    expect(organizationStockCheck('acme')).toEqual({
      to: '/organization/$organizationSlug/stock/items/check',
      params: slug,
    });
    expect(organizationStockPurchaseEdit('acme', 'P1')).toEqual({
      to: '/organization/$organizationSlug/stock/purchases/$purchaseId/edit',
      params: { ...slug, purchaseId: 'P1' },
    });
    expect(organizationStockVendorEdit('acme', 'V1')).toEqual({
      to: '/organization/$organizationSlug/stock/vendors/$vendorId/edit',
      params: { ...slug, vendorId: 'V1' },
    });
  });
});
