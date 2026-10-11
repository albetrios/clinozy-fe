import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import { patientQueryKeys } from './patients-api.ts';
import {
  toTreatmentCheckIn,
  toTreatmentRecord,
  type TreatmentCheckIn,
  treatmentCheckInWire,
  treatmentCreateBodyOf,
  type TreatmentCreateInput,
  type TreatmentFields,
  type TreatmentRecord,
  treatmentUpdateBodyOf,
  treatmentWire,
} from './treatments-contracts.ts';

/*
 * A patient's treatments on clinozy-be (`/app/patients/:patient_id/treatments`, api-integration
 * §5.4): the list (every page, newest first), one session, a new one, a change that carries the
 * read's `updated_at`, and the reverse with its reason — the delete and Undo the design drew
 * become Reverse: the row stays, marked reversed, and a package session it spent comes back.
 * "Feedback on this treatment" reads the session's check-ins (`GET …/check-ins
 * ?patient_treatment_id=`), one read for the open drawer. Every write carries the action's key.
 */

/**
 * TanStack Query keys for the treatments — under the patients' key, so a write that refreshes
 * the patient (its packages, its check-ins) refreshes these too; each carries the organization.
 */
export const treatmentQueryKeys = {
  all: [...patientQueryKeys.all, 'treatments'] as const,
  /** One patient's sessions, newest first. */
  patient: (organizationId: string | null, patientId: string) =>
    [...treatmentQueryKeys.all, organizationId, 'patient', patientId] as const,
  detail: (organizationId: string | null, patientId: string, treatmentId: string) =>
    [
      ...treatmentQueryKeys.all,
      organizationId,
      'detail',
      patientId,
      treatmentId,
    ] as const,
  /** A visit's sessions still to bill — the Invoice drawer's "Create invoice from visit". */
  toBill: (organizationId: string | null, patientId: string, appointmentId: string) =>
    [
      ...treatmentQueryKeys.all,
      organizationId,
      'to-bill',
      patientId,
      appointmentId,
    ] as const,
  /** A session's check-ins — "Feedback on this treatment". */
  checkIns: (organizationId: string | null, patientId: string, treatmentId: string) =>
    [
      ...treatmentQueryKeys.all,
      organizationId,
      'check-ins',
      patientId,
      treatmentId,
    ] as const,
};

/** The most one page takes. */
const PAGE_SIZE = 100;

/** A cursor page's next cursor, or null on the last. */
const nextOf = (pagination?: { has_more?: boolean; next?: string | null }) =>
  pagination?.has_more ? (pagination.next ?? null) : null;

/** Every session of a patient, newest first — the reversed ones too (every page). */
export async function listPatientTreatments(
  patientId: string,
): Promise<TreatmentRecord[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/patients/{patient_id}/treatments', {
      params: { patient_id: patientId },
      query: {
        sort: 'performed_at',
        order: 'desc',
        limit: PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return {
      rows: z
        .array(treatmentWire)
        .parse(response.data ?? [])
        .map(toTreatmentRecord),
      next: nextOf(response.meta?.pagination),
    };
  }, 'patient-treatments');
}

/**
 * The sessions a visit still has to bill (every page) — done at its booking, of an offering and
 * on no package (`GET …/treatments?appointment_id=&is_billed=false`, TR13): the visit flow's
 * "Create invoice from visit" bills them.
 */
export async function listVisitTreatmentsToBill(
  patientId: string,
  appointmentId: string,
): Promise<TreatmentRecord[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/patients/{patient_id}/treatments', {
      params: { patient_id: patientId },
      query: {
        appointment_id: appointmentId,
        is_billed: 'false',
        sort: 'performed_at',
        order: 'asc',
        limit: PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return {
      rows: z
        .array(treatmentWire)
        .parse(response.data ?? [])
        .map(toTreatmentRecord),
      next: nextOf(response.meta?.pagination),
    };
  }, 'visit-treatments-to-bill');
}

/** One session — a 404 when it is unknown or another patient's. */
export async function fetchTreatment(
  patientId: string,
  treatmentId: string,
): Promise<TreatmentRecord> {
  const response = await api.get(
    '/app/patients/{patient_id}/treatments/{patient_treatment_id}',
    { params: { patient_id: patientId, patient_treatment_id: treatmentId } },
  );
  return toTreatmentRecord(treatmentWire.parse(response.data));
}

/** A session's check-ins, newest first (every page) — "Feedback on this treatment". */
export async function listTreatmentCheckIns(
  patientId: string,
  treatmentId: string,
): Promise<TreatmentCheckIn[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/patients/{patient_id}/check-ins', {
      params: { patient_id: patientId },
      query: {
        patient_treatment_id: treatmentId,
        sort: 'check_in_date',
        order: 'desc',
        limit: PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return {
      rows: z
        .array(treatmentCheckInWire)
        .parse(response.data ?? [])
        .map(toTreatmentCheckIn),
      next: nextOf(response.meta?.pagination),
    };
  }, 'treatment-check-ins');
}

/**
 * Record a session. One for a package spends a session of it — `409 offering_used_up` when none
 * is left, `409 offering_expired` past its validity; the aftercare call and the file's activity
 * entry follow on the server.
 */
export async function createTreatment({
  patientId,
  input,
  idempotencyKey,
}: {
  patientId: string;
  input: TreatmentCreateInput;
  idempotencyKey: string;
}): Promise<TreatmentRecord> {
  const response = await api.post('/app/patients/{patient_id}/treatments', {
    params: { patient_id: patientId },
    body: treatmentCreateBodyOf(input),
    idempotencyKey,
  });
  return toTreatmentRecord(treatmentWire.parse(response.data));
}

/**
 * Save a session's changes with the read's `updated_at` — `409 record_changed` when someone saved
 * it meanwhile, `409 treatment_reversed` once it is reversed.
 */
export async function updateTreatment({
  treatment,
  fields,
  idempotencyKey,
}: {
  /** The session as the drawer read it. */
  treatment: TreatmentRecord;
  fields: TreatmentFields;
  idempotencyKey: string;
}): Promise<TreatmentRecord> {
  const response = await api.patch(
    '/app/patients/{patient_id}/treatments/{patient_treatment_id}',
    {
      params: { patient_id: treatment.patientId, patient_treatment_id: treatment.id },
      body: {
        ...treatmentUpdateBodyOf(fields, { fromPackage: treatment.packageId !== null }),
        expected_updated_at: treatment.updatedAt,
      },
      idempotencyKey,
    },
  );
  return toTreatmentRecord(treatmentWire.parse(response.data));
}

/**
 * Reverse a session with its reason (1–280): it stays in the file, marked reversed, and a
 * package session it spent comes back. Final — there is no way back.
 */
export async function reverseTreatment({
  treatment,
  reason,
  idempotencyKey,
}: {
  treatment: TreatmentRecord;
  reason: string;
  idempotencyKey: string;
}): Promise<TreatmentRecord> {
  const response = await api.post(
    '/app/patients/{patient_id}/treatments/{patient_treatment_id}/reverse',
    {
      params: { patient_id: treatment.patientId, patient_treatment_id: treatment.id },
      body: { reason },
      idempotencyKey,
    },
  );
  return toTreatmentRecord(treatmentWire.parse(response.data));
}
