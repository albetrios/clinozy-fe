import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  useAddPatientNote,
  useDeletePatientNote,
  usePatientNotes,
  useRestorePatientNote,
} from './usePatientNotes.ts';

const DHARTI = patientRef('Dharti Galani');
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const useNotes = () => ({
  list: usePatientNotes(DHARTI),
  add: useAddPatientNote(DHARTI),
  remove: useDeletePatientNote(DHARTI),
  restore: useRestorePatientNote(),
});

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('usePatientNotes (S:1645; H:834)', () => {
  it('reads her notes newest first; idle without a patient', async () => {
    const { result } = renderHook(useNotes, { wrapper });
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    expect(result.current.list.data?.map((note) => note.body)).toEqual([
      'Patient suggested the peel package, will decide after first session',
      'Clinic visited',
    ]);
    const idle = renderHook(() => usePatientNotes(''), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });

  it('adds a note on top at once, then keeps the server’s', async () => {
    const { result } = renderHook(useNotes, { wrapper });
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    act(() => result.current.add.mutate({ patientId: DHARTI, body: '  Call Monday  ' }));
    await waitFor(() => expect(result.current.list.data?.[0]?.body).toBe('Call Monday'));
    await waitFor(() => expect(result.current.add.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.list.data?.[0]?.createdById).not.toBe(''));
    expect(result.current.list.data).toHaveLength(3);
  });

  it('turns a blank note away, putting the list back', async () => {
    const { result } = renderHook(useNotes, { wrapper });
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    await act(async () => {
      await result.current.add
        .mutateAsync({ patientId: DHARTI, body: '   ' })
        .catch(() => undefined);
    });
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
  });

  it('deletes a note at once and restores it', async () => {
    const note = ref.patientNote(1);
    const { result } = renderHook(useNotes, { wrapper });
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    await act(() => result.current.remove.mutateAsync(note));
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    expect(clinicFixtures.patientNotes.snapshot((row) => row.id === note)).toHaveLength(
      0,
    );
    await act(() => result.current.restore.mutateAsync(note));
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
  });
});
