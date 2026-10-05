import { z } from 'zod';

import { PATIENT_FILE_SECTIONS } from '@/shared/clinic/patient-file-sections.ts';

import {
  checkinFeelSchema,
  civilDateSchema,
  clockTimeSchema,
  paiseSchema,
  phoneSchema,
  reviewSourceSchema,
} from './clinic-schema.ts';
import { patientRecordSchema } from './patients-contracts.ts';

/*
 * The patient file's own read beyond the contract (KICKOFF §6.6, D22): the
 * schema's `getPatient` answers "Patient + rail facts (next visit, dues,
 * feedback)" (`S:1629`) without naming their shape, so the plan's shape is
 * here — each a fixture field until clinozy-be serves it (Appendix F ›
 * Patient file, REPLACE_WITH_API): the lead's own number, the language, the
 * per-section counts and the thread's unread count.
 */

/** The patient's next visit — the rail's Up next card. */
const patientNextVisitSchema = z.object({
  appointmentId: z.uuid(),
  date: civilDateSchema,
  startTime: clockTimeSchema,
  serviceLabel: z.string(),
  durationMin: z.number().int().nonnegative(),
});

/** The next booked visit. */
export type PatientNextVisit = z.infer<typeof patientNextVisitSchema>;

/**
 * The rail's Feedback row: the latest check-in's feel and score ("Better ·
 * 7/10"), else the latest review, and how many of each there are.
 */
const patientFileFeedbackSchema = z.object({
  feel: checkinFeelSchema.nullable(),
  score: z.number().int().nonnegative().nullable(),
  review: z
    .object({
      source: reviewSourceSchema,
      rating: z.number().int().nonnegative().nullable(),
    })
    .nullable(),
  checkIns: z.number().int().nonnegative(),
  reviews: z.number().int().nonnegative(),
});

/** The rail's feedback summary. */
export type PatientFileFeedback = z.infer<typeof patientFileFeedbackSchema>;

/** Records per section — the section popover's "Has records" / "Empty" (table counts, Appendix F). */
const patientFileCountsSchema = z.record(
  z.enum(PATIENT_FILE_SECTIONS),
  z.number().int().nonnegative(),
);

/** Records per patient-file section. */
export type PatientFileCounts = z.infer<typeof patientFileCountsSchema>;

/**
 * Everything the file's bar, rail and section popover read in one call: the
 * patient; their lead's number when it differs from theirs ("Mobile · From
 * lead"); an Instagram handle and their language (backend requests); the next
 * visit; what they owe across open invoices (integer paise) and since when;
 * what the clinic holds to give back (open "give" credits); the feedback
 * summary; the per-section counts; their thread's unread messages.
 */
export const patientFileSchema = z.object({
  patient: patientRecordSchema,
  leadPhone: phoneSchema.nullable(),
  instagram: z.string().nullable(),
  language: z.string().nullable(),
  nextVisit: patientNextVisitSchema.nullable(),
  due: paiseSchema,
  /** The oldest open invoice's date — "since 12 days". */
  dueSince: civilDateSchema.nullable(),
  /** Open "give" credits: the total to return and each one's reason; none when nothing is held. */
  credit: z.object({ amount: paiseSchema, reasons: z.array(z.string()) }).nullable(),
  feedback: patientFileFeedbackSchema,
  counts: patientFileCountsSchema,
  unread: z.number().int().nonnegative(),
});

/** The patient file's read. */
export type PatientFile = z.infer<typeof patientFileSchema>;
