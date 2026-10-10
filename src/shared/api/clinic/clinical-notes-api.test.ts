import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';

import {
  clinicalNoteQueryKeys,
  createClinicalNote,
  deleteClinicalNote,
  listClinicalNotes,
  restoreClinicalNote,
} from './clinical-notes-api.ts';

const PATIENT_ID = 'pat_priya0000000000000000';
const NOTE_ID = 'pcn_tanning00000000000000';
const LIST_PATH = '/app/patients/{patient_id}/clinical-notes';
const NOTE_PATH = '/app/patients/{patient_id}/clinical-notes/{patient_clinical_note_id}';

/** A note as clinozy-be answers it. */
const noteRow = (patch: Record<string, unknown> = {}) => ({
  id: NOTE_ID,
  patient_id: PATIENT_ID,
  kind: 'complaint',
  text: 'Tanning on face',
  appointment_id: null,
  patient_diagnosis_id: null,
  added_at: '2026-10-10T01:40:32.427Z',
  created_at: '2026-10-10T01:40:32.427Z',
  updated_at: '2026-10-10T01:40:32.427Z',
  ...patch,
});

/** The same note as the file reads it. */
const NOTE = {
  id: NOTE_ID,
  patientId: PATIENT_ID,
  kind: 'complaint',
  text: 'Tanning on face',
  appointmentId: null,
  diagnosisId: null,
  addedAt: '2026-10-10T01:40:32.427Z',
};

/** One list page as clinozy-be answers it. */
const page = (
  rows: unknown[],
  pagination: { next?: string | null; has_more?: boolean } = {},
) => ({
  data: rows,
  meta: {
    request_id: 'req',
    pagination: { per_page: 100, next: null, has_more: false, ...pagination },
  },
});

beforeEach(() => vi.resetAllMocks());

describe('clinicalNoteQueryKeys', () => {
  it('keys a patient’s notes under the organization', () => {
    expect(clinicalNoteQueryKeys.list('org_test', PATIENT_ID)).toEqual([
      'clinic',
      'clinical-notes',
      'org_test',
      PATIENT_ID,
    ]);
  });
});

describe('listClinicalNotes', () => {
  it('reads every page, oldest first, as the file reads a note', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(
        page([noteRow()], { next: 'cursor-2', has_more: true }) as never,
      )
      .mockResolvedValueOnce(
        page([
          noteRow({
            id: 'pcn_melasma00000000000000',
            kind: 'diagnosis',
            text: 'Melasma',
            appointment_id: 'appt_visit0000000000000000',
            patient_diagnosis_id: 'dgn_melasma00000000000000',
          }),
        ]) as never,
      );
    expect(await listClinicalNotes(PATIENT_ID)).toEqual([
      NOTE,
      {
        id: 'pcn_melasma00000000000000',
        patientId: PATIENT_ID,
        kind: 'diagnosis',
        text: 'Melasma',
        appointmentId: 'appt_visit0000000000000000',
        diagnosisId: 'dgn_melasma00000000000000',
        addedAt: '2026-10-10T01:40:32.427Z',
      },
    ]);
    expect(api.get).toHaveBeenNthCalledWith(1, LIST_PATH, {
      params: { patient_id: PATIENT_ID },
      query: { limit: 100, sort: 'created_at', order: 'asc', after: undefined },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, LIST_PATH, {
      params: { patient_id: PATIENT_ID },
      query: { limit: 100, sort: 'created_at', order: 'asc', after: 'cursor-2' },
    });
  });

  it('stops on the last page, whatever cursor it carries', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([noteRow()], { next: 'stale', has_more: false }) as never,
    );
    expect(await listClinicalNotes(PATIENT_ID)).toHaveLength(1);
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('reads an answer without rows as no notes', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: undefined } as never);
    expect(await listClinicalNotes(PATIENT_ID)).toEqual([]);
  });

  it('refuses a note of a kind the API does not name', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([noteRow({ kind: 'allergy' })]) as never,
    );
    await expect(listClinicalNotes(PATIENT_ID)).rejects.toThrow();
  });
});

describe('createClinicalNote', () => {
  it('adds one note of its kind with the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: noteRow() } as never);
    expect(
      await createClinicalNote({
        patientId: PATIENT_ID,
        kind: 'complaint',
        text: 'Tanning on face',
        idempotencyKey: 'key-1',
      }),
    ).toEqual(NOTE);
    expect(api.post).toHaveBeenCalledWith(LIST_PATH, {
      params: { patient_id: PATIENT_ID },
      body: { kind: 'complaint', text: 'Tanning on face' },
      idempotencyKey: 'key-1',
    });
  });
});

describe('deleteClinicalNote', () => {
  it('deletes one note with its reason', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined } as never);
    await deleteClinicalNote({
      patientId: PATIENT_ID,
      noteId: NOTE_ID,
      reason: 'not_needed',
    });
    expect(api.delete).toHaveBeenCalledWith(NOTE_PATH, {
      params: { patient_id: PATIENT_ID, patient_clinical_note_id: NOTE_ID },
      reason: 'not_needed',
    });
  });
});

describe('restoreClinicalNote', () => {
  it('brings a deleted note back with the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: noteRow() } as never);
    expect(
      await restoreClinicalNote({
        patientId: PATIENT_ID,
        noteId: NOTE_ID,
        idempotencyKey: 'key-2',
      }),
    ).toEqual(NOTE);
    expect(api.post).toHaveBeenCalledWith(`${NOTE_PATH}/restore`, {
      params: { patient_id: PATIENT_ID, patient_clinical_note_id: NOTE_ID },
      idempotencyKey: 'key-2',
    });
  });
});
