import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as PatientsApiModule from '@/shared/api/clinic/patients-api.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import { taskQueryKeys } from '@/shared/api/clinic/tasks-api.ts';

import {
  useCreatePatient,
  useDeletePatient,
  usePatient,
  usePatientByPhone,
  usePatientList,
  useRestorePatient,
  useUpdatePatient,
} from './usePatients.ts';

/** Holds a write until a test lets it land, so the optimistic patch can be seen. */
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null }));

vi.mock('@/shared/api/clinic/patients-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof PatientsApiModule>();
  return {
    ...actual,
    deletePatient: async (...args: Parameters<typeof actual.deletePatient>) => {
      await gate.hold;
      return actual.deletePatient(...args);
    },
  };
});
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

const DHARTI = patientRef('Dharti Galani');

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetClinicFixtures();
  gate.hold = null;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('usePatientList', () => {
  it('reads a cursor page under the domain key, rows that keep their identity', async () => {
    const { result, rerender } = renderHook(() => usePatientList({ view: 'all' }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(30));
    const first = result.current.rows;
    rerender();
    expect(result.current.rows).toBe(first);
    expect(result.current.hasNextPage).toBe(false);
    expect(client.getQueryState(patientQueryKeys.list({ view: 'all' }))?.status).toBe(
      'success',
    );
  });
});

describe('usePatient / usePatientByPhone', () => {
  it('reads one patient, and the patient already on a mobile; idle without either', async () => {
    const idle = renderHook(() => usePatient(undefined), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    const { result } = renderHook(() => usePatient(DHARTI), { wrapper });
    await waitFor(() => expect(result.current.data?.seq).toBe(3508));

    const lookup = renderHook(() => usePatientByPhone('+918200603212', null), {
      wrapper,
    });
    await waitFor(() => expect(lookup.result.current.data?.id).toBe(DHARTI));
    const none = renderHook(() => usePatientByPhone(null, null), { wrapper });
    expect(none.result.current.fetchStatus).toBe('idle');
  });
});

describe('the patient writes', () => {
  it('creates a patient and refreshes the patients and the tasks', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreatePatient(), { wrapper });
    let created: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      created = await result.current.mutateAsync({
        firstName: 'Priya',
        phone: '+919876543210',
      });
    });
    expect(created?.patient.firstName).toBe('Priya');
    expect(created?.onboardingTaskId).toEqual(expect.any(String));
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(patientQueryKeys.all);
    expect(keys).toContainEqual(taskQueryKeys.all);
  });

  it('saves a patient', async () => {
    const { result } = renderHook(() => useUpdatePatient(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        id: DHARTI,
        patch: { notes: 'Prefers mornings' },
      });
    });
    const detail = renderHook(() => usePatient(DHARTI), { wrapper });
    await waitFor(() =>
      expect(detail.result.current.data?.notes).toBe('Prefers mornings'),
    );
  });

  it('removes a row from every list at once, and Undo brings it back', async () => {
    let release = () => {};
    gate.hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { result } = renderHook(
      () => ({
        list: usePatientList({ view: 'all' }),
        remove: useDeletePatient(),
        restore: useRestorePatient(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.rows).toHaveLength(30));

    act(() => {
      result.current.remove.mutate({ id: DHARTI, reason: 'duplicate', note: null });
    });
    await waitFor(() =>
      expect(result.current.list.rows.some((patient) => patient.id === DHARTI)).toBe(
        false,
      ),
    );
    await act(async () => {
      release();
      await gate.hold;
    });
    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));

    await act(async () => {
      await result.current.restore.mutateAsync(DHARTI);
    });
    await waitFor(() =>
      expect(result.current.list.rows.some((patient) => patient.id === DHARTI)).toBe(
        true,
      ),
    );
  });
});
