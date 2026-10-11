import { z } from 'zod';

import { api } from '@/core/http/api.ts';

import { createdRangeOf, followUpRangeOf } from './app-filter-ranges.ts';
import type { DeleteReason } from './app-schema.ts';
import { appToday } from './app-time.ts';
import { fetchContact, fetchContactsByIds } from './contacts-api.ts';
import {
  patientChangeOf,
  patientCreateBodyOf,
  type PatientFields,
  type PatientListParams,
  type PatientPersonInput,
  type PatientRecord,
  type PatientRow,
  patientRowWire,
  patientWire,
  toPatientRecord,
  toPatientRow,
} from './patients-contracts.ts';

/*
 * The Patients domain on clinozy-be (`/app/patients`, api-integration §5.4): the list with its
 * views, filters and sorts, each page joined with its people (`GET /app/contacts?ids=`); one
 * patient with their person; create (on a known person, or with a new one); an edit that writes
 * the person and the file, each carrying its read's `updated_at`; delete with its reason and
 * restore. Every write carries the action's key.
 */

/** TanStack Query keys for the patients, each carrying the organization. */
export const patientQueryKeys = {
  all: ['app', 'patients'] as const,
  /** Every list variant — a write invalidates them all. */
  lists: (organizationId: string | null) =>
    [...patientQueryKeys.all, organizationId, 'list'] as const,
  list: (organizationId: string | null, params: PatientListParams) =>
    [...patientQueryKeys.lists(organizationId), params] as const,
  detail: (organizationId: string | null, patientId: string) =>
    [...patientQueryKeys.all, organizationId, 'detail', patientId] as const,
  /** The drawer's duplicate-number check. */
  byPhone: (organizationId: string | null, phone: string) =>
    [...patientQueryKeys.all, organizationId, 'phone', phone] as const,
};

/** One page of the list — the design's 50. */
const PAGE_SIZE = 50;

/** The list's sort keys as the API names them. */
const SORTS = { seq: 'patient_number', followUp: 'follow_up_at' } as const;

/** The list read's query for the URL's params, on the clinic's `today`. */
export function patientListQuery(params: PatientListParams, today: string = appToday()) {
  const created = params.created ? createdRangeOf(params.created, today) : {};
  const followUp = params.followUp ? (followUpRangeOf(params.followUp, today) ?? {}) : {};
  // Follow-up due: anything up to the end of today, the overdue ones included.
  const due = params.view === 'follow' ? followUpRangeOf('today', today)?.to : undefined;
  const status = params.view === 'recall' ? 'inactive' : params.status;
  return {
    limit: PAGE_SIZE,
    q: params.q === '' ? undefined : params.q,
    types: params.types?.length ? params.types.join(',') : undefined,
    status,
    conversion: params.conversion,
    created_from: created.from,
    created_to: created.to,
    follow_up_at_from: followUp.from,
    follow_up_at_to: due ?? followUp.to,
    sort: params.sort ? SORTS[params.sort] : undefined,
    order: params.sort ? params.order : undefined,
  };
}

/** One page of patients for the URL's params, each with their person; `after` is the cursor. */
export async function listPatients(
  params: PatientListParams,
  after?: string,
): Promise<{ rows: PatientRow[]; next: string | null; total: number | null }> {
  const response = await api.get('/app/patients', {
    query: { ...patientListQuery(params), after },
  });
  const rows = z.array(patientRowWire).parse(response.data ?? []);
  const people = await fetchContactsByIds(rows.map((row) => row.contact_id));
  const pagination = response.meta?.pagination;
  return {
    rows: rows.map((row) => toPatientRow(row, people.get(row.contact_id) ?? null)),
    next: pagination?.has_more ? (pagination.next ?? null) : null,
    total: pagination?.estimated_total ?? null,
  };
}

/** One patient with their person — a 404 when gone or in a branch the member cannot see. */
export async function fetchPatient(patientId: string): Promise<PatientRecord> {
  const response = await api.get('/app/patients/{patient_id}', {
    params: { patient_id: patientId },
  });
  const patient = patientWire.parse(response.data);
  return toPatientRecord(patient, await fetchContact(patient.contact_id));
}

/**
 * A new patient — on a person the clinic knows (`contact_id`) or with a new one. `409
 * contact_is_patient` when the person already has a file, `409 contact_phone_exists` when a new
 * person's number is someone else's.
 */
export async function createPatient({
  fields,
  person,
  idempotencyKey,
}: {
  fields: PatientFields;
  person: PatientPersonInput;
  idempotencyKey: string;
}): Promise<PatientRecord> {
  const response = await api.post('/app/patients', {
    body: patientCreateBodyOf(fields, person),
    idempotencyKey,
  });
  const patient = patientWire.parse(response.data);
  return toPatientRecord(patient, await fetchContact(patient.contact_id));
}

/**
 * An edit: the person's change (`PATCH /app/contacts/:contact_id`), then the file's (`PATCH
 * /app/patients/:patient_id`) — each only when something of it changed, each with its read's
 * `updated_at` (`409 record_changed` when it changed since) and its own key from the action's.
 */
export async function updatePatient({
  record,
  fields,
  idempotencyKey,
}: {
  record: PatientRecord;
  fields: PatientFields;
  idempotencyKey: string;
}): Promise<PatientRecord> {
  const change = patientChangeOf(record, fields);
  if (change.person) {
    await api.patch('/app/contacts/{contact_id}', {
      params: { contact_id: record.contactId },
      body: { ...change.person, expected_updated_at: record.contactUpdatedAt },
      idempotencyKey: `${idempotencyKey}:contact`,
    });
  }
  if (change.file) {
    await api.patch('/app/patients/{patient_id}', {
      params: { patient_id: record.id },
      body: { ...change.file, expected_updated_at: record.updatedAt },
      idempotencyKey: `${idempotencyKey}:patient`,
    });
  }
  return fetchPatient(record.id);
}

/** Delete a patient with the reason the member picked (restorable for the clinic's purge window). */
export async function deletePatient({
  patientId,
  reason,
  note,
}: {
  patientId: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/patients/{patient_id}', {
    params: { patient_id: patientId },
    reason,
    note: note ?? undefined,
  });
}

/** Bring a deleted patient back. */
export async function restorePatient(
  patientId: string,
  idempotencyKey: string,
): Promise<PatientRecord> {
  const response = await api.post('/app/patients/{patient_id}/restore', {
    params: { patient_id: patientId },
    idempotencyKey,
  });
  const patient = patientWire.parse(response.data);
  return toPatientRecord(patient, await fetchContact(patient.contact_id));
}
