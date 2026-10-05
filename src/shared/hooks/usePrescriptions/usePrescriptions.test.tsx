import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { staffRef } from '@/shared/api/clinic/fixtures/staff.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { PrescriptionInput } from '@/shared/api/clinic/prescriptions-api.ts';

import {
  useCreatePrescription,
  useDeletePrescription,
  usePatientPrescriptions,
  usePrescription,
  useRestorePrescription,
  useRxCatalog,
  useRxSheetContext,
  useUpdatePrescription,
} from './usePrescriptions.ts';

const DHARTI = patientRef('Dharti Galani');
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const INPUT: PrescriptionInput = {
  patientId: DHARTI,
  appointmentId: null,
  doctorId: staffRef('DD'),
  date: '2026-10-03',
  items: [
    {
      medicineId: null,
      medicineName: 'Epriva Tab',
      doseMorning: 1,
      doseAfternoon: 0,
      doseNight: 1,
      sos: false,
      meal: 'after',
      timing: null,
      timingText: null,
      bodyPart: null,
      bodyPartText: null,
      qty: 20,
      remarks: '10 days',
    },
  ],
  advice: null,
  labReport: null,
  procedureToday: null,
  followUpDate: null,
};

function useRxProbe() {
  return {
    list: usePatientPrescriptions(DHARTI),
    create: useCreatePrescription(),
    update: useUpdatePrescription(),
    remove: useDeletePrescription(),
    restore: useRestorePrescription(),
  };
}

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('usePrescriptions', () => {
  it('reads the patient’s prescriptions and refreshes them after each write', async () => {
    const { result } = renderHook(useRxProbe, { wrapper });
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    const saved = await act(() => result.current.create.mutateAsync(INPUT));
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));

    await act(() =>
      result.current.update.mutateAsync({
        id: saved.id,
        input: { ...INPUT, advice: 'Avoid scrubs' },
      }),
    );
    await waitFor(() =>
      expect(result.current.list.data?.find((rx) => rx.id === saved.id)?.advice).toBe(
        'Avoid scrubs',
      ),
    );

    await act(() =>
      result.current.remove.mutateAsync({ id: saved.id, reason: 'mistake', note: null }),
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    await act(() => result.current.restore.mutateAsync(saved.id));
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
  });

  it('reads one prescription, the drawer’s medicines and the sheet’s context', async () => {
    const { result } = renderHook(
      () => ({
        catalog: useRxCatalog(DHARTI),
        sheet: useRxSheetContext(DHARTI, staffRef('DD')),
        list: usePatientPrescriptions(DHARTI),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.catalog.data?.often).toContain('Sunscreen SPF 50'),
    );
    await waitFor(() =>
      expect(result.current.sheet.data?.doctor?.firstName).toBe('Dr. Drashti'),
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    const id = result.current.list.data?.[0]?.id ?? '';
    const one = renderHook(() => usePrescription(id), { wrapper });
    await waitFor(() => expect(one.result.current.data?.seq).toBe(497));
  });

  it('stays idle without a patient or a prescription', () => {
    const { result } = renderHook(
      () => ({ list: usePatientPrescriptions(''), one: usePrescription('') }),
      { wrapper },
    );
    expect(result.current.list.fetchStatus).toBe('idle');
    expect(result.current.one.fetchStatus).toBe('idle');
  });
});
