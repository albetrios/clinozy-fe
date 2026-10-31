import {
  creditQueryKeys,
  fetchStoreCreditCount,
  listStoreCredits,
} from '@/shared/api/app/credits-api.ts';
import type { CreditListParams, CreditRow } from '@/shared/api/app/credits-contracts.ts';
import { listStoreLedger, paymentQueryKeys } from '@/shared/api/app/payments-api.ts';
import type { LedgerListParams, LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
  fetchPurchaseGstSummary,
  listManufacturers,
  listMedicalReps,
  listMedicalSales,
  listPurchaseOrders,
  listSaleReminders,
  listSupplierCredits,
  listSuppliers,
  medicalListSummary,
  type MedicalPage,
  medicalQueryKeys,
  type MedicalSummaryTab,
} from '../../medical-api.ts';
import type {
  ManufacturerListParams,
  ManufacturerRow,
  MrListParams,
  MrRow,
  PurchaseOrderListParams,
  PurchaseOrderRow,
  SaleListParams,
  SaleRow,
  SupplierCreditListParams,
  SupplierCreditRow,
  SupplierListParams,
  SupplierRow,
} from '../../medical-contracts.ts';

/*
 * The Medical tabs' reads on clinozy-be — a cursor page of 50 at a time, each key under the active
 * organization, idle until there is one. While new params load the previous rows stay
 * (`isRefreshing`); a failed read raises no toast here: the tab keeps the last copy and offers
 * Retry (KICKOFF §6.0).
 */

/** A page as the shared list hook reads it. */
const asListPage = <T>(page: MedicalPage<T>) => ({
  rows: page.rows,
  next: page.next,
  hasMore: page.next !== null,
});

/** Medical › Sales (`GET /app/medical-sales`). */
export function useSaleList(params: SaleListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<SaleRow>({
    queryKey: medicalQueryKeys.sales(organizationId, params),
    queryFn: async (after) => asListPage(await listMedicalSales(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** "Send payment reminders" (`GET /app/medical-sales/dues`): who owes on the sales the list matches. */
export function useSaleReminders(params: SaleListParams) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicalQueryKeys.saleReminders(organizationId, params),
    queryFn: () => listSaleReminders(params),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** A month's purchase GST summary (`GET /app/medical-purchase-orders/gst-summary`). */
export function usePurchaseGstSummary(month: string) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicalQueryKeys.purchaseGstSummary(organizationId, month),
    queryFn: () => fetchPurchaseGstSummary(month),
    notifyOnError: false,
    enabled: organizationId !== null && month !== '',
  });
}

/** Medical › Purchases (`GET /app/medical-purchase-orders`). */
export function usePurchaseOrderList(params: PurchaseOrderListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<PurchaseOrderRow>({
    queryKey: medicalQueryKeys.purchaseOrders(organizationId, params),
    queryFn: async (after) => asListPage(await listPurchaseOrders(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Medical › Suppliers (`GET /app/suppliers`). */
export function useSupplierList(params: SupplierListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<SupplierRow>({
    queryKey: medicalQueryKeys.suppliers(organizationId, params),
    queryFn: async (after) => asListPage(await listSuppliers(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Medical › Manufacturers (`GET /app/manufacturers`). */
export function useManufacturerList(params: ManufacturerListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<ManufacturerRow>({
    queryKey: medicalQueryKeys.manufacturers(organizationId, params),
    queryFn: async (after) => asListPage(await listManufacturers(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Medical › MRs (`GET /app/medical-reps`). */
export function useMrList(params: MrListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<MrRow>({
    queryKey: medicalQueryKeys.mrs(organizationId, params),
    queryFn: async (after) => asListPage(await listMedicalReps(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Medical › Credits, from suppliers (`GET /app/supplier-credits`, or one supplier's). */
export function useSupplierCreditList(params: SupplierCreditListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<SupplierCreditRow>({
    queryKey: medicalQueryKeys.supplierCredits(organizationId, params),
    queryFn: async (after) => asListPage(await listSupplierCredits(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Medical › Payments — the store's slice of the ledger (`GET /app/medical-payments`, MD31). */
export function useStoreLedger(params: LedgerListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<LedgerRow>({
    queryKey: paymentQueryKeys.store(organizationId, params),
    queryFn: async (after) => asListPage(await listStoreLedger(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Medical › Credits, with customers (`GET /app/medical-pending-credits`, MD32, D90). */
export function useStoreCreditList(params: CreditListParams) {
  const organizationId = useOrganizationId();
  return useCursorList<CreditRow>({
    queryKey: creditQueryKeys.store(organizationId, params),
    queryFn: async (after) => asListPage(await listStoreCredits(params, after)),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Medical › Credits' footer, with customers: how many of the store's credits match (D90). */
export function useStoreCreditCount(params: CreditListParams) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: creditQueryKeys.storeCount(organizationId, params),
    queryFn: () => fetchStoreCreditCount(params),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** A tab's footer figures — how many rows match, what the suppliers are owed. */
export function useMedicalSummary(tab: MedicalSummaryTab, params: object) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicalQueryKeys.summary(organizationId, tab, params),
    queryFn: () => medicalListSummary(tab, params),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/*
 * The whole lists the Filters' sections and the pickers read: the makers, suppliers and MRs are
 * few (H:3704–3706), read once each.
 */

/** Every live manufacturer. */
export function useManufacturerCatalogue() {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicalQueryKeys.catalogue(organizationId, 'manufacturers'),
    queryFn: () => fetchAllManufacturers(),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Every live supplier. */
export function useSupplierCatalogue() {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicalQueryKeys.catalogue(organizationId, 'suppliers'),
    queryFn: () => fetchAllSuppliers(),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}

/** Every live MR. */
export function useMrCatalogue() {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: medicalQueryKeys.catalogue(organizationId, 'mrs'),
    queryFn: () => fetchAllMedicalReps(),
    notifyOnError: false,
    enabled: organizationId !== null,
  });
}
