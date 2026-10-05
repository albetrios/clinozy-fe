import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type { TreatmentInput } from '@/shared/api/clinic/treatments-api.ts';

import {
  useCreateTreatment,
  useDeleteTreatment,
  usePatientTreatments,
  useRestoreTreatment,
  useTreatment,
  useTreatmentCheckIns,
  useUpdateTreatment,
} from './useTreatments.ts';

const DHARTI = patientRef('Dharti Galani');
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const INPUT: TreatmentInput = {
  patientId: DHARTI,
  appointmentId: null,
  offeringId: null,
  name: 'Back Peeling',
  template: 'skin',
  performedAt: '2026-10-03T06:30:00.000Z',
  doctorId: null,
  therapistId: null,
  bodyParts: ['back'],
  sessionNo: 1,
  params: { type: 'Peel' },
  remark: null,
  aftercareCall: 'next_day',
  packageId: null,
};

function useTreatmentProbe() {
  return {
    list: usePatientTreatments(DHARTI),
    create: useCreateTreatment(),
    update: useUpdateTreatment(),
    remove: useDeleteTreatment(),
    restore: useRestoreTreatment(),
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

describe('useTreatments', () => {
  it('reads the patient’s treatments and refreshes them after each write', async () => {
    const { result } = renderHook(useTreatmentProbe, { wrapper });
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));

    const saved = await act(() => result.current.create.mutateAsync(INPUT));
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));

    await act(() =>
      result.current.update.mutateAsync({
        id: saved.id,
        input: { ...INPUT, sessionNo: 2 },
      }),
    );
    await waitFor(() =>
      expect(
        result.current.list.data?.find((row) => row.id === saved.id)?.sessionNo,
      ).toBe(2),
    );

    await act(() =>
      result.current.remove.mutateAsync({ id: saved.id, reason: 'mistake', note: null }),
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    await act(() => result.current.restore.mutateAsync(saved.id));
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
  });

  it('reads one treatment with its check-ins; idle without one', async () => {
    const { result } = renderHook(() => useTreatment(ref.treatment(498)), { wrapper });
    await waitFor(() => expect(result.current.data?.checkIns).toHaveLength(1));
    const idle = renderHook(() => useTreatment(''), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });
});

describe('useTreatmentCheckIns', () => {
  it('reads each treatment’s latest check-in — the Treatments table’s Feedback', async () => {
    const { result } = renderHook(() => useTreatmentCheckIns(DHARTI), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.[ref.treatment(498)]).toMatchObject({
      feel: 'better',
      score: 7,
    });
    const idle = renderHook(() => useTreatmentCheckIns(''), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });
});
