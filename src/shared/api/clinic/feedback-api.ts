import { z } from 'zod';

import { api } from '@/core/http/api.ts';
import { collectAllPages } from '@/shared/api/fetch-all-pages.ts';

import type { DeleteReason, FeedbackActionKind } from './clinic-schema.ts';
import {
  checkInBodyOf,
  type CheckInCreateInput,
  type CheckInFields,
  type CheckInOffering,
  checkInOfferingWire,
  checkInRowWire,
  checkInWire,
  type FeedbackItem,
  type FeedbackKind,
  type PatientCheckIn,
  type PatientReview,
  reviewBodyOf,
  type ReviewCreateInput,
  type ReviewFields,
  reviewRowWire,
  reviewWire,
  toCheckInOffering,
  toPatientCheckIn,
  toPatientReview,
} from './feedback-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * The patient file's feedback on clinozy-be (api-integration §5.4): `…/check-ins` and
 * `…/reviews` under the patient, each record with its follow-ups embedded. A write sets off
 * the rest server-side — the doctor call-back a bad check-in or a low review opens, the plan
 * rows a new check-in's next offerings become (TR4, TR10) — so nothing here writes a task or a
 * suggestion. Read `patient:read`, write `patient:update`.
 */

/** TanStack Query keys for feedback — under the patients' key, scoped to the organization. */
export const feedbackQueryKeys = {
  all: [...patientQueryKeys.all, 'feedback'] as const,
  /** Every check-in and review of a patient — the Feedback card. */
  patient: (organizationId: string | null, patientId: string) =>
    [...feedbackQueryKeys.all, organizationId, 'patient', patientId] as const,
  checkIn: (organizationId: string | null, checkInId: string) =>
    [...feedbackQueryKeys.all, organizationId, 'check-in', checkInId] as const,
  review: (organizationId: string | null, reviewId: string) =>
    [...feedbackQueryKeys.all, organizationId, 'review', reviewId] as const,
  /** The check-in before a new one (`editingId` ''), or before the one being edited. */
  previous: (organizationId: string | null, patientId: string, editingId: string) =>
    [...feedbackQueryKeys.all, organizationId, 'previous', patientId, editingId] as const,
  /** The offerings a new check-in can plan. */
  offerings: (organizationId: string | null) =>
    [...feedbackQueryKeys.all, organizationId, 'offerings'] as const,
};

/** The most rows the API sends a page — the card reads every page of a patient's feedback. */
const PAGE_SIZE = 100;

/** How many of the newest check-ins the drawer looks through for the one before (same-day ones). */
const PREVIOUS_LOOKBACK = 10;

/** The next page's cursor, or null on the last. */
function nextCursor(
  pagination: { has_more?: boolean; next?: string | null } | undefined,
) {
  return pagination?.has_more ? (pagination.next ?? null) : null;
}

/** Newest first: the day, then when it was logged (both ISO, so text order is time order). */
function newestFirst(
  a: { date: string; createdAt: string },
  b: { date: string; createdAt: string },
): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt < b.createdAt ? 1 : -1;
}

/** A card's record — the day and the logging time its order reads. */
const recordOf = (item: FeedbackItem) =>
  item.kind === 'checkIn' ? item.checkIn : item.review;

// ── Reads ──

/** Every check-in of a patient, newest first (`GET …/check-ins`, every page). */
async function listCheckIns(patientId: string): Promise<PatientCheckIn[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/patients/{patient_id}/check-ins', {
      params: { patient_id: patientId },
      query: {
        sort: 'check_in_date',
        order: 'desc',
        limit: PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return {
      rows: z
        .array(checkInRowWire)
        .parse(response.data ?? [])
        .map(toPatientCheckIn),
      next: nextCursor(response.meta?.pagination),
    };
  }, 'patient-check-ins');
}

/** Every review of a patient, newest first (`GET …/reviews`, every page). */
async function listReviews(patientId: string): Promise<PatientReview[]> {
  return collectAllPages(async (after) => {
    const response = await api.get('/app/patients/{patient_id}/reviews', {
      params: { patient_id: patientId },
      query: {
        sort: 'review_date',
        order: 'desc',
        limit: PAGE_SIZE,
        after: after ?? undefined,
      },
    });
    return {
      rows: z
        .array(reviewRowWire)
        .parse(response.data ?? [])
        .map(toPatientReview),
      next: nextCursor(response.meta?.pagination),
    };
  }, 'patient-reviews');
}

/**
 * Every feedback card of a patient — the check-ins and the reviews, newest first. The card
 * shows them all (its type chips and "Load more" work on what is read), so every page is read.
 */
export async function listPatientFeedback(patientId: string): Promise<FeedbackItem[]> {
  const [checkIns, reviews] = await Promise.all([
    listCheckIns(patientId),
    listReviews(patientId),
  ]);
  const items: FeedbackItem[] = [
    ...checkIns.map((checkIn) => ({ kind: 'checkIn' as const, id: checkIn.id, checkIn })),
    ...reviews.map((review) => ({ kind: 'review' as const, id: review.id, review })),
  ];
  return items.sort((a, b) => newestFirst(recordOf(a), recordOf(b)));
}

/** One check-in — a 404 when it is unknown or removed. */
export async function fetchCheckIn(
  patientId: string,
  checkInId: string,
): Promise<PatientCheckIn> {
  const response = await api.get(
    '/app/patients/{patient_id}/check-ins/{patient_check_in_id}',
    { params: { patient_id: patientId, patient_check_in_id: checkInId } },
  );
  return toPatientCheckIn(checkInWire.parse(response.data));
}

/** One review — a 404 when it is unknown or removed. */
export async function fetchReview(
  patientId: string,
  reviewId: string,
): Promise<PatientReview> {
  const response = await api.get(
    '/app/patients/{patient_id}/reviews/{patient_review_id}',
    {
      params: { patient_id: patientId, patient_review_id: reviewId },
    },
  );
  return toPatientReview(reviewWire.parse(response.data));
}

/**
 * The patient's check-in before a new one — or, given the one being edited, before that one:
 * the newest few up to its day (`check_in_date_to`), the latest of them logged earlier.
 */
export async function fetchPreviousCheckIn(
  patientId: string,
  editing: Pick<PatientCheckIn, 'id' | 'date' | 'createdAt'> | null,
): Promise<PatientCheckIn | null> {
  const response = await api.get('/app/patients/{patient_id}/check-ins', {
    params: { patient_id: patientId },
    query: {
      sort: 'check_in_date',
      order: 'desc',
      limit: PREVIOUS_LOOKBACK,
      check_in_date_to: editing?.date,
    },
  });
  const earlier = z
    .array(checkInRowWire)
    .parse(response.data ?? [])
    .map(toPatientCheckIn)
    .filter((row) => !editing || (row.id !== editing.id && newestFirst(editing, row) < 0))
    .sort(newestFirst);
  return earlier[0] ?? null;
}

/**
 * The clinic's offerings, by name (`GET /app/offerings`, every page) — a new check-in's
 * "Add to offering suggestions" offers the active ones; an edit names the ones it planned.
 */
export async function listCheckInOfferings(): Promise<CheckInOffering[]> {
  const rows = await collectAllPages(async (after) => {
    const response = await api.get('/app/offerings', {
      query: { sort: 'name', order: 'asc', limit: PAGE_SIZE, after: after ?? undefined },
    });
    return {
      rows: z.array(checkInOfferingWire).parse(response.data ?? []),
      next: nextCursor(response.meta?.pagination),
    };
  }, 'check-in-offerings');
  return rows.map(toCheckInOffering);
}

// ── Writes ──

/**
 * Log a check-in (`POST …/check-ins`): its fields, the visit and the session it follows, its day
 * and the offerings to plan. The server words its `context` (TR9), plans the offerings (one the
 * plan holds is skipped, TR10) and — Worse or a score of 4 or less — opens the doctor call-back.
 */
export async function createCheckIn({
  patientId,
  input,
  idempotencyKey,
}: {
  patientId: string;
  input: CheckInCreateInput;
  idempotencyKey: string;
}): Promise<PatientCheckIn> {
  const response = await api.post('/app/patients/{patient_id}/check-ins', {
    params: { patient_id: patientId },
    body: {
      ...checkInBodyOf(input),
      appointment_id: input.appointmentId,
      patient_treatment_id: input.treatmentId,
      check_in_date: input.date,
      next_offering_ids: input.nextOfferingIds,
    },
    idempotencyKey,
  });
  return toPatientCheckIn(checkInWire.parse(response.data));
}

/**
 * Change a check-in (`PATCH …/check-ins/:patient_check_in_id`) — refused as stale
 * (`409 record_changed`) when someone saved it since `expectedUpdatedAt`. Its next offerings
 * stay as planned: the plan changes in the plan (TR10).
 */
export async function updateCheckIn({
  patientId,
  checkInId,
  fields,
  expectedUpdatedAt,
  idempotencyKey,
}: {
  patientId: string;
  checkInId: string;
  fields: CheckInFields;
  expectedUpdatedAt: string;
  idempotencyKey: string;
}): Promise<PatientCheckIn> {
  const response = await api.patch(
    '/app/patients/{patient_id}/check-ins/{patient_check_in_id}',
    {
      params: { patient_id: patientId, patient_check_in_id: checkInId },
      body: { ...checkInBodyOf(fields), expected_updated_at: expectedUpdatedAt },
      idempotencyKey,
    },
  );
  return toPatientCheckIn(checkInWire.parse(response.data));
}

/**
 * Log a review (`POST …/reviews`) — a rating of 3 or less opens the doctor call-back
 * server-side. Its files follow through the upload tray (`attachReviewFile`).
 */
export async function createReview({
  patientId,
  input,
  idempotencyKey,
}: {
  patientId: string;
  input: ReviewCreateInput;
  idempotencyKey: string;
}): Promise<PatientReview> {
  const response = await api.post('/app/patients/{patient_id}/reviews', {
    params: { patient_id: patientId },
    body: {
      ...reviewBodyOf(input),
      appointment_id: input.appointmentId,
      review_date: input.date,
    },
    idempotencyKey,
  });
  return toPatientReview(reviewWire.parse(response.data));
}

/** Change a review (`PATCH …/reviews/:patient_review_id`) — stale-checked like a check-in. */
export async function updateReview({
  patientId,
  reviewId,
  fields,
  expectedUpdatedAt,
  idempotencyKey,
}: {
  patientId: string;
  reviewId: string;
  fields: ReviewFields;
  expectedUpdatedAt: string;
  idempotencyKey: string;
}): Promise<PatientReview> {
  const response = await api.patch(
    '/app/patients/{patient_id}/reviews/{patient_review_id}',
    {
      params: { patient_id: patientId, patient_review_id: reviewId },
      body: { ...reviewBodyOf(fields), expected_updated_at: expectedUpdatedAt },
      idempotencyKey,
    },
  );
  return toPatientReview(reviewWire.parse(response.data));
}

/** Each review's file attaches, run one after another — a PATCH sends the whole list. */
const attaching = new Map<string, Promise<unknown>>();

/**
 * File an uploaded file on a review — the key the upload tray confirmed. `file_keys` is the
 * whole list, so each attach reads the review and adds its key (a key already on it is not
 * added twice), one review's attaches in turn so two finishing together never drop each other.
 */
export function attachReviewFile({
  patientId,
  reviewId,
  fileKey,
}: {
  patientId: string;
  reviewId: string;
  fileKey: string;
}): Promise<PatientReview> {
  const before = attaching.get(reviewId) ?? Promise.resolve();
  const attach = before
    .catch(() => undefined)
    .then(async () => {
      const review = await fetchReview(patientId, reviewId);
      if (review.fileKeys.includes(fileKey)) return review;
      const response = await api.patch(
        '/app/patients/{patient_id}/reviews/{patient_review_id}',
        {
          params: { patient_id: patientId, patient_review_id: reviewId },
          body: {
            file_keys: [...review.fileKeys, fileKey],
            expected_updated_at: review.updatedAt,
          },
        },
      );
      return toPatientReview(reviewWire.parse(response.data));
    });
  attaching.set(reviewId, attach);
  void attach
    .finally(() => {
      if (attaching.get(reviewId) === attach) attaching.delete(reviewId);
    })
    .catch(() => undefined);
  return attach;
}

/** Remove a check-in or a review with the confirm's reason (`DELETE`; `other` carries a note). */
export async function deleteFeedback({
  patientId,
  kind,
  id,
  reason,
  note,
}: {
  patientId: string;
  kind: FeedbackKind;
  id: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  const why = { reason, note: note ?? undefined };
  if (kind === 'checkIn') {
    await api.delete('/app/patients/{patient_id}/check-ins/{patient_check_in_id}', {
      params: { patient_id: patientId, patient_check_in_id: id },
      ...why,
    });
    return;
  }
  await api.delete('/app/patients/{patient_id}/reviews/{patient_review_id}', {
    params: { patient_id: patientId, patient_review_id: id },
    ...why,
  });
}

/** Bring a removed check-in or review back — its toast's Undo (`POST …/restore`). */
export async function restoreFeedback({
  patientId,
  kind,
  id,
  idempotencyKey,
}: {
  patientId: string;
  kind: FeedbackKind;
  id: string;
  idempotencyKey: string;
}): Promise<void> {
  if (kind === 'checkIn') {
    await api.post('/app/patients/{patient_id}/check-ins/{patient_check_in_id}/restore', {
      params: { patient_id: patientId, patient_check_in_id: id },
      idempotencyKey,
    });
    return;
  }
  await api.post('/app/patients/{patient_id}/reviews/{patient_review_id}/restore', {
    params: { patient_id: patientId, patient_review_id: id },
    idempotencyKey,
  });
}

/**
 * Log the follow-up on a card ("✓ Doctor called · logged"; `POST …/actions`) — the first one
 * clears its `needs_action`. `other` needs a note (the API refuses one without).
 */
export async function logFeedbackAction({
  patientId,
  kind,
  id,
  action,
  note,
  idempotencyKey,
}: {
  patientId: string;
  kind: FeedbackKind;
  id: string;
  action: FeedbackActionKind;
  note: string | null;
  idempotencyKey: string;
}): Promise<void> {
  const body = { action, note: note ?? undefined };
  if (kind === 'checkIn') {
    await api.post('/app/patients/{patient_id}/check-ins/{patient_check_in_id}/actions', {
      params: { patient_id: patientId, patient_check_in_id: id },
      body,
      idempotencyKey,
    });
    return;
  }
  await api.post('/app/patients/{patient_id}/reviews/{patient_review_id}/actions', {
    params: { patient_id: patientId, patient_review_id: id },
    body,
    idempotencyKey,
  });
}
