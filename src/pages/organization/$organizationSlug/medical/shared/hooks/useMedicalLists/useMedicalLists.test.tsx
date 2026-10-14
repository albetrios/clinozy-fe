import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMedicalSales: vi.fn(),
  listPurchaseOrders: vi.fn(),
  listSuppliers: vi.fn(),
  listManufacturers: vi.fn(),
  listMedicalReps: vi.fn(),
  listSupplierCredits: vi.fn(),
  medicalListSummary: vi.fn(),
  fetchAllManufacturers: vi.fn(),
  fetchAllSuppliers: vi.fn(),
  fetchAllMedicalReps: vi.fn(),
}));
vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStoreLedger: vi.fn(),
}));
vi.mock('@/shared/api/app/credits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStoreCredits: vi.fn(),
  fetchStoreCreditCount: vi.fn(),
}));

import { fetchStoreCreditCount, listStoreCredits } from '@/shared/api/app/credits-api.ts';
import { listStoreLedger } from '@/shared/api/app/payments-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  manufacturerRow,
  medicalPage,
  mrRow,
  purchaseOrderRow,
  saleRow,
  supplierCreditRow,
  supplierRow,
} from '@/tests/utils/medical-doubles.ts';
import { creditRow, ledgerRow } from '@/tests/utils/payments-doubles.ts';

import {
  fetchAllManufacturers,
  fetchAllMedicalReps,
  fetchAllSuppliers,
  listManufacturers,
  listMedicalReps,
  listMedicalSales,
  listPurchaseOrders,
  listSupplierCredits,
  listSuppliers,
  medicalListSummary,
} from '../../medical-api.ts';
import {
  useManufacturerCatalogue,
  useManufacturerList,
  useMedicalSummary,
  useMrCatalogue,
  useMrList,
  usePurchaseOrderList,
  useSaleList,
  useStoreCreditCount,
  useStoreCreditList,
  useStoreLedger,
  useSupplierCatalogue,
  useSupplierCreditList,
  useSupplierList,
} from './useMedicalLists.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(listMedicalSales).mockResolvedValue(medicalPage([saleRow()], 'cursor_b'));
  vi.mocked(listPurchaseOrders).mockResolvedValue(medicalPage([purchaseOrderRow()]));
  vi.mocked(listSuppliers).mockResolvedValue(medicalPage([supplierRow()]));
  vi.mocked(listManufacturers).mockResolvedValue(medicalPage([manufacturerRow()]));
  vi.mocked(listMedicalReps).mockResolvedValue(medicalPage([mrRow()]));
  vi.mocked(listSupplierCredits).mockResolvedValue(medicalPage([supplierCreditRow()]));
  vi.mocked(listStoreLedger).mockResolvedValue({
    rows: [ledgerRow()],
    next: null,
    total: 1,
  });
  vi.mocked(listStoreCredits).mockResolvedValue({
    rows: [creditRow()],
    next: null,
    total: 1,
  });
  vi.mocked(medicalListSummary).mockResolvedValue({ total: 1, payable: 827 });
  vi.mocked(fetchStoreCreditCount).mockResolvedValue(3);
  vi.mocked(fetchAllManufacturers).mockResolvedValue([manufacturerRow()]);
  vi.mocked(fetchAllSuppliers).mockResolvedValue([supplierRow()]);
  vi.mocked(fetchAllMedicalReps).mockResolvedValue([mrRow()]);
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('useMedicalLists', () => {
  it('reads each tab’s cursor pages with its params', async () => {
    const { result } = renderHook(
      () => ({
        sales: useSaleList({ status: 'unpaid' }),
        orders: usePurchaseOrderList({ stage: 'received' }),
        suppliers: useSupplierList({ hasPayable: true }),
        makers: useManufacturerList({}),
        mrs: useMrList({}),
        credits: useSupplierCreditList({ status: 'open' }),
        ledger: useStoreLedger({ kind: ['receipt'] }),
        customers: useStoreCreditList({ direction: ['give'] }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.sales.rows).toHaveLength(1));
    await waitFor(() => expect(result.current.customers.rows).toHaveLength(1));
    for (const list of Object.values(result.current)) {
      await waitFor(() => expect(list.rows).toHaveLength(1));
    }
    expect(result.current.sales.hasNextPage).toBe(true);
    expect(listMedicalSales).toHaveBeenCalledWith({ status: 'unpaid' }, undefined);
    expect(listPurchaseOrders).toHaveBeenCalledWith({ stage: 'received' }, undefined);
    expect(listSuppliers).toHaveBeenCalledWith({ hasPayable: true }, undefined);
    expect(listSupplierCredits).toHaveBeenCalledWith({ status: 'open' }, undefined);
    expect(listStoreLedger).toHaveBeenCalledWith({ kind: ['receipt'] }, undefined);
    expect(listStoreCredits).toHaveBeenCalledWith({ direction: ['give'] }, undefined);
  });

  it('reads the footer figures and the whole lists the filters and pickers use', async () => {
    const { result } = renderHook(
      () => ({
        summary: useMedicalSummary('suppliers', {}),
        customerCredits: useStoreCreditCount({ status: ['open'] }),
        makers: useManufacturerCatalogue(),
        suppliers: useSupplierCatalogue(),
        mrs: useMrCatalogue(),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.summary.data).toEqual({ total: 1, payable: 827 }),
    );
    await waitFor(() => expect(result.current.customerCredits.data).toBe(3));
    expect(fetchStoreCreditCount).toHaveBeenCalledWith({ status: ['open'] });
    await waitFor(() => expect(result.current.makers.data).toHaveLength(1));
    await waitFor(() => expect(result.current.suppliers.data).toHaveLength(1));
    await waitFor(() => expect(result.current.mrs.data).toHaveLength(1));
  });

  it('stays idle without an organization', async () => {
    useOrganizationStore.getState().clearOrganization();
    const { result } = renderHook(() => useSaleList({}), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(true));
    expect(listMedicalSales).not.toHaveBeenCalled();
  });
});
