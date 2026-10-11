import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ImagesApiModule from '@/shared/api/app/patient-images-api.ts';
import {
  deletePatientPhoto,
  fetchPatientPhoto,
  listPatientPhotos,
  restorePatientPhoto,
  updatePatientPhoto,
} from '@/shared/api/app/patient-images-api.ts';
import type {
  PatientPhoto,
  PatientPhotoPage,
} from '@/shared/api/app/patient-images-contracts.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import {
  useDeletePatientPhoto,
  usePatientPhoto,
  usePatientPhotos,
  useRestorePatientPhoto,
  useUpdatePatientPhoto,
} from './usePatientPhotos.ts';

vi.mock('@/shared/api/app/patient-images-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ImagesApiModule>()),
  listPatientPhotos: vi.fn(),
  fetchPatientPhoto: vi.fn(),
  updatePatientPhoto: vi.fn(),
  deletePatientPhoto: vi.fn(),
  restorePatientPhoto: vi.fn(),
}));

const PATIENT_ID = 'pat_priya0000000000000000';

function photo(id: string, overrides: Partial<PatientPhoto> = {}): PatientPhoto {
  return {
    id,
    patientId: PATIENT_ID,
    appointmentId: null,
    patientTreatmentId: null,
    album: 'general',
    stage: null,
    fileKey: `organization-files/org_test/${id}.png`,
    fileName: `${id}.png`,
    displayName: id,
    caption: null,
    bodyPart: null,
    takenOn: '2026-09-24',
    serviceLabel: null,
    createdAt: '2026-09-24T06:30:00.000Z',
    updatedAt: '2026-09-24T06:30:00.000Z',
    ...overrides,
  };
}

const page = (
  rows: PatientPhoto[],
  more: Partial<PatientPhotoPage> = {},
): PatientPhotoPage => ({
  rows,
  next: null,
  hasMore: false,
  total: rows.length,
  albumCounts: { general: rows.length, lhr: 0, private: 0 },
  ...more,
});

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('usePatientPhotos', () => {
  it('reads a page for the params, then the next, with the server’s total and counts', async () => {
    vi.mocked(listPatientPhotos)
      .mockResolvedValueOnce(
        page([photo('pimg_a')], { next: '1', hasMore: true, total: 2 }),
      )
      .mockResolvedValueOnce(page([photo('pimg_b')], { total: 2 }));
    const { wrapper: Wrapper } = wrapper();
    const { result } = renderHook(
      () => usePatientPhotos(PATIENT_ID, { album: 'general', limit: 1 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(listPatientPhotos).toHaveBeenCalledWith(
      PATIENT_ID,
      { album: 'general', limit: 1 },
      undefined,
    );
    expect(result.current).toMatchObject({
      total: 2,
      albumCounts: { general: 1, lhr: 0, private: 0 },
      hasNextPage: true,
    });

    act(() => {
      result.current.fetchNextPage();
      result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.photos).toHaveLength(2));
    expect(listPatientPhotos).toHaveBeenCalledTimes(2);
    expect(vi.mocked(listPatientPhotos).mock.calls[1]?.[2]).toBe('1');
    expect(result.current.hasNextPage).toBe(false);
  });

  it('waits for an organization, a patient and its gate', () => {
    useOrganizationStore.getState().clearOrganization();
    const { wrapper: Wrapper } = wrapper();
    renderHook(() => usePatientPhotos(PATIENT_ID), { wrapper: Wrapper }).unmount();
    expect(listPatientPhotos).not.toHaveBeenCalled();
    signInTestMember();
    renderHook(() => usePatientPhotos(''), { wrapper: Wrapper });
    renderHook(() => usePatientPhotos(PATIENT_ID, {}, { enabled: false }), {
      wrapper: Wrapper,
    });
    expect(listPatientPhotos).not.toHaveBeenCalled();
  });
});

describe('usePatientPhoto', () => {
  it('reads one photo, standing in with the page’s copy while it runs', async () => {
    const listed = photo('pimg_a', { caption: 'From the page' });
    vi.mocked(listPatientPhotos).mockResolvedValueOnce(page([listed]));
    const answers: ((value: PatientPhoto) => void)[] = [];
    vi.mocked(fetchPatientPhoto).mockReturnValueOnce(
      new Promise((resolve) => {
        answers.push(resolve);
      }),
    );
    const { wrapper: Wrapper } = wrapper();
    const list = renderHook(() => usePatientPhotos(PATIENT_ID, {}), { wrapper: Wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => usePatientPhoto(PATIENT_ID, 'pimg_a'), {
      wrapper: Wrapper,
    });
    expect(result.current.data?.caption).toBe('From the page');
    act(() => answers[0]?.({ ...listed, caption: 'From its read' }));
    await waitFor(() => expect(result.current.data?.caption).toBe('From its read'));
    expect(fetchPatientPhoto).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      imageId: 'pimg_a',
    });
  });
});

describe('the photo writes', () => {
  it('saves a change with the action’s key and refreshes the photos', async () => {
    const before = photo('pimg_a');
    vi.mocked(updatePatientPhoto).mockResolvedValueOnce({ ...before, stage: 'after' });
    const { wrapper: Wrapper, client } = wrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdatePatientPhoto(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({ photo: before, change: { stage: 'after' } }),
    );

    expect(updatePatientPhoto).toHaveBeenCalledWith({
      photo: before,
      change: { stage: 'after' },
      idempotencyKey: expect.any(String),
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['app', 'patients', 'images'] }),
    );
  });

  it('takes a deleted photo out of every page at once, and back on Undo', async () => {
    const kept = photo('pimg_a');
    const gone = photo('pimg_b');
    vi.mocked(listPatientPhotos).mockResolvedValue(page([kept, gone]));
    let land: () => void = () => undefined;
    vi.mocked(deletePatientPhoto).mockReturnValueOnce(
      new Promise((resolve) => {
        land = () => resolve();
      }),
    );
    vi.mocked(restorePatientPhoto).mockResolvedValueOnce(gone);
    const { wrapper: Wrapper } = wrapper();
    const list = renderHook(() => usePatientPhotos(PATIENT_ID, {}), { wrapper: Wrapper });
    await waitFor(() => expect(list.result.current.photos).toHaveLength(2));
    const remove = renderHook(() => useDeletePatientPhoto(), { wrapper: Wrapper });
    const restore = renderHook(() => useRestorePatientPhoto(), { wrapper: Wrapper });

    act(() =>
      remove.result.current.mutate({ photo: gone, reason: 'not_needed', note: null }),
    );
    await waitFor(() =>
      expect(list.result.current.photos.map((row) => row.id)).toEqual(['pimg_a']),
    );
    expect(deletePatientPhoto).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      imageId: 'pimg_b',
      reason: 'not_needed',
      note: null,
    });
    await act(async () => land());

    await act(() => restore.result.current.mutateAsync(gone));
    expect(restorePatientPhoto).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      imageId: 'pimg_b',
      idempotencyKey: expect.any(String),
    });
  });
});
