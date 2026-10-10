import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type { PrescriptionItem } from '@/shared/api/clinic/clinic-schema.ts';
import type * as PrescriptionsApiModule from '@/shared/api/clinic/prescriptions-api.ts';
import {
  approvePrescription,
  createPrescription,
  deletePrescription,
  fetchRxSheetClinic,
  listPatientPrescriptions,
  listPrescriptionKits,
  listRxMedicines,
  prescriptionQueryKeys,
  restorePrescription,
  updatePrescription,
} from '@/shared/api/clinic/prescriptions-api.ts';
import type {
  PrescriptionFields,
  PrescriptionRecord,
} from '@/shared/api/clinic/prescriptions-contracts.ts';
import { todayQueryKeys } from '@/shared/api/clinic/today-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { previewPreset } from '@/tests/utils/clinic-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import {
  useCreatePrescription,
  useDeletePrescription,
  useLoadRxSheetClinic,
  usePatientPrescriptions,
  usePrescriptionAccess,
  usePrescriptionKits,
  useRestorePrescription,
  useRxCatalog,
  useRxSheetClinic,
  useUpdatePrescription,
} from './usePrescriptions.ts';

vi.mock('@/shared/api/clinic/prescriptions-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof PrescriptionsApiModule>()),
  listPatientPrescriptions: vi.fn(),
  createPrescription: vi.fn(),
  updatePrescription: vi.fn(),
  approvePrescription: vi.fn(),
  deletePrescription: vi.fn(),
  restorePrescription: vi.fn(),
  listPrescriptionKits: vi.fn(),
  listRxMedicines: vi.fn(),
  fetchRxSheetClinic: vi.fn(),
}));

const PATIENT_ID = 'pat_priya0000000000000000';
const ORG = 'org_test';

const line = (medicineName: string): PrescriptionItem => ({
  medicineId: null,
  medicineName,
  doseMorning: 0,
  doseAfternoon: 0,
  doseNight: 1,
  sos: false,
  meal: 'after',
  timing: null,
  timingText: null,
  bodyPart: null,
  bodyPartText: null,
  qty: 8,
  remarks: null,
});

const DRAFT: PrescriptionRecord = {
  id: 'rx_rx50000000000000000000',
  seq: 500,
  patientId: PATIENT_ID,
  appointmentId: null,
  doctorId: 'mem_nisha0000000000000000',
  date: '2026-10-01',
  items: [line('Flubolt 400')],
  advice: null,
  labReport: null,
  procedureToday: null,
  followUpDate: null,
  status: 'draft',
  approvedAt: null,
  approvedById: null,
  createdAt: '2026-10-01T05:00:00.000Z',
  updatedAt: '2026-10-01T05:00:00.000Z',
};
const APPROVED: PrescriptionRecord = {
  ...DRAFT,
  status: 'approved',
  approvedAt: '2026-10-01T06:00:00.000Z',
};

const FIELDS: PrescriptionFields = {
  doctorId: DRAFT.doctorId,
  date: '2026-10-03',
  items: [line('Flubolt 400')],
  advice: null,
  labReport: null,
  procedureToday: null,
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The member's own codes (no View-as). */
function holding(...codes: OrganizationPermission[]) {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().setPermissions(['organization:read', ...codes]);
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  signInTestMember();
  holding();
  vi.mocked(listPatientPrescriptions).mockReset().mockResolvedValue([DRAFT]);
  vi.mocked(createPrescription).mockReset().mockResolvedValue(DRAFT);
  vi.mocked(updatePrescription).mockReset().mockResolvedValue(DRAFT);
  vi.mocked(approvePrescription).mockReset().mockResolvedValue(APPROVED);
  vi.mocked(deletePrescription).mockReset().mockResolvedValue();
  vi.mocked(restorePrescription).mockReset().mockResolvedValue(DRAFT);
  vi.mocked(listPrescriptionKits).mockReset().mockResolvedValue([]);
  vi.mocked(listRxMedicines).mockReset().mockResolvedValue([]);
  vi.mocked(fetchRxSheetClinic)
    .mockReset()
    .mockResolvedValue({
      organization: { name: 'Cresence', specialties: ['skin'] },
      branch: { phone: '', gstNumber: null },
    });
});
afterEach(() => {
  client.clear();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
});

describe('usePrescriptionAccess', () => {
  it('answers from the member’s own codes', async () => {
    holding('patient_prescription:create', 'medicine:read');
    const { result } = renderHook(() => usePrescriptionAccess(), { wrapper });
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current).toEqual({
      resolved: true,
      writes: true,
      approves: false,
      deletes: false,
      readsMedicines: true,
      readsBranch: false,
    });
    act(() =>
      holding(
        'patient_prescription:create',
        'patient_prescription:update',
        'patient_prescription:delete',
        'branch:read',
      ),
    );
    await waitFor(() => expect(result.current.approves).toBe(true));
    expect(result.current).toMatchObject({ deletes: true, readsBranch: true });
  });

  it('previews a role by its own codes during View-as', async () => {
    previewPreset(client, 'doctor');
    const { result } = renderHook(() => usePrescriptionAccess(), { wrapper });
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current).toMatchObject({
      writes: true,
      approves: true,
      readsMedicines: true,
      readsBranch: false,
    });
    act(() => previewPreset(client, 'front_desk'));
    await waitFor(() => expect(result.current.writes).toBe(false));
    expect(result.current).toMatchObject({ approves: false, deletes: false });
  });
});

describe('reads', () => {
  it('reads a patient’s prescriptions under the organization; idle without one', async () => {
    const { result } = renderHook(() => usePatientPrescriptions(PATIENT_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([DRAFT]));
    expect(listPatientPrescriptions).toHaveBeenCalledWith(PATIENT_ID);
    expect(client.getQueryData(prescriptionQueryKeys.list(ORG, PATIENT_ID))).toEqual([
      DRAFT,
    ]);
    renderHook(() => usePatientPrescriptions(''), { wrapper });
    renderHook(() => usePatientPrescriptions(PATIENT_ID, { enabled: false }), {
      wrapper,
    });
    expect(listPatientPrescriptions).toHaveBeenCalledTimes(1);
  });

  it('reads the member’s kits when asked', async () => {
    renderHook(() => usePrescriptionKits({ enabled: false }), { wrapper });
    expect(listPrescriptionKits).not.toHaveBeenCalled();
    const { result } = renderHook(() => usePrescriptionKits(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('composes the drawer’s medicines: the store only with medicine:read', async () => {
    vi.mocked(listRxMedicines).mockResolvedValue([
      { id: 'med_tranexa', name: 'Tranexa 500', composition: null, stock: 3 },
    ]);
    const { result, rerender } = renderHook(() => useRxCatalog(PATIENT_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(listRxMedicines).not.toHaveBeenCalled();
    expect(result.current.data?.medicines.map((medicine) => medicine.name)).toEqual([
      'Flubolt 400',
    ]);

    act(() => holding('medicine:read'));
    rerender();
    await waitFor(() =>
      expect(result.current.data?.medicines.map((medicine) => medicine.name)).toEqual([
        'Flubolt 400',
        'Tranexa 500',
      ]),
    );
    expect(result.current.data?.medicines[0]?.last).toEqual(line('Flubolt 400'));
  });

  it('reads the sheet’s clinic with the branch per branch:read, and loads it for a print', async () => {
    holding('branch:read');
    const { result } = renderHook(() => useRxSheetClinic('brn_main'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchRxSheetClinic).toHaveBeenCalledWith({
      branchId: 'brn_main',
      readsBranch: true,
    });
    const load = renderHook(() => useLoadRxSheetClinic(), { wrapper });
    await expect(load.result.current('brn_main')).resolves.toMatchObject({
      organization: { name: 'Cresence' },
    });
    // The copy the hook keeps serves the print.
    expect(fetchRxSheetClinic).toHaveBeenCalledTimes(1);
  });
});

describe('writes', () => {
  it('writes a draft, or approves it on the write’s key + ":approve" (Q19)', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreatePrescription(), { wrapper });
    let saved: PrescriptionRecord | undefined;
    await act(async () => {
      saved = await result.current.mutateAsync({ patientId: PATIENT_ID, fields: FIELDS });
    });
    expect(saved).toEqual(DRAFT);
    expect(approvePrescription).not.toHaveBeenCalled();
    const [{ idempotencyKey: key }] = vi.mocked(createPrescription).mock.calls[0] ?? [
      { idempotencyKey: '' },
    ];
    expect(createPrescription).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      fields: FIELDS,
      appointmentId: undefined,
      idempotencyKey: key,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: prescriptionQueryKeys.lists(ORG),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: todayQueryKeys.floors() });

    await act(async () => {
      saved = await result.current.mutateAsync({
        patientId: PATIENT_ID,
        fields: FIELDS,
        appointmentId: 'appt_sana0000000000000000',
        approve: true,
      });
    });
    expect(saved).toEqual(APPROVED);
    const create = vi.mocked(createPrescription).mock.lastCall?.[0];
    expect(create?.appointmentId).toBe('appt_sana0000000000000000');
    expect(approvePrescription).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      prescriptionId: DRAFT.id,
      idempotencyKey: `${create?.idempotencyKey}:approve`,
    });
  });

  it('keeps the draft in the list when its approval fails', async () => {
    vi.mocked(approvePrescription).mockRejectedValueOnce(
      new HttpError('Bad request', 400, '/approve', 'POST'),
    );
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreatePrescription({ notifyOnError: false }), {
      wrapper,
    });
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          patientId: PATIENT_ID,
          fields: FIELDS,
          approve: true,
        }),
      ).rejects.toBeInstanceOf(HttpError);
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: prescriptionQueryKeys.lists(ORG),
    });
  });

  it('saves a draft with its updated_at, then approves it', async () => {
    const { result } = renderHook(() => useUpdatePrescription(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        prescription: DRAFT,
        fields: FIELDS,
        approve: true,
      });
    });
    const save = vi.mocked(updatePrescription).mock.lastCall?.[0];
    expect(save).toMatchObject({
      patientId: PATIENT_ID,
      prescriptionId: DRAFT.id,
      fields: FIELDS,
      expectedUpdatedAt: DRAFT.updatedAt,
    });
    expect(approvePrescription).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `${save?.idempotencyKey}:approve` }),
    );
  });

  it('deletes with the reason — refreshing the lists, not the record’s own read — and restores', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const remove = renderHook(() => useDeletePrescription(), { wrapper });
    await act(async () => {
      await remove.result.current.mutateAsync({
        prescription: DRAFT,
        reason: 'not_needed',
        note: null,
      });
    });
    expect(deletePrescription).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      prescriptionId: DRAFT.id,
      reason: 'not_needed',
      note: null,
    });
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: prescriptionQueryKeys.details(ORG),
    });

    const restore = renderHook(() => useRestorePrescription(), { wrapper });
    await act(async () => {
      await restore.result.current.mutateAsync(DRAFT);
    });
    expect(restorePrescription).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      prescriptionId: DRAFT.id,
      idempotencyKey: expect.any(String),
    });
  });
});
