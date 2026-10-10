import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as PackagesApiModule from '@/shared/api/clinic/patient-packages-api.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-contracts.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

/** The patient's packages on the "server": a PATCH changes the row and its `updated_at`. */
const server = vi.hoisted(() => ({ rows: [] as PatientPackageRow[] }));
vi.mock('@/shared/api/clinic/patient-packages-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PackagesApiModule>()),
  listPatientPackages: vi.fn(async () => structuredClone(server.rows)),
  listPatientPurchases: vi.fn(async () =>
    server.rows.map((row) => ({ ...row, isPackage: true })),
  ),
  updatePatientPackage: vi.fn(
    async ({
      packageId,
      change,
    }: Parameters<typeof PackagesApiModule.updatePatientPackage>[0]) => {
      server.rows = server.rows.map((row) =>
        row.id === packageId
          ? { ...row, ...change, updatedAt: '2026-10-11T00:00:00.000Z' }
          : row,
      );
      return structuredClone(server.rows.find((row) => row.id === packageId)!);
    },
  ),
}));

import {
  listPatientPackages,
  listPatientPurchases,
  updatePatientPackage,
} from '@/shared/api/clinic/patient-packages-api.ts';

import {
  usePatientPackages,
  usePatientPurchases,
  useUpdatePatientPackage,
} from './usePatientPackages.ts';

const PATIENT = 'pat_priti000000000000000';
const LHR: PatientPackageRow = {
  id: 'poff_lhr0000000000000000000',
  offeringId: 'off_lhr00000000000000000000',
  name: 'LHR Full Face',
  sessionsTotal: 7,
  sessionsUsed: 1,
  sessionsLeft: 6,
  status: 'active',
  validUntil: '2027-10-10',
  invoiceId: 'invc_one0000000000000000000',
  createdAt: '2026-10-10T01:48:09.406Z',
  updatedAt: '2026-10-10T01:48:09.406Z',
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  signInTestMember();
  server.rows = [LHR];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  vi.resetAllMocks();
});

describe('usePatientPackages', () => {
  it('reads the patient’s packages', async () => {
    const { result } = renderHook(() => usePatientPackages(PATIENT), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([LHR]));
    expect(listPatientPackages).toHaveBeenCalledWith(PATIENT);
  });

  it('stays idle without a patient, an organization or when not enabled', () => {
    const { result } = renderHook(
      () => ({
        none: usePatientPackages(''),
        off: usePatientPackages(PATIENT, { enabled: false }),
        purchases: usePatientPurchases(null),
      }),
      { wrapper },
    );
    expect(result.current.none.fetchStatus).toBe('idle');
    expect(result.current.off.fetchStatus).toBe('idle');
    expect(result.current.purchases.fetchStatus).toBe('idle');
    useOrganizationStore.getState().clearOrganization();
    const { result: orphan } = renderHook(() => usePatientPackages(PATIENT), { wrapper });
    expect(orphan.current.fetchStatus).toBe('idle');
  });
});

describe('usePatientPurchases', () => {
  it('reads the last purchases', async () => {
    const { result } = renderHook(() => usePatientPurchases(PATIENT), { wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(listPatientPurchases).toHaveBeenCalledWith(PATIENT);
  });
});

describe('useUpdatePatientPackage', () => {
  it('saves a change with the package’s `updated_at` and refreshes the packages and purchases', async () => {
    const { result } = renderHook(
      () => ({
        packages: usePatientPackages(PATIENT),
        purchases: usePatientPurchases(PATIENT),
        update: useUpdatePatientPackage(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.packages.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.purchases.isSuccess).toBe(true));
    await act(() =>
      result.current.update.mutateAsync({
        patientId: PATIENT,
        row: LHR,
        change: { sessionsTotal: 8 },
      }),
    );
    expect(updatePatientPackage).toHaveBeenCalledWith({
      patientId: PATIENT,
      packageId: LHR.id,
      change: { sessionsTotal: 8 },
      expectedUpdatedAt: LHR.updatedAt,
      idempotencyKey: expect.any(String),
    });
    await waitFor(() => expect(result.current.packages.data?.[0]?.sessionsTotal).toBe(8));
    await waitFor(() => expect(listPatientPurchases).toHaveBeenCalledTimes(2));
  });
});
