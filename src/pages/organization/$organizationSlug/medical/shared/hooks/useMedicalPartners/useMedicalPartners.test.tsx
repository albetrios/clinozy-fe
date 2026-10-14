import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchSupplierAccount: vi.fn(),
  fetchMrVisits: vi.fn(),
}));
vi.mock('../../medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  quickCreateSupplier: vi.fn(),
  deleteSupplier: vi.fn(),
  restoreSupplier: vi.fn(),
  createManufacturer: vi.fn(),
  updateManufacturer: vi.fn(),
  quickCreateManufacturer: vi.fn(),
  deleteManufacturer: vi.fn(),
  restoreManufacturer: vi.fn(),
  createMedicalRep: vi.fn(),
  updateMedicalRep: vi.fn(),
  quickCreateMedicalRep: vi.fn(),
  deleteMedicalRep: vi.fn(),
  restoreMedicalRep: vi.fn(),
  logMrVisit: vi.fn(),
}));
import { medicineQueryKeys } from '@/shared/api/app/medicines-api.ts';
import { HttpError, isHttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  manufacturerRow,
  mrRow,
  mrVisitRow,
  supplierRow,
  TEST_MAKER_ID,
  TEST_MR_ID,
  TEST_PURCHASE_ORDER_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';

import {
  fetchMrVisits,
  fetchSupplierAccount,
  medicalQueryKeys,
} from '../../medical-api.ts';
import type { SupplierAccountRow } from '../../medical-contracts.ts';
import {
  createManufacturer,
  createMedicalRep,
  createSupplier,
  deleteManufacturer,
  deleteMedicalRep,
  deleteSupplier,
  logMrVisit,
  quickCreateManufacturer,
  quickCreateMedicalRep,
  quickCreateSupplier,
  restoreManufacturer,
  restoreMedicalRep,
  restoreSupplier,
  updateManufacturer,
  updateMedicalRep,
  updateSupplier,
} from '../../medical-records-api.ts';
import {
  useCreateManufacturer,
  useCreateMedicalRep,
  useCreateSupplier,
  useDeleteManufacturer,
  useDeleteMedicalRep,
  useDeleteSupplier,
  useLogMrVisit,
  useMrVisits,
  useQuickCreateManufacturer,
  useQuickCreateMedicalRep,
  useQuickCreateSupplier,
  useRestoreManufacturer,
  useRestoreMedicalRep,
  useRestoreSupplier,
  useSupplierAccount,
  useUpdateManufacturer,
  useUpdateMedicalRep,
  useUpdateSupplier,
} from './useMedicalPartners.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

/** Every hook under test, on one query client. */
function useAll() {
  const quiet = { notifyOnError: false } as const;
  return {
    createSupplier: useCreateSupplier(quiet),
    updateSupplier: useUpdateSupplier(quiet),
    quickSupplier: useQuickCreateSupplier(quiet),
    deleteSupplier: useDeleteSupplier(quiet),
    restoreSupplier: useRestoreSupplier(quiet),
    createMaker: useCreateManufacturer(quiet),
    updateMaker: useUpdateManufacturer(quiet),
    quickMaker: useQuickCreateManufacturer(quiet),
    deleteMaker: useDeleteManufacturer(quiet),
    restoreMaker: useRestoreManufacturer(quiet),
    createMr: useCreateMedicalRep(quiet),
    updateMr: useUpdateMedicalRep(quiet),
    quickMr: useQuickCreateMedicalRep(quiet),
    deleteMr: useDeleteMedicalRep(quiet),
    restoreMr: useRestoreMedicalRep(quiet),
    logVisit: useLogMrVisit(quiet),
  };
}

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** An action's key, as every write is handed one. */
const action = { idempotencyKey: expect.any(String) };

/** The status of a write the server refuses. */
async function refusal(write: () => Promise<unknown>): Promise<number | undefined> {
  try {
    await write();
  } catch (error) {
    return isHttpError(error) ? error.status : undefined;
  }
  return undefined;
}

/** A refusal as clinozy-be sends it. */
const refused = (status: number, reason: string) =>
  new HttpError(reason, status, '/app/suppliers', 'DELETE', {
    error: { type: 'request_error', code: 'conflict', reason },
  });

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('useMedicalPartners — suppliers (S:1675)', () => {
  it('creates, saves, quick-adds and deletes a supplier, and undoes the delete — each with its key', async () => {
    const supplier = supplierRow();
    const input = {
      name: 'Ankur Pharma',
      phone: '+919876500011',
      gstNumber: null,
      manufacturerIds: [TEST_MAKER_ID],
    };
    vi.mocked(createSupplier).mockResolvedValue(supplier);
    vi.mocked(updateSupplier).mockResolvedValue(supplier);
    vi.mocked(quickCreateSupplier).mockResolvedValue(supplierRow({ isQuick: true }));
    vi.mocked(deleteSupplier).mockResolvedValue(undefined);
    vi.mocked(restoreSupplier).mockResolvedValue(supplier);
    const { result } = renderHook(useAll, { wrapper });

    await act(async () => {
      await result.current.createSupplier.mutateAsync(input);
      await result.current.updateSupplier.mutateAsync({ record: supplier, input });
      await result.current.quickSupplier.mutateAsync({
        name: 'Om Pharma',
        manufacturerIds: [TEST_MAKER_ID],
      });
      await result.current.deleteSupplier.mutateAsync({
        id: TEST_SUPPLIER_ID,
        reason: 'mistake',
        note: null,
      });
      await result.current.restoreSupplier.mutateAsync(TEST_SUPPLIER_ID);
    });
    expect(createSupplier).toHaveBeenCalledWith({ input, ...action });
    expect(updateSupplier).toHaveBeenCalledWith({ record: supplier, input, ...action });
    expect(quickCreateSupplier).toHaveBeenCalledWith({
      name: 'Om Pharma',
      manufacturerIds: [TEST_MAKER_ID],
      ...action,
    });
    expect(deleteSupplier).toHaveBeenCalledWith(TEST_SUPPLIER_ID, 'mistake', null);
    expect(restoreSupplier).toHaveBeenCalledWith(TEST_SUPPLIER_ID, expect.any(String));
  });

  it('passes the server’s refusals through — a supplier with dues, a stale save', async () => {
    vi.mocked(deleteSupplier).mockRejectedValue(refused(409, 'supplier_has_dues'));
    vi.mocked(updateSupplier).mockRejectedValue(refused(409, 'record_changed'));
    const { result } = renderHook(useAll, { wrapper });
    expect(
      await refusal(() =>
        result.current.deleteSupplier.mutateAsync({
          id: TEST_SUPPLIER_ID,
          reason: 'mistake',
          note: null,
        }),
      ),
    ).toBe(409);
    expect(
      await refusal(() =>
        result.current.updateSupplier.mutateAsync({
          record: supplierRow(),
          input: { name: 'X', phone: null, gstNumber: null, manufacturerIds: [] },
        }),
      ),
    ).toBe(409);
  });

  it('a write refreshes the room and the medicines, under the organization', async () => {
    vi.mocked(createSupplier).mockResolvedValue(supplierRow());
    const suppliers = medicalQueryKeys.suppliers('org_test', {});
    const medicines = medicineQueryKeys.all;
    client.setQueryData(suppliers, []);
    client.setQueryData([...medicines, 'org_test', 'list'], []);
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      await result.current.createSupplier.mutateAsync({
        name: 'Om Pharma',
        phone: null,
        gstNumber: null,
        manufacturerIds: [],
      });
    });
    expect(client.getQueryState(suppliers)?.isInvalidated).toBe(true);
    expect(client.getQueryState([...medicines, 'org_test', 'list'])?.isInvalidated).toBe(
      true,
    );
  });

  it('reads a supplier’s Account under the organization, idle without an id', async () => {
    const rows: SupplierAccountRow[] = [
      {
        kind: 'order',
        id: TEST_PURCHASE_ORDER_ID,
        seq: 431,
        billNo: 'T-82370',
        date: '2026-10-05',
        stage: 'received',
        amount: 4236,
        due: 827,
      },
    ];
    vi.mocked(fetchSupplierAccount).mockResolvedValue(rows);
    const idle = renderHook(() => useSupplierAccount(null), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    expect(fetchSupplierAccount).not.toHaveBeenCalled();

    const { result } = renderHook(() => useSupplierAccount(TEST_SUPPLIER_ID), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data).toEqual(rows));
    expect(fetchSupplierAccount).toHaveBeenCalledWith(TEST_SUPPLIER_ID);
    expect(
      client.getQueryData(medicalQueryKeys.supplierAccount('org_test', TEST_SUPPLIER_ID)),
    ).toEqual(rows);
  });
});

describe('useMedicalPartners — manufacturers', () => {
  it('writes a maker with its connections, quick-adds one, deletes and restores', async () => {
    const maker = manufacturerRow();
    const input = {
      name: 'SUN PHARMA',
      tone: 'sky' as const,
      supplierIds: [TEST_SUPPLIER_ID],
      mrIds: [TEST_MR_ID],
    };
    vi.mocked(createManufacturer).mockResolvedValue(maker);
    vi.mocked(updateManufacturer).mockResolvedValue(maker);
    vi.mocked(quickCreateManufacturer).mockResolvedValue(
      manufacturerRow({ name: 'ZEN', isQuick: true }),
    );
    vi.mocked(deleteManufacturer).mockResolvedValue(undefined);
    vi.mocked(restoreManufacturer).mockResolvedValue(maker);
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      await result.current.createMaker.mutateAsync(input);
      await result.current.updateMaker.mutateAsync({ record: maker, input });
      await result.current.quickMaker.mutateAsync('zen');
      await result.current.deleteMaker.mutateAsync({
        id: TEST_MAKER_ID,
        reason: 'duplicate',
        note: null,
      });
      await result.current.restoreMaker.mutateAsync(TEST_MAKER_ID);
    });
    expect(createManufacturer).toHaveBeenCalledWith({ input, ...action });
    expect(updateManufacturer).toHaveBeenCalledWith({ record: maker, input, ...action });
    expect(quickCreateManufacturer).toHaveBeenCalledWith({ name: 'zen', ...action });
    expect(deleteManufacturer).toHaveBeenCalledWith(TEST_MAKER_ID, 'duplicate', null);
    expect(restoreManufacturer).toHaveBeenCalledWith(TEST_MAKER_ID, expect.any(String));
  });

  it('passes a refusal to delete a maker a medicine names through', async () => {
    vi.mocked(deleteManufacturer).mockRejectedValue(refused(409, 'manufacturer_in_use'));
    const { result } = renderHook(useAll, { wrapper });
    expect(
      await refusal(() =>
        result.current.deleteMaker.mutateAsync({
          id: TEST_MAKER_ID,
          reason: 'mistake',
          note: null,
        }),
      ),
    ).toBe(409);
  });
});

describe('useMedicalPartners — MRs and visits (S:1676)', () => {
  it('creates, saves, quick-adds, deletes and restores an MR', async () => {
    const rep = mrRow();
    const input = {
      name: 'Rahul Mehta',
      phone: null,
      nextVisitOn: null,
      manufacturerIds: [TEST_MAKER_ID],
    };
    vi.mocked(createMedicalRep).mockResolvedValue(rep);
    vi.mocked(updateMedicalRep).mockResolvedValue(rep);
    vi.mocked(quickCreateMedicalRep).mockResolvedValue(mrRow({ name: 'Ravi' }));
    vi.mocked(deleteMedicalRep).mockResolvedValue(undefined);
    vi.mocked(restoreMedicalRep).mockResolvedValue(rep);
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      await result.current.createMr.mutateAsync(input);
      await result.current.updateMr.mutateAsync({ record: rep, input });
      await result.current.quickMr.mutateAsync('Ravi');
      await result.current.deleteMr.mutateAsync({
        id: TEST_MR_ID,
        reason: 'duplicate',
        note: null,
      });
      await result.current.restoreMr.mutateAsync(TEST_MR_ID);
    });
    expect(createMedicalRep).toHaveBeenCalledWith({ input, ...action });
    expect(updateMedicalRep).toHaveBeenCalledWith({ record: rep, input, ...action });
    expect(quickCreateMedicalRep).toHaveBeenCalledWith({ name: 'Ravi', ...action });
    expect(deleteMedicalRep).toHaveBeenCalledWith(TEST_MR_ID, 'duplicate', null);
    expect(restoreMedicalRep).toHaveBeenCalledWith(TEST_MR_ID, expect.any(String));
  });

  it('logs a visit — the visit write sets the MR’s next one — and reads the visits', async () => {
    const input = {
      mrId: TEST_MR_ID,
      date: '2026-10-04',
      nextVisitOn: '2026-10-18',
      samples: '4 tubes Azelan',
      notes: null,
    };
    vi.mocked(logMrVisit).mockResolvedValue(mrVisitRow({ samples: '4 tubes Azelan' }));
    vi.mocked(fetchMrVisits).mockResolvedValue([mrVisitRow()]);
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      const visit = await result.current.logVisit.mutateAsync(input);
      expect(visit).toMatchObject({ mrId: TEST_MR_ID, samples: '4 tubes Azelan' });
    });
    expect(logMrVisit).toHaveBeenCalledWith({ input, ...action });

    const idle = renderHook(() => useMrVisits(null), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    const visits = renderHook(() => useMrVisits(TEST_MR_ID), { wrapper });
    await waitFor(() => expect(visits.result.current.data).toHaveLength(1));
    expect(fetchMrVisits).toHaveBeenCalledWith(TEST_MR_ID);
  });
});
