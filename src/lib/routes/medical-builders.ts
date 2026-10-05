/**
 * Route builders for the Medical room — its tabs and their drawers (KICKOFF §6.7;
 * `S:48–71`) — `{ to, params }` for TanStack Router's typed `navigate` / `Link`,
 * like `builders.ts`. A module of their own, imported by path and never through
 * the `@/lib/routes/index.ts` barrel, which rides the entry chunk: only the code
 * that goes to these routes loads them.
 */

/** The Medical room's tabs (D24), each a literal child route (`S:48–71`). */
const MEDICAL_TAB_PATHS = {
  sales: '/organization/$organizationSlug/medical/sales',
  medicines: '/organization/$organizationSlug/medical/medicines',
  purchases: '/organization/$organizationSlug/medical/purchases',
  suppliers: '/organization/$organizationSlug/medical/suppliers',
  manufacturers: '/organization/$organizationSlug/medical/manufacturers',
  mrs: '/organization/$organizationSlug/medical/mrs',
  payments: '/organization/$organizationSlug/medical/payments',
} as const;

/** One Medical tab. */
export type MedicalTab = keyof typeof MEDICAL_TAB_PATHS;

/** A Medical tab's page — the list its dialogs open over. */
export function organizationMedicalTab(organizationSlug: string, tab: MedicalTab) {
  return { to: MEDICAL_TAB_PATHS[tab], params: { organizationSlug } } as const;
}

/** The Medical tabs with a create dialog route (`S:50–68`). */
const MEDICAL_CREATE_PATHS = {
  sales: '/organization/$organizationSlug/medical/sales/create',
  medicines: '/organization/$organizationSlug/medical/medicines/create',
  purchases: '/organization/$organizationSlug/medical/purchases/create',
  suppliers: '/organization/$organizationSlug/medical/suppliers/create',
  manufacturers: '/organization/$organizationSlug/medical/manufacturers/create',
  mrs: '/organization/$organizationSlug/medical/mrs/create',
} as const;

/** A Medical create drawer over its own tab (D24): New sale, New medicine, … */
export function organizationMedicalCreate(
  organizationSlug: string,
  tab: keyof typeof MEDICAL_CREATE_PATHS,
) {
  return { to: MEDICAL_CREATE_PATHS[tab], params: { organizationSlug } } as const;
}

/** A sale's read-only drawer over Medical › Sales (`S:51`). */
export function organizationMedicalSale(organizationSlug: string, saleId: string) {
  return {
    to: '/organization/$organizationSlug/medical/sales/$saleId',
    params: { organizationSlug, saleId },
  } as const;
}

/** Return from patient over Medical › Sales (`S:52`). */
export function organizationMedicalSaleReturn(organizationSlug: string, saleId: string) {
  return {
    to: '/organization/$organizationSlug/medical/sales/$saleId/return',
    params: { organizationSlug, saleId },
  } as const;
}

/** Edit medicine over Medical › Medicines (`S:55`). */
export function organizationMedicineEdit(organizationSlug: string, medicineId: string) {
  return {
    to: '/organization/$organizationSlug/medical/medicines/$medicineId/edit',
    params: { organizationSlug, medicineId },
  } as const;
}

/** A purchase order's read-only view over Medical › Purchases (`S:58`). */
export function organizationPurchaseOrder(
  organizationSlug: string,
  purchaseOrderId: string,
) {
  return {
    to: '/organization/$organizationSlug/medical/purchases/$purchaseOrderId',
    params: { organizationSlug, purchaseOrderId },
  } as const;
}

/** Edit purchase order — only while it is Ordered (`S:59`). */
export function organizationPurchaseOrderEdit(
  organizationSlug: string,
  purchaseOrderId: string,
) {
  return {
    to: '/organization/$organizationSlug/medical/purchases/$purchaseOrderId/edit',
    params: { organizationSlug, purchaseOrderId },
  } as const;
}

/** Receive goods over Medical › Purchases (`S:60`). */
export function organizationPurchaseOrderReceive(
  organizationSlug: string,
  purchaseOrderId: string,
) {
  return {
    to: '/organization/$organizationSlug/medical/purchases/$purchaseOrderId/receive',
    params: { organizationSlug, purchaseOrderId },
  } as const;
}

/** Edit supplier over Medical › Suppliers (`S:63`). */
export function organizationSupplierEdit(organizationSlug: string, supplierId: string) {
  return {
    to: '/organization/$organizationSlug/medical/suppliers/$supplierId/edit',
    params: { organizationSlug, supplierId },
  } as const;
}

/** Edit manufacturer over Medical › Manufacturers (`S:66`). */
export function organizationManufacturerEdit(
  organizationSlug: string,
  manufacturerId: string,
) {
  return {
    to: '/organization/$organizationSlug/medical/manufacturers/$manufacturerId/edit',
    params: { organizationSlug, manufacturerId },
  } as const;
}

/** Edit MR over Medical › MRs (`S:69`). */
export function organizationMrEdit(organizationSlug: string, mrId: string) {
  return {
    to: '/organization/$organizationSlug/medical/mrs/$mrId/edit',
    params: { organizationSlug, mrId },
  } as const;
}

/** Log MR visit over Medical › MRs (`S:70`). */
export function organizationMrVisitCreate(organizationSlug: string, mrId: string) {
  return {
    to: '/organization/$organizationSlug/medical/mrs/$mrId/visits/create',
    params: { organizationSlug, mrId },
  } as const;
}
