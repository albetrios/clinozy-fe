import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import {
  CHECKIN_FEEL_VALUES,
  CHECKIN_FOLLOWED_VALUES,
  type CheckinFeel,
  type CheckinFollowed,
  FEEDBACK_ACTION_VALUES,
  type FeedbackActionKind,
  type OfferingCategory,
  REVIEW_SOURCE_VALUES,
  type ReviewSource,
  type Tone,
} from './clinic-schema.ts';
import { type OfferingRecord, offeringsByName } from './offerings-contracts.ts';

/*
 * The patient file's feedback on clinozy-be (api-integration §5.4): a patient's check-ins
 * (`/app/patients/:patient_id/check-ins`) and reviews (`…/reviews`), each with the follow-ups
 * logged on it embedded (`actions`). What needs action and how a score moved are the server's
 * (`needs_action`, `score_change`; §7); so are the call-back task a bad one opens and the plan
 * rows a check-in's next offerings become (TR4, TR10) — the client sets off neither.
 */

/** The drawers' limits — the design's, inside the API's (`current_state` and `next_plan` 500, `followed_note` 280, a review's `text` 2,000, `link` 500). */
export const FEEDBACK_LIMITS = {
  now: 400,
  followedNote: 280,
  nextPlan: 400,
  /** Offerings a new check-in puts in the plan (TR10). */
  offerings: 10,
  reviewText: 600,
  link: 200,
  /** Files on one review. */
  files: 10,
} as const;

/** How many feedback cards the carousel shows before "Load more" shows six more. */
export const FEEDBACK_PAGE_SIZE = 6;

/**
 * One of the Feedback card's type chips (H:4390): every card, the visit and
 * the treatment check-ins, then each review source.
 */
export type FeedbackType = 'all' | 'visit' | 'treatment' | ReviewSource;

/** A follow-up logged on a check-in or a review — the green "✓ Doctor called · Riya" pill. */
interface FeedbackLoggedAction {
  id: string;
  action: FeedbackActionKind;
  note: string | null;
  /** Who logged it — a membership id (`mem_…`), the team names it. */
  authorId: string | null;
  /** When it was logged (ISO). */
  at: string;
}

/** A check-in as the file reads it. */
export interface PatientCheckIn {
  id: string;
  patientId: string;
  /** The visit it was taken at. */
  appointmentId: string | null;
  /** The treatment session it follows — an aftercare check-in. */
  treatmentId: string | null;
  /** What it follows, in words — "After LHR Full Face", "Visit · 10 Oct" (the server's, TR9). */
  context: string;
  feel: CheckinFeel;
  /** 1–10 (Q18). */
  score: number;
  /** Against the patient's check-in before it (the server's, §7); null for the first. */
  scoreChange: number | null;
  followed: CheckinFollowed | null;
  followedNote: string | null;
  /** How it is now, in their words. */
  currentState: string | null;
  nextPlan: string | null;
  /** The offerings it put in the plan as Planned (TR10). */
  nextOfferingIds: string[];
  /** `YYYY-MM-DD`. */
  date: string;
  /** Worse, or a score of 4 or less, with nothing logged yet (the server's, TR9). */
  needsAction: boolean;
  /** The follow-ups logged on it, newest first. */
  actions: FeedbackLoggedAction[];
  createdAt: string;
  updatedAt: string;
}

/** A review as the file reads it. */
export interface PatientReview {
  id: string;
  patientId: string;
  appointmentId: string | null;
  source: ReviewSource;
  /** 1–5; none for a review that was never rated. */
  rating: number | null;
  text: string | null;
  link: string | null;
  /** The confirmed uploads on it — no way to read one back yet (B1). */
  fileKeys: string[];
  /** `YYYY-MM-DD`. */
  date: string;
  /** A rating of 3 or less with nothing logged yet (the server's, TR11). */
  needsAction: boolean;
  /** The follow-ups logged on it, newest first. */
  actions: FeedbackLoggedAction[];
  createdAt: string;
  updatedAt: string;
}

/** One card of the Feedback carousel. */
export type FeedbackItem =
  | { kind: 'checkIn'; id: string; checkIn: PatientCheckIn }
  | { kind: 'review'; id: string; review: PatientReview };

/** Which of the two a card is — the route its writes take. */
export type FeedbackKind = FeedbackItem['kind'];

/** An offering a new check-in can put in the plan — the drawer's "Add to offering suggestions". */
export interface CheckInOffering {
  id: string;
  name: string;
  category: OfferingCategory;
  tone: Tone;
  /** Rupees, as the API sends them. */
  price: number;
  sessions: number;
  searchTerms: string[];
  isActive: boolean;
}

/** What the check-in drawer heads with besides the record (H:4396). */
export interface CheckInContext {
  /** The patient's check-in before this one — "last check-in 24 Sep: Same" and the placeholders. */
  previous: PatientCheckIn | null;
  /** The treatment an aftercare check-in follows. */
  treatmentName: string | null;
  /** The visit it was taken at: its service. */
  visitService: string | null;
}

// ── Writes ──

/** A check-in's own fields — what the drawer writes, a new one and an edit alike. */
export interface CheckInFields {
  feel: CheckinFeel;
  /** 1–10 (Q18). */
  score: number;
  currentState: string | null;
  followed: CheckinFollowed | null;
  followedNote: string | null;
  nextPlan: string | null;
}

/**
 * A new check-in: its fields, the visit and the treatment it follows, its day and the offerings
 * it puts in the plan — on a create only (TR10). The server words its `context` (TR9).
 */
export interface CheckInCreateInput extends CheckInFields {
  appointmentId: string | null;
  treatmentId: string | null;
  date: string;
  nextOfferingIds: string[];
}

/** A review's own fields — what the drawer writes. */
export interface ReviewFields {
  source: ReviewSource;
  rating: number | null;
  text: string | null;
  link: string | null;
}

/** A new review: its fields, the visit it follows and its day. Its files follow (`attachReviewFile`). */
export interface ReviewCreateInput extends ReviewFields {
  appointmentId: string | null;
  date: string;
}

/** A check-in change as `PATCH …/check-ins/:patient_check_in_id` takes it. */
type ApiCheckInChange = NonNullable<
  ApiBody<'/app/patients/{patient_id}/check-ins/{patient_check_in_id}', 'patch'>
>;

/** A review change as `PATCH …/reviews/:patient_review_id` takes it. */
type ApiReviewChange = NonNullable<
  ApiBody<'/app/patients/{patient_id}/reviews/{patient_review_id}', 'patch'>
>;

/** The check-in fields as the API names them. */
export function checkInBodyOf(fields: CheckInFields) {
  return {
    feel: fields.feel,
    score: fields.score,
    current_state: fields.currentState,
    followed: fields.followed,
    followed_note: fields.followedNote,
    next_plan: fields.nextPlan,
  } satisfies ApiCheckInChange;
}

/** The review fields as the API names them. */
export function reviewBodyOf(fields: ReviewFields) {
  return {
    source: fields.source,
    rating: fields.rating,
    text: fields.text,
    link: fields.link,
  } satisfies ApiReviewChange;
}

// ── The wire ──

type ApiCheckInRow = NonNullable<
  ApiData<'/app/patients/{patient_id}/check-ins', 'get'>
>[number];
type ApiCheckIn = NonNullable<
  ApiData<'/app/patients/{patient_id}/check-ins/{patient_check_in_id}', 'get'>
>;
type ApiReviewRow = NonNullable<
  ApiData<'/app/patients/{patient_id}/reviews', 'get'>
>[number];
type ApiReview = NonNullable<
  ApiData<'/app/patients/{patient_id}/reviews/{patient_review_id}', 'get'>
>;

const actionWire = z.object({
  id: z.string(),
  action: z.enum(FEEDBACK_ACTION_VALUES),
  note: z.string().nullable(),
  author_membership_id: z.string().nullable(),
  created_at: z.string(),
});

const checkInFieldsWire = {
  id: z.string(),
  patient_id: z.string(),
  appointment_id: z.string().nullable(),
  patient_treatment_id: z.string().nullable(),
  context: z.string(),
  feel: z.enum(CHECKIN_FEEL_VALUES),
  score: z.number().int(),
  score_change: z.number().int().nullable(),
  followed: z.enum(CHECKIN_FOLLOWED_VALUES).nullable(),
  followed_note: z.string().nullable(),
  current_state: z.string().nullable(),
  next_plan: z.string().nullable(),
  next_offering_ids: z.array(z.string()),
  check_in_date: z.string(),
  needs_action: z.boolean(),
  actions: z.array(actionWire),
  created_at: z.string(),
  updated_at: z.string(),
};

const reviewFieldsWire = {
  id: z.string(),
  patient_id: z.string(),
  appointment_id: z.string().nullable(),
  source: z.enum(REVIEW_SOURCE_VALUES),
  rating: z.number().int().nullable(),
  text: z.string().nullable(),
  link: z.string().nullable(),
  file_keys: z.array(z.string()),
  review_date: z.string(),
  needs_action: z.boolean(),
  actions: z.array(actionWire),
  created_at: z.string(),
  updated_at: z.string(),
};

/** A check-in list row (`GET …/check-ins`). */
export const checkInRowWire = wireSchema<ApiCheckInRow>()(z.object(checkInFieldsWire));

/** One check-in (`GET …/check-ins/:patient_check_in_id`, and every write's answer). */
export const checkInWire = wireSchema<ApiCheckIn>()(z.object(checkInFieldsWire));

/** A review list row (`GET …/reviews`). */
export const reviewRowWire = wireSchema<ApiReviewRow>()(z.object(reviewFieldsWire));

/** One review (`GET …/reviews/:patient_review_id`, and every write's answer). */
export const reviewWire = wireSchema<ApiReview>()(z.object(reviewFieldsWire));

function toLoggedAction(row: z.output<typeof actionWire>): FeedbackLoggedAction {
  return {
    id: row.id,
    action: row.action,
    note: row.note,
    authorId: row.author_membership_id,
    at: row.created_at,
  };
}

/** A check-in as the file reads it. */
export function toPatientCheckIn(row: z.output<typeof checkInRowWire>): PatientCheckIn {
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    treatmentId: row.patient_treatment_id,
    context: row.context,
    feel: row.feel,
    score: row.score,
    scoreChange: row.score_change,
    followed: row.followed,
    followedNote: row.followed_note,
    currentState: row.current_state,
    nextPlan: row.next_plan,
    nextOfferingIds: row.next_offering_ids,
    date: row.check_in_date,
    needsAction: row.needs_action,
    actions: row.actions.map(toLoggedAction),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** A review as the file reads it. */
export function toPatientReview(row: z.output<typeof reviewRowWire>): PatientReview {
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    source: row.source,
    rating: row.rating,
    text: row.text,
    link: row.link,
    fileKeys: row.file_keys,
    date: row.review_date,
    needsAction: row.needs_action,
    actions: row.actions.map(toLoggedAction),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The check-in drawer's offerings out of the clinic's one offerings catalogue (`useOfferings`),
 * active or not, A to Z — a new check-in offers the active ones, an edit names what it planned.
 */
export function checkInOfferingsOf(
  catalogue: readonly OfferingRecord[],
): CheckInOffering[] {
  return offeringsByName(catalogue).map(
    ({ id, name, category, tone, price, sessions, searchTerms, isActive }) => ({
      id,
      name,
      category,
      tone,
      price,
      sessions,
      searchTerms,
      isActive,
    }),
  );
}
