import { describe, expect, it } from 'vitest';

import {
  organizationManufacturerEdit,
  organizationMedicalCreate,
  organizationMedicalSale,
  organizationMedicalSaleReturn,
  organizationMedicalTab,
  organizationMedicineEdit,
  organizationMrEdit,
  organizationMrVisitCreate,
  organizationPurchaseOrder,
  organizationPurchaseOrderEdit,
  organizationPurchaseOrderReceive,
  organizationSupplierEdit,
} from './medical-builders.ts';

describe('the Medical room builders', () => {
  const slug = { organizationSlug: 'acme' };
  const MEDICAL = '/organization/$organizationSlug/medical';

  it('build each tab, and each tab’s create drawer (S:48–68)', () => {
    expect(organizationMedicalTab('acme', 'sales')).toEqual({
      to: `${MEDICAL}/sales`,
      params: slug,
    });
    expect(organizationMedicalTab('acme', 'payments')).toEqual({
      to: `${MEDICAL}/payments`,
      params: slug,
    });
    expect(organizationMedicalCreate('acme', 'mrs')).toEqual({
      to: `${MEDICAL}/mrs/create`,
      params: slug,
    });
  });

  it('build the record drawers over the tabs (S:51–70)', () => {
    expect(organizationMedicalSale('acme', 'S1')).toEqual({
      to: `${MEDICAL}/sales/$saleId`,
      params: { ...slug, saleId: 'S1' },
    });
    expect(organizationMedicalSaleReturn('acme', 'S1')).toEqual({
      to: `${MEDICAL}/sales/$saleId/return`,
      params: { ...slug, saleId: 'S1' },
    });
    expect(organizationMedicineEdit('acme', 'M1')).toEqual({
      to: `${MEDICAL}/medicines/$medicineId/edit`,
      params: { ...slug, medicineId: 'M1' },
    });
    expect(organizationPurchaseOrder('acme', 'PO1')).toEqual({
      to: `${MEDICAL}/purchases/$purchaseOrderId`,
      params: { ...slug, purchaseOrderId: 'PO1' },
    });
    expect(organizationPurchaseOrderEdit('acme', 'PO1')).toEqual({
      to: `${MEDICAL}/purchases/$purchaseOrderId/edit`,
      params: { ...slug, purchaseOrderId: 'PO1' },
    });
    expect(organizationPurchaseOrderReceive('acme', 'PO1')).toEqual({
      to: `${MEDICAL}/purchases/$purchaseOrderId/receive`,
      params: { ...slug, purchaseOrderId: 'PO1' },
    });
    expect(organizationSupplierEdit('acme', 'SU1')).toEqual({
      to: `${MEDICAL}/suppliers/$supplierId/edit`,
      params: { ...slug, supplierId: 'SU1' },
    });
    expect(organizationManufacturerEdit('acme', 'MF1')).toEqual({
      to: `${MEDICAL}/manufacturers/$manufacturerId/edit`,
      params: { ...slug, manufacturerId: 'MF1' },
    });
    expect(organizationMrEdit('acme', 'R1')).toEqual({
      to: `${MEDICAL}/mrs/$mrId/edit`,
      params: { ...slug, mrId: 'R1' },
    });
    expect(organizationMrVisitCreate('acme', 'R1')).toEqual({
      to: `${MEDICAL}/mrs/$mrId/visits/create`,
      params: { ...slug, mrId: 'R1' },
    });
  });
});
