import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/clinical-notes-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listClinicalNotes: vi.fn(),
  createClinicalNote: vi.fn(),
  deleteClinicalNote: vi.fn(),
  restoreClinicalNote: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
import {
  clinicalNoteQueryKeys,
  createClinicalNote,
  deleteClinicalNote,
  listClinicalNotes,
  restoreClinicalNote,
} from '@/shared/api/clinic/clinical-notes-api.ts';
import type { ClinicalNote } from '@/shared/api/clinic/clinical-notes-contracts.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import {
  useClinicalNotes,
  useCreateClinicalNote,
  useRemoveClinicalNote,
  useRestoreClinicalNote,
} from './useClinicalNotes.ts';

/** A note of Priya's, added at `addedAt`. */
const note = (id: string, text: string, addedAt: string): ClinicalNote => ({
  id,
  patientId: TEST_PATIENT_ID,
  kind: 'complaint',
  text,
  appointmentId: null,
  diagnosisId: null,
  addedAt,
});

const TANNING = note(
  'pcn_tanning00000000000000',
  'Tanning on face',
  '2026-10-01T05:00:00.000Z',
);
const ACNE = note('pcn_acne000000000000000000', 'Acne', '2026-10-02T05:00:00.000Z');
const DRYNESS = note('pcn_dryness00000000000000', 'Dryness', '2026-10-03T05:00:00.000Z');
const KEY = clinicalNoteQueryKeys.list('org_test', TEST_PATIENT_ID);

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('useClinicalNotes', () => {
  it('reads a patient’s notes under the organization', async () => {
    vi.mocked(listClinicalNotes).mockResolvedValue([TANNING]);
    const { result } = renderHook(() => useClinicalNotes(TEST_PATIENT_ID), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([TANNING]));
    expect(listClinicalNotes).toHaveBeenCalledWith(TEST_PATIENT_ID);
    expect(client.getQueryData(KEY)).toEqual([TANNING]);
  });

  it('asks nothing without a patient, without the code, or outside an organization', () => {
    renderHook(() => useClinicalNotes(undefined), { wrapper });
    renderHook(() => useClinicalNotes(TEST_PATIENT_ID, { enabled: false }), { wrapper });
    useOrganizationStore.getState().clearOrganization();
    renderHook(() => useClinicalNotes(TEST_PATIENT_ID), { wrapper });
    expect(listClinicalNotes).not.toHaveBeenCalled();
  });

  it('raises no toast of its own when the read fails', async () => {
    vi.mocked(listClinicalNotes).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useClinicalNotes(TEST_PATIENT_ID), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notify.error).not.toHaveBeenCalled();
  });
});

describe('the clinical note writes', () => {
  it('adds a note with the action’s key and puts it last among the cached notes', async () => {
    client.setQueryData(KEY, [TANNING]);
    vi.mocked(createClinicalNote).mockResolvedValue(ACNE);
    const { result } = renderHook(() => useCreateClinicalNote(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        patientId: TEST_PATIENT_ID,
        kind: 'complaint',
        text: 'Acne',
      }),
    );
    expect(createClinicalNote).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      kind: 'complaint',
      text: 'Acne',
      idempotencyKey: expect.any(String),
    });
    expect(client.getQueryData(KEY)).toEqual([TANNING, ACNE]);
    expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('removes a chip’s note as not needed (Q24) and drops it from the cache', async () => {
    client.setQueryData(KEY, [TANNING, ACNE]);
    vi.mocked(deleteClinicalNote).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoveClinicalNote(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ patientId: TEST_PATIENT_ID, noteId: TANNING.id }),
    );
    expect(deleteClinicalNote).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      noteId: TANNING.id,
      reason: 'not_needed',
    });
    expect(client.getQueryData(KEY)).toEqual([ACNE]);
  });

  it('keeps the note and toasts the error when the delete is refused', async () => {
    client.setQueryData(KEY, [TANNING]);
    vi.mocked(deleteClinicalNote).mockRejectedValue(new Error('refused'));
    const { result } = renderHook(() => useRemoveClinicalNote(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ patientId: TEST_PATIENT_ID, noteId: TANNING.id })
        .catch(() => undefined);
    });
    expect(client.getQueryData(KEY)).toEqual([TANNING]);
    expect(notify.error).toHaveBeenCalled();
  });

  it('restores a note into its place, by when it was added', async () => {
    client.setQueryData(KEY, [TANNING, DRYNESS]);
    vi.mocked(restoreClinicalNote).mockResolvedValue(ACNE);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useRestoreClinicalNote({ onSuccess }), {
      wrapper,
    });
    await act(() =>
      result.current.mutateAsync({ patientId: TEST_PATIENT_ID, noteId: ACNE.id }),
    );
    expect(restoreClinicalNote).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      noteId: ACNE.id,
      idempotencyKey: expect.any(String),
    });
    expect(client.getQueryData(KEY)).toEqual([TANNING, ACNE, DRYNESS]);
    expect(onSuccess).toHaveBeenCalledWith(ACNE, {
      patientId: TEST_PATIENT_ID,
      noteId: ACNE.id,
    });
  });

  it('leaves notes it never read alone', async () => {
    vi.mocked(createClinicalNote).mockResolvedValue(ACNE);
    const { result } = renderHook(() => useCreateClinicalNote(), { wrapper });
    await act(() =>
      result.current.mutateAsync({
        patientId: TEST_PATIENT_ID,
        kind: 'complaint',
        text: 'Acne',
      }),
    );
    expect(client.getQueryData(KEY)).toBeUndefined();
  });
});
