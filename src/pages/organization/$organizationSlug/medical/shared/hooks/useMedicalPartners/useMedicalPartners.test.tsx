import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';

import {
  useCreateManufacturer,
  useCreateMedicalRep,
  useCreateSupplier,
  useDeleteManufacturer,
  useDeleteMedicalRep,
  useDeleteSupplier,
  useLogMrVisit,
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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The status of a write the fixture server refuses. */
async function refusal(write: () => Promise<unknown>): Promise<number | undefined> {
  try {
    await write();
  } catch (error) {
    return isHttpError(error) ? error.status : undefined;
  }
  return undefined;
}

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('useMedicalPartners — suppliers (S:1675)', () => {
  it('creates, saves, quick-adds and deletes a supplier, and undoes the delete', async () => {
    const { result } = renderHook(useAll, { wrapper });
    let id = '';
    await act(async () => {
      const created = await result.current.createSupplier.mutateAsync({
        name: ' Om Pharma ',
        phone: '+919876543210',
        gstNumber: null,
        manufacturerIds: [ref.manufacturer(1)],
      });
      id = created.id;
      expect(created).toMatchObject({ name: 'Om Pharma', isQuick: false });
    });
    await act(async () => {
      const saved = await result.current.updateSupplier.mutateAsync({
        id,
        patch: { gstNumber: '24AAACO1234A1Z5' },
      });
      expect(saved.gstNumber).toBe('24AAACO1234A1Z5');
    });
    await act(async () => {
      const quick = await result.current.quickSupplier.mutateAsync({
        name: 'Ankit',
        manufacturerIds: [ref.manufacturer(2)],
      });
      expect(quick).toMatchObject({ isQuick: true, phone: null, gstNumber: null });
    });
    await act(async () => {
      await result.current.deleteSupplier.mutateAsync({
        id,
        reason: 'mistake',
        note: null,
      });
    });
    expect(clinicFixtures.suppliers.snapshot((row) => row.id === id)).toHaveLength(0);
    await act(async () => {
      await result.current.restoreSupplier.mutateAsync(id);
    });
    expect(clinicFixtures.suppliers.snapshot((row) => row.id === id)).toHaveLength(1);
  });

  it('refuses a name left empty, an unknown maker, and deleting a supplier with an order to settle', async () => {
    const { result } = renderHook(useAll, { wrapper });
    expect(
      await refusal(() => result.current.quickSupplier.mutateAsync({ name: '  ' })),
    ).toBe(422);
    expect(
      await refusal(() =>
        result.current.createSupplier.mutateAsync({
          name: 'X',
          phone: null,
          gstNumber: null,
          manufacturerIds: ['0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d'],
        }),
      ),
    ).toBe(422);
    expect(
      await refusal(() =>
        result.current.deleteSupplier.mutateAsync({
          id: ref.supplier(58),
          reason: 'mistake',
          note: null,
        }),
      ),
    ).toBe(409);
  });

  it('reads a supplier’s Account: its orders, latest first, with what is owed', async () => {
    const { result } = renderHook(() => useSupplierAccount(ref.supplier(58)), {
      wrapper,
    });
    await waitFor(() => expect(result.current.data?.length).toBeGreaterThan(0));
    const rows = result.current.data ?? [];
    expect(rows.every((row) => row.kind === 'order')).toBe(true);
    expect(rows.some((row) => row.kind === 'order' && row.due > 0)).toBe(true);
    const dates = rows.map((row) => row.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});

describe('useMedicalPartners — manufacturers', () => {
  it('writes a maker’s connections on the suppliers and MRs, and moves them on a save', async () => {
    const { result } = renderHook(useAll, { wrapper });
    let id = '';
    await act(async () => {
      const maker = await result.current.createMaker.mutateAsync({
        name: 'acme',
        tone: 'sky',
        supplierIds: [ref.supplier(61)],
        mrIds: [ref.medicalRep(1)],
      });
      id = maker.id;
      expect(maker.name).toBe('ACME');
    });
    expect(
      (await clinicFixtures.suppliers.get(ref.supplier(61))).manufacturerIds,
    ).toContain(id);
    expect(
      (await clinicFixtures.medicalReps.get(ref.medicalRep(1))).manufacturerIds,
    ).toContain(id);

    await act(async () => {
      await result.current.updateMaker.mutateAsync({
        id,
        patch: { name: 'ACME', tone: 'sky', supplierIds: [ref.supplier(52)], mrIds: [] },
      });
    });
    expect(
      (await clinicFixtures.suppliers.get(ref.supplier(61))).manufacturerIds,
    ).not.toContain(id);
    expect(
      (await clinicFixtures.suppliers.get(ref.supplier(52))).manufacturerIds,
    ).toContain(id);
    expect(
      (await clinicFixtures.medicalReps.get(ref.medicalRep(1))).manufacturerIds,
    ).not.toContain(id);
  });

  it('quick-adds a maker in the next colour, refuses deleting one a medicine names, and restores', async () => {
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      const quick = await result.current.quickMaker.mutateAsync('zen');
      expect(quick).toMatchObject({ name: 'ZEN', isQuick: true });
      await result.current.deleteMaker.mutateAsync({
        id: quick.id,
        reason: 'mistake',
        note: null,
      });
      await result.current.restoreMaker.mutateAsync(quick.id);
    });
    expect(
      await refusal(() =>
        result.current.deleteMaker.mutateAsync({
          id: ref.manufacturer(1),
          reason: 'mistake',
          note: null,
        }),
      ),
    ).toBe(409);
  });
});

describe('useMedicalPartners — MRs and visits (S:1676)', () => {
  it('creates, saves, quick-adds, deletes and restores an MR', async () => {
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      const rep = await result.current.createMr.mutateAsync({
        name: 'Meet',
        phone: null,
        nextVisitOn: null,
        manufacturerIds: [ref.manufacturer(2)],
      });
      const saved = await result.current.updateMr.mutateAsync({
        id: rep.id,
        patch: { phone: '+919876543210' },
      });
      expect(saved.phone).toBe('+919876543210');
      const quick = await result.current.quickMr.mutateAsync('Ravi');
      expect(quick).toMatchObject({ name: 'Ravi', manufacturerIds: [] });
      await result.current.deleteMr.mutateAsync({
        id: rep.id,
        reason: 'duplicate',
        note: null,
      });
      await result.current.restoreMr.mutateAsync(rep.id);
    });
  });

  it('logs a visit and sets the MR’s next one', async () => {
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      const visit = await result.current.logVisit.mutateAsync({
        mrId: ref.medicalRep(2),
        date: '2026-10-04',
        nextVisitOn: '2026-10-18',
        samples: '4 tubes Azelan',
        notes: null,
      });
      expect(visit).toMatchObject({ mrId: ref.medicalRep(2), samples: '4 tubes Azelan' });
    });
    expect((await clinicFixtures.medicalReps.get(ref.medicalRep(2))).nextVisitOn).toBe(
      '2026-10-18',
    );
  });
});
