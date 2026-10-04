import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  useDeletePatientPhoto,
  usePatientPhotos,
  useRestorePatientPhoto,
  useUpdatePatientPhoto,
} from './usePatientPhotos.ts';

const DHARTI = patientRef('Dharti Galani');
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The photos read and the three writes, in one probe. */
function usePhotosProbe(privateAlbum = true) {
  return {
    read: usePatientPhotos(DHARTI, { privateAlbum }),
    update: useUpdatePatientPhoto(),
    remove: useDeletePatientPhoto(),
    restore: useRestorePatientPhoto(),
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

describe('usePatientPhotos', () => {
  it('reads the patient’s photos, the Private album only when the member may', async () => {
    const all = renderHook(() => usePatientPhotos(DHARTI, { privateAlbum: true }), {
      wrapper,
    });
    await waitFor(() => expect(all.result.current.data?.photos).toHaveLength(3));
    const open = renderHook(() => usePatientPhotos(DHARTI, { privateAlbum: false }), {
      wrapper,
    });
    await waitFor(() => expect(open.result.current.data?.photos).toHaveLength(2));
  });

  it('stays idle without a patient', () => {
    const { result } = renderHook(() => usePatientPhotos('', { privateAlbum: true }), {
      wrapper,
    });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('drops a deleted photo at once, brings it back on Undo, and saves details', async () => {
    const { result } = renderHook(() => usePhotosProbe(), { wrapper });
    await waitFor(() => expect(result.current.read.data?.photos).toHaveLength(3));
    const photo = result.current.read.data?.photos[0];
    if (!photo) throw new Error('no photo');

    await act(() =>
      result.current.remove.mutateAsync({
        id: photo.id,
        reason: 'duplicate',
        note: null,
      }),
    );
    await waitFor(() => expect(result.current.read.data?.photos).toHaveLength(2));

    await act(() => result.current.restore.mutateAsync(photo.id));
    await waitFor(() => expect(result.current.read.data?.photos).toHaveLength(3));

    await act(() =>
      result.current.update.mutateAsync({
        id: photo.id,
        patch: { caption: 'Left cheek' },
      }),
    );
    await waitFor(() =>
      expect(
        result.current.read.data?.photos.find((item) => item.id === photo.id)?.caption,
      ).toBe('Left cheek'),
    );
  });
});
