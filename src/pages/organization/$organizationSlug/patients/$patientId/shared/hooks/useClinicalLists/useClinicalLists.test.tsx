import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ClinicalNote,
  ClinicalNoteKind,
} from '@/shared/api/app/clinical-notes-contracts.ts';
import {
  PATIENT_FILE_SECTIONS,
  type PatientFileSectionSlug,
} from '@/shared/app/patient-file-sections.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { patientRecord, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import { PatientFileContext } from '../../patient-file-context.ts';
import { useClinicalLists } from './useClinicalLists.ts';

/** The patient's notes as the server holds them — the API module's double reads and writes it. */
const server = vi.hoisted(() => ({
  notes: [] as ClinicalNote[],
  deleted: [] as ClinicalNote[],
  next: 0,
}));

vi.mock('@/shared/api/app/clinical-notes-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  // Oldest first, as the API answers.
  listClinicalNotes: vi.fn(async () =>
    structuredClone(server.notes).sort((a, b) => a.addedAt.localeCompare(b.addedAt)),
  ),
  createClinicalNote: vi.fn(
    async ({ kind, text }: { kind: ClinicalNoteKind; text: string }) => {
      server.next += 1;
      const created = note(`pcn_new${server.next}`, kind, text);
      server.notes.push(created);
      return created;
    },
  ),
  deleteClinicalNote: vi.fn(async ({ noteId }: { noteId: string }) => {
    const gone = server.notes.find((row) => row.id === noteId);
    server.notes = server.notes.filter((row) => row.id !== noteId);
    if (gone) server.deleted.push(gone);
  }),
  restoreClinicalNote: vi.fn(async ({ noteId }: { noteId: string }) => {
    const back = server.deleted.find((row) => row.id === noteId);
    if (!back) throw new Error('record_not_deleted');
    server.notes.push(back);
    return back;
  }),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
import {
  createClinicalNote,
  deleteClinicalNote,
  listClinicalNotes,
} from '@/shared/api/app/clinical-notes-api.ts';
import { notify } from '@/shared/notify/index.ts';

/** A note of Priya's. */
function note(id: string, kind: ClinicalNoteKind, text: string): ClinicalNote {
  return {
    id,
    patientId: TEST_PATIENT_ID,
    kind,
    text,
    appointmentId: null,
    diagnosisId: null,
    addedAt: `2026-10-01T05:00:${String(server.notes.length + server.deleted.length).padStart(2, '0')}.000Z`,
  };
}

let client: QueryClient;

/** The hook inside the file, for a member who may open `viewable`. */
function renderLists(
  viewable: readonly PatientFileSectionSlug[] = PATIENT_FILE_SECTIONS,
) {
  const patient = patientRecord();
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <PatientFileContext.Provider
          value={{
            patientId: patient.id,
            file: undefined,
            section: 'overview',
            viewable,
            masked: true,
            toggleMasked: () => undefined,
            photos: {
              pick: () => undefined,
              capture: () => undefined,
              upload: () => undefined,
            },
          }}
        >
          {children}
        </PatientFileContext.Provider>
      </QueryClientProvider>
    );
  }
  return renderHook(() => useClinicalLists(patient), { wrapper });
}

/** The chips of a list as `[text, pending, fresh]`. */
const chipsOf = (
  lists: ReturnType<typeof useClinicalLists>,
  field: Parameters<ReturnType<typeof useClinicalLists>['items']>[0],
) => lists.items(field).map((chip) => [chip.text, chip.pending, chip.fresh]);

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  server.notes = [];
  server.deleted = [];
  server.next = 0;
  server.notes.push(note('pcn_tanning', 'complaint', 'Tanning on face'));
  server.notes.push(note('pcn_uneven', 'complaint', 'Uneven skin tone'));
  server.notes.push(note('pcn_dryskin', 'finding', 'Dry skin on cheeks'));
  server.notes.push(note('pcn_hydra', 'future_suggestion', 'Hydrafacial after 4 weeks'));
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('useClinicalLists (GET / POST / DELETE …/clinical-notes)', () => {
  it('reads each list’s notes as chips — loading first, a finding in no list', async () => {
    const { result } = renderLists();
    expect(result.current.readable).toBe(true);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(chipsOf(result.current, 'complaints')).toEqual([
      ['Tanning on face', false, false],
      ['Uneven skin tone', false, false],
    ]);
    expect(chipsOf(result.current, 'diagnosis')).toEqual([]);
    expect(chipsOf(result.current, 'futureSuggestions')).toEqual([
      ['Hydrafacial after 4 weeks', false, false],
    ]);
    expect(result.current.items('complaints')[0]?.id).toBe('pcn_tanning');
  });

  it('asks nothing for a member who may not read the clinical record', () => {
    const { result } = renderLists(['timeline', 'visits']);
    expect(result.current.readable).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(listClinicalNotes).not.toHaveBeenCalled();
  });

  it('adds a chip at once as one note of its kind, new this visit', async () => {
    const { result } = renderLists();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.add('diagnosis', 'Melasma'));
    expect(chipsOf(result.current, 'diagnosis')).toEqual([['Melasma', true, true]]);
    await waitFor(() =>
      expect(chipsOf(result.current, 'diagnosis')).toEqual([['Melasma', false, true]]),
    );
    expect(result.current.items('diagnosis')[0]?.id).toBe('pcn_new1');
    expect(createClinicalNote).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: TEST_PATIENT_ID,
        kind: 'diagnosis',
        text: 'Melasma',
      }),
    );
  });

  it('adds a smart note’s chips — one note each, a chip a list holds (any case) skipped', async () => {
    const { result } = renderLists();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let added = 0;
    act(() => {
      added = result.current.addAll([
        { field: 'complaints', text: 'Hair fall' },
        { field: 'complaints', text: 'tanning on face' },
        { field: 'complaints', text: 'hair fall' },
        { field: 'treatmentSuggestions', text: 'PRP' },
      ]);
    });
    expect(added).toBe(2);
    expect(chipsOf(result.current, 'complaints')).toEqual([
      ['Tanning on face', false, false],
      ['Uneven skin tone', false, false],
      ['Hair fall', true, true],
    ]);
    await waitFor(() => expect(createClinicalNote).toHaveBeenCalledTimes(2));
    expect(vi.mocked(createClinicalNote).mock.calls.map(([vars]) => vars.kind)).toEqual([
      'complaint',
      'treatment_suggestion',
    ]);
    await waitFor(() =>
      expect(chipsOf(result.current, 'treatmentSuggestions')).toEqual([
        ['PRP', false, true],
      ]),
    );
  });

  it('adds nothing when every chip is already there', async () => {
    const { result } = renderLists();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let added = -1;
    act(() => {
      added = result.current.addAll([{ field: 'complaints', text: 'UNEVEN SKIN TONE' }]);
    });
    expect(added).toBe(0);
    expect(createClinicalNote).not.toHaveBeenCalled();
  });

  it('removes a chip at once as not needed, and Undo restores it', async () => {
    const { result } = renderLists();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const [tanning] = result.current.items('complaints');
    if (!tanning) throw new Error('no chip');
    let removal: Promise<boolean> = Promise.resolve(false);
    act(() => {
      removal = result.current.remove(tanning);
    });
    expect(chipsOf(result.current, 'complaints')).toEqual([
      ['Uneven skin tone', false, false],
    ]);
    await act(async () => {
      expect(await removal).toBe(true);
    });
    expect(deleteClinicalNote).toHaveBeenCalledWith({
      patientId: TEST_PATIENT_ID,
      noteId: 'pcn_tanning',
      reason: 'not_needed',
    });
    expect(chipsOf(result.current, 'complaints')).toEqual([
      ['Uneven skin tone', false, false],
    ]);
    act(() => result.current.restore(tanning));
    await waitFor(() =>
      expect(chipsOf(result.current, 'complaints')).toEqual([
        ['Tanning on face', false, false],
        ['Uneven skin tone', false, false],
      ]),
    );
  });

  it('puts a chip back when its delete is refused, and takes away a refused add', async () => {
    const { result } = renderLists();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(deleteClinicalNote).mockRejectedValueOnce(new Error('refused'));
    const [tanning] = result.current.items('complaints');
    if (!tanning) throw new Error('no chip');
    await act(async () => {
      expect(await result.current.remove(tanning)).toBe(false);
    });
    expect(chipsOf(result.current, 'complaints')).toHaveLength(2);

    vi.mocked(createClinicalNote).mockRejectedValueOnce(new Error('refused'));
    act(() => result.current.add('complaints', 'Acne'));
    expect(chipsOf(result.current, 'complaints')).toHaveLength(3);
    await waitFor(() => expect(chipsOf(result.current, 'complaints')).toHaveLength(2));
    expect(notify.error).toHaveBeenCalledTimes(2);
  });

  it('removes nothing that is still saving', async () => {
    const { result } = renderLists();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.add('complaints', 'Acne'));
    const saving = result.current.items('complaints')[2];
    if (!saving) throw new Error('no chip');
    await act(async () => {
      expect(await result.current.remove(saving)).toBe(false);
    });
    expect(deleteClinicalNote).not.toHaveBeenCalled();
  });

  it('says when the notes cannot be read, and Retry reads them again', async () => {
    vi.mocked(listClinicalNotes).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderLists();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.isLoading).toBe(false);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(chipsOf(result.current, 'complaints')).toHaveLength(2);
  });
});
