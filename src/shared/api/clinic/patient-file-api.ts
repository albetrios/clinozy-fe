import { z } from 'zod';

import { api, type ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import { CHECKIN_FEEL_VALUES, REVIEW_SOURCE_VALUES } from './clinic-schema.ts';
import { fetchContact } from './contacts-api.ts';
import {
  PATIENT_LANGUAGE_TAGS,
  type PatientFile,
  type PatientFileFeedback,
  type PatientLanguage,
  type PatientNextVisit,
} from './patient-file-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';
import { patientWire, toPatientRecord } from './patients-contracts.ts';

/*
 * The patient file's read on clinozy-be (api-integration §5.4): the patient
 * (`GET /app/patients/:patient_id`), then — at once — their person with every number
 * (`GET /app/contacts/:contact_id`), the person's next booking from its preview
 * (`…/preview`, which answers without the numbers — M46) and the newest check-in and review,
 * whose totals the rail counts.
 */

/**
 * TanStack Query keys for the file's read — under the patients' key, so every patient write
 * (the Edit drawer, a record saved from the file) refreshes it.
 */
export const patientFileQueryKeys = {
  all: [...patientQueryKeys.all, 'file'] as const,
  detail: (organizationId: string | null, patientId: string) =>
    [...patientFileQueryKeys.all, organizationId, patientId] as const,
};

type ApiPreview = NonNullable<ApiData<'/app/contacts/{contact_id}/preview', 'get'>>;

const previewWire = wireSchema<ApiPreview>()(
  z.object({
    next_appointment: z
      .object({
        id: z.string(),
        appointment_date: z.string(),
        start_time: z.string(),
        service_label: z.string(),
      })
      .nullable(),
  }),
);

const latestCheckInWire = z.object({
  feel: z.enum(CHECKIN_FEEL_VALUES),
  score: z.number().int(),
});

const latestReviewWire = z.object({
  source: z.enum(REVIEW_SOURCE_VALUES),
  rating: z.number().int().nullable(),
});

/** The language a person asked for: their first language tag. */
function languageOf(tags: readonly string[]): PatientLanguage | null {
  return PATIENT_LANGUAGE_TAGS.find((language) => tags.includes(language)) ?? null;
}

/** The newest check-in and review, and how many of each there are. */
async function feedbackOf(patientId: string): Promise<PatientFileFeedback> {
  const [checkIns, reviews] = await Promise.all([
    api.get('/app/patients/{patient_id}/check-ins', {
      params: { patient_id: patientId },
      query: { limit: 1, sort: 'check_in_date', order: 'desc' },
    }),
    api.get('/app/patients/{patient_id}/reviews', {
      params: { patient_id: patientId },
      query: { limit: 1, sort: 'review_date', order: 'desc' },
    }),
  ]);
  const [checkIn] = z.array(latestCheckInWire).parse(checkIns.data ?? []);
  const [review] = z.array(latestReviewWire).parse(reviews.data ?? []);
  const total = (response: typeof checkIns | typeof reviews) =>
    response.meta?.pagination?.estimated_total ?? response.data?.length ?? 0;
  return {
    feel: checkIn?.feel ?? null,
    score: checkIn?.score ?? null,
    review: review ? { source: review.source, rating: review.rating } : null,
    checkIns: total(checkIns),
    reviews: total(reviews),
  };
}

/**
 * One patient's file: the record with their person, and the rail's facts — a 404 when the
 * patient is gone or in a branch the member cannot see.
 */
export async function fetchPatientFile(patientId: string): Promise<PatientFile> {
  const response = await api.get('/app/patients/{patient_id}', {
    params: { patient_id: patientId },
  });
  const patient = patientWire.parse(response.data);
  const [person, preview, feedback] = await Promise.all([
    fetchContact(patient.contact_id),
    api.get('/app/contacts/{contact_id}/preview', {
      params: { contact_id: patient.contact_id },
    }),
    feedbackOf(patientId),
  ]);
  const next = previewWire.parse(preview.data).next_appointment;
  const nextVisit: PatientNextVisit | null = next
    ? {
        appointmentId: next.id,
        date: next.appointment_date,
        startTime: next.start_time.slice(0, 5),
        serviceLabel: next.service_label,
      }
    : null;
  return {
    patient: toPatientRecord(patient, person),
    instagram: person.instagramHandles[0] ?? null,
    language: languageOf(person.preferenceTags),
    nextVisit,
    feedback,
    awaitingReply: person.isAwaitingReply,
  };
}
