import type { CursorPage } from '@/shared/api/app/app-fixture-store.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import { useCursorList } from '@/shared/hooks/useCursorList/index.ts';

import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
  listManufacturers,
  listMedicalReps,
  listMedicalSales,
  listPurchaseOrders,
  listSaleReminders,
  listSuppliers,
  medicalListSummary,
  medicalQueryKeys,
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
  SupplierListParams,
  SupplierRow,
} from '../../medical-contracts.ts';

/** A cursor page as the shared list hook reads it. */
const asListPage = <T>(page: CursorPage<T>) => ({
  rows: page.items,
  next: page.nextCursor,
  hasMore: page.nextCursor !== null,
});

/*
 * The Medical tabs' list reads — a cursor page of 50 at a time (D7). While new
 * params load the previous rows stay (`isRefreshing`); a failed read raises no
 * toast here: the tab keeps the last copy and offers Retry (KICKOFF §6.0).
 */

/** Medical › Sales (`S:1657`). */
export function useSaleList(params: SaleListParams) {
  return useCursorList<SaleRow>({
    queryKey: medicalQueryKeys.sales(params),
    queryFn: async (after) => asListPage(await listMedicalSales(params, after ?? null)),
    notifyOnError: false,
  });
}

/** "Send payment reminders" (`medical.md:17`): who the unpaid sales the list matches name. */
export function useSaleReminders(params: SaleListParams) {
  return useAppQuery({
    queryKey: medicalQueryKeys.saleReminders(params),
    queryFn: () => listSaleReminders(params),
    notifyOnError: false,
  });
}

/** Medical › Purchases (`S:1661`). */
export function usePurchaseOrderList(params: PurchaseOrderListParams) {
  return useCursorList<PurchaseOrderRow>({
    queryKey: medicalQueryKeys.purchaseOrders(params),
    queryFn: async (after) => asListPage(await listPurchaseOrders(params, after ?? null)),
    notifyOnError: false,
  });
}

/** Medical › Suppliers (`S:1662`). */
export function useSupplierList(params: SupplierListParams) {
  return useCursorList<SupplierRow>({
    queryKey: medicalQueryKeys.suppliers(params),
    queryFn: async (after) => asListPage(await listSuppliers(params, after ?? null)),
    notifyOnError: false,
  });
}

/** Medical › Manufacturers (`S:1662`). */
export function useManufacturerList(params: ManufacturerListParams) {
  return useCursorList<ManufacturerRow>({
    queryKey: medicalQueryKeys.manufacturers(params),
    queryFn: async (after) => asListPage(await listManufacturers(params, after ?? null)),
    notifyOnError: false,
  });
}

/** Medical › MRs (`S:1662`). */
export function useMrList(params: MrListParams) {
  return useCursorList<MrRow>({
    queryKey: medicalQueryKeys.mrs(params),
    queryFn: async (after) => asListPage(await listMedicalReps(params, after ?? null)),
    notifyOnError: false,
  });
}

/** A tab's footer figures — how many rows match, what the suppliers are owed. */
export function useMedicalSummary(
  tab: Parameters<typeof medicalListSummary>[0],
  params: object,
) {
  return useAppQuery({
    queryKey: medicalQueryKeys.summary(tab, params),
    queryFn: () => medicalListSummary(tab, params),
    notifyOnError: false,
  });
}

/*
 * The whole lists the Filters' automatic sections and the pickers read: the
 * makers, suppliers and MRs are few (H:3704–3706), read once each.
 */

/** Every live manufacturer. */
export function useManufacturerCatalogue() {
  return useAppQuery({
    queryKey: medicalQueryKeys.catalogue('manufacturers'),
    queryFn: () => fetchAllManufacturers(),
    notifyOnError: false,
  });
}

/** Every live supplier. */
export function useSupplierCatalogue() {
  return useAppQuery({
    queryKey: medicalQueryKeys.catalogue('suppliers'),
    queryFn: () => fetchAllSuppliers(),
    notifyOnError: false,
  });
}

/** Every live MR. */
export function useMrCatalogue() {
  return useAppQuery({
    queryKey: medicalQueryKeys.catalogue('mrs'),
    queryFn: () => fetchAllMedicalReps(),
    notifyOnError: false,
  });
}
