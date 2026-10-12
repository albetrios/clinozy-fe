import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { pageOf } from '@/core/http/pagination.ts';

import { isContactSearchable } from './contacts-api.ts';
import { contactNameOf, contactRowWire } from './contacts-contracts.ts';

/*
 * The patient field's search (Receive payment, the Invoice drawer — KICKOFF §6.9) on clinozy-be:
 * the clinic's patients — the contacts with a patient file (`GET /app/contacts?is_patient=true`) —
 * by name, number or contact number, A–Z when nothing is typed. The list carries no dues (a
 * per-row read would be one per patient, D148 Q1); the picked patient's comes from their invoices'
 * total.
 */

/** One row of the patient field's list: a patient it can take. */
export interface PatientPickRow {
  kind: 'patient';
  /** The patient file (`pat_…`) — the field's value. */
  id: string;
  /** Their contact (`con_…`) — what a receipt or an invoice names. */
  contactId: string;
  /** "#3508". */
  seq: number;
  name: string;
  phone: string;
  /** Everything they still owe, in rupees; null when it was not read (a list row). */
  due: number | null;
}

/** TanStack Query keys for the patient field's pages. */
export const patientPickerQueryKeys = {
  all: ['app', 'patient-picker'] as const,
};

/** One page of the patient field. */
const PICKER_PAGE_SIZE = 30;

/**
 * One page of the patient field's list: patients A–Z for an empty search, else those `query`
 * finds (3+ letters, 4+ digits or a whole `C-` number — anything shorter finds none, M17).
 */
export async function searchPatientPicker(
  query: string,
  cursor: string | null = null,
): Promise<{ items: PatientPickRow[]; nextCursor: string | null }> {
  const q = query.trim();
  if (q !== '' && !isContactSearchable(q)) return { items: [], nextCursor: null };
  const response = await api.get('/app/contacts', {
    query: {
      is_patient: 'true',
      q: q === '' ? undefined : q,
      sort: q === '' ? 'name' : undefined,
      order: q === '' ? 'asc' : undefined,
      limit: PICKER_PAGE_SIZE,
      after: cursor ?? undefined,
    },
  });
  const items = z
    .array(contactRowWire)
    .parse(response.data ?? [])
    .flatMap((row): PatientPickRow[] =>
      row.patient_id
        ? [
            {
              kind: 'patient',
              id: row.patient_id,
              contactId: row.id,
              seq: row.patient_number ?? 0,
              name: contactNameOf(row),
              phone: row.primary_phone,
              due: null,
            },
          ]
        : [],
    );
  return { items, nextCursor: pageOf(response.meta?.pagination).next };
}
