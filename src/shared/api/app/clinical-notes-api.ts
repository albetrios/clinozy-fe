import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { pageOf } from '@/core/http/pagination.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import type { DeleteReason } from './app-schema.ts';
import {
  type ClinicalNote,
  type ClinicalNoteKind,
  clinicalNoteWire,
  toClinicalNote,
} from './clinical-notes-contracts.ts';

/*
 * A patient's clinical notes on clinozy-be (`/app/patients/:patient_id/clinical-notes`,
 * api-integration §5.4): every note, oldest first; add one; delete one with its reason;
 * restore one. Reads need `patient:clinical_record:read`, writes `patient:update`; every write
 * but the delete carries the action's key.
 */

/** TanStack Query keys for the clinical notes, each carrying the organization. */
export const clinicalNoteQueryKeys = {
  all: ['app', 'clinical-notes'] as const,
  /** One patient's notes, every kind. */
  list: (organizationId: string | null, patientId: string) =>
    [...clinicalNoteQueryKeys.all, organizationId, patientId] as const,
};

/** The API's largest page. */
const PAGE_SIZE = 100;

/** A patient's notes of every kind, every page, oldest first — the order the chips were added. */
export async function listClinicalNotes(patientId: string): Promise<ClinicalNote[]> {
  const rows = await collectAllPages(async (after) => {
    const response = await api.get('/app/patients/{patient_id}/clinical-notes', {
      params: { patient_id: patientId },
      query: {
        limit: PAGE_SIZE,
        sort: 'created_at',
        order: 'asc',
        after: after ?? undefined,
      },
    });
    return {
      rows: z.array(clinicalNoteWire).parse(response.data ?? []),
      next: pageOf(response.meta?.pagination).next,
    };
  }, 'clinical-notes');
  return rows.map(toClinicalNote);
}

/** Add one note — one chip. */
export async function createClinicalNote({
  patientId,
  kind,
  text,
  idempotencyKey,
}: {
  patientId: string;
  kind: ClinicalNoteKind;
  text: string;
  idempotencyKey: string;
}): Promise<ClinicalNote> {
  const response = await api.post('/app/patients/{patient_id}/clinical-notes', {
    params: { patient_id: patientId },
    body: { kind, text },
    idempotencyKey,
  });
  return toClinicalNote(clinicalNoteWire.parse(response.data));
}

/** Delete a note with its reason (restorable for the clinic's purge window). */
export async function deleteClinicalNote({
  patientId,
  noteId,
  reason,
}: {
  patientId: string;
  noteId: string;
  reason: DeleteReason;
}): Promise<void> {
  await api.delete(
    '/app/patients/{patient_id}/clinical-notes/{patient_clinical_note_id}',
    {
      params: { patient_id: patientId, patient_clinical_note_id: noteId },
      reason,
    },
  );
}

/** Bring a deleted note back (`409 record_not_deleted` when it is not deleted). */
export async function restoreClinicalNote({
  patientId,
  noteId,
  idempotencyKey,
}: {
  patientId: string;
  noteId: string;
  idempotencyKey: string;
}): Promise<ClinicalNote> {
  const response = await api.post(
    '/app/patients/{patient_id}/clinical-notes/{patient_clinical_note_id}/restore',
    {
      params: { patient_id: patientId, patient_clinical_note_id: noteId },
      idempotencyKey,
    },
  );
  return toClinicalNote(clinicalNoteWire.parse(response.data));
}
