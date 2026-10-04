import { z } from 'zod';

import {
  type CheckIn,
  checkinFeelSchema,
  checkinFollowedSchema,
  civilDateSchema,
  type FeedbackActionKind,
  feedbackActionKindSchema,
  type Review,
  type ReviewSource,
  reviewSourceSchema,
  type Tone,
} from './clinic-schema.ts';

/*
 * The patient file's feedback — check-ins, reviews and the actions logged on
 * them (`listFeedback`, `createCheckIn`, `createReview`, `logFeedbackAction`;
 * `S:1636, 1648–1650`; KICKOFF §6.6 Feedback, the check-in and review
 * drawers).
 */

/** The drawers' limits (`patient-file.md:171–200`; inside the contract's, `S:500–530`). */
export const FEEDBACK_LIMITS = {
  /** `context` ("Day-2 call after LHR"), `S:510`. */
  context: 80,
  now: 400,
  followedNote: 300,
  nextPlan: 400,
  /** Offerings a check-in adds to the suggestions. */
  offerings: 10,
  reviewText: 600,
  link: 200,
  files: 10,
} as const;

/** How many feedback cards a page holds — "Load more" adds as many (`S:1636`). */
export const FEEDBACK_PAGE_SIZE = 6;

/**
 * A check-in as the drawer saves it (`createCheckIn`, `S:1648`). `score` is
 * required in the contract (`S:512`) and optional in the drawer: 0 stands
 * for "not rated" until the contract takes none (AMBER A-F12).
 */
export const checkInInputSchema = z.object({
  patientId: z.uuid(),
  appointmentId: z.uuid().nullable(),
  treatmentId: z.uuid().nullable(),
  context: z.string().trim().min(1).max(FEEDBACK_LIMITS.context),
  feel: checkinFeelSchema,
  score: z.number().int().min(0).max(10),
  followed: checkinFollowedSchema.nullable(),
  followedNote: z.string().trim().max(FEEDBACK_LIMITS.followedNote).nullable(),
  now: z.string().trim().max(FEEDBACK_LIMITS.now).nullable(),
  nextPlan: z.string().trim().max(FEEDBACK_LIMITS.nextPlan).nullable(),
  nextOfferingIds: z.array(z.uuid()).max(FEEDBACK_LIMITS.offerings),
  date: civilDateSchema,
});

/** A check-in's fields. */
export type CheckInInput = z.infer<typeof checkInInputSchema>;

/** A review as the drawer saves it (`createReview`, `S:1649`); a link must be https. */
export const reviewInputSchema = z.object({
  patientId: z.uuid(),
  appointmentId: z.uuid().nullable(),
  source: reviewSourceSchema,
  rating: z.number().int().min(1).max(5).nullable(),
  text: z.string().trim().max(FEEDBACK_LIMITS.reviewText).nullable(),
  link: z
    .string()
    .trim()
    .max(FEEDBACK_LIMITS.link)
    .regex(/^https:\/\/\S+$/, 'Add an https:// link')
    .nullable(),
  date: civilDateSchema,
});

/** A review's fields. */
export type ReviewInput = z.infer<typeof reviewInputSchema>;

/** A logged follow-up on negative feedback (`logFeedbackAction`, `S:1650`). */
export const feedbackActionInputSchema = z
  .object({
    checkInId: z.uuid().nullable(),
    reviewId: z.uuid().nullable(),
    action: feedbackActionKindSchema,
    note: z.string().trim().max(280).nullable(),
  })
  .refine((value) => (value.checkInId === null) !== (value.reviewId === null), {
    message: 'Log the action against one check-in or one review',
    path: ['checkInId'],
  });

/** A feedback action's fields. */
export type FeedbackActionInput = z.infer<typeof feedbackActionInputSchema>;

/**
 * One of the Feedback card's type chips (H:4390): every card, the visit and
 * the treatment check-ins, then each review source.
 */
export type FeedbackType = 'all' | 'visit' | 'treatment' | ReviewSource;

/** Who logged a card or an action: the 20px chip's initials, tone and first name. */
export interface FeedbackPerson {
  id: string;
  name: string;
  initials: string;
  tone: Tone;
}

/** The follow-up logged on a card — the green "✓ Doctor called · Riya" pill. */
export interface FeedbackLoggedAction {
  action: FeedbackActionKind;
  note: string | null;
  by: FeedbackPerson | null;
  /** When it was logged (ISO). */
  at: string;
}

/** A check-in card. */
export interface CheckInFeedback {
  kind: 'checkIn';
  id: string;
  date: string;
  checkIn: CheckIn;
  /** The treatment it follows — an aftercare check-in; null after a visit. */
  treatmentName: string | null;
  /** The visit it follows: its number and service ("Appt #2790"). */
  appointment: { seq: number; service: string | null } | null;
  /** The score of the check-in before it — the ▲ ▼ trend. */
  previousScore: number | null;
  /** Worse, or a score of 4 or less (`S:520`). */
  needsAction: boolean;
  action: FeedbackLoggedAction | null;
  by: FeedbackPerson | null;
}

/** A review card. */
export interface ReviewFeedback {
  kind: 'review';
  id: string;
  date: string;
  review: Review;
  appointment: { seq: number; service: string | null } | null;
  /** A rating of 3 or less (`S:538`). */
  needsAction: boolean;
  action: FeedbackLoggedAction | null;
  by: FeedbackPerson | null;
}

/** One card of the Feedback carousel. */
export type FeedbackItem = CheckInFeedback | ReviewFeedback;

/** A page of the Feedback card. */
export interface PatientFeedbackPage {
  /** The cards of the picked type, newest first, up to the page's limit. */
  items: FeedbackItem[];
  /** How many cards the picked type has. */
  total: number;
  /** "1 check-in · 1 review" — every type. */
  counts: { checkIns: number; reviews: number };
  /** The types this patient has a card of — the chips after "All". */
  types: FeedbackType[];
}

/** What the check-in drawer reads besides the record: the last check-in, the treatment, the visit. */
export interface CheckInContext {
  /** The latest check-in before this one — "last check-in 24 Sep: Same" and the placeholders. */
  previous: CheckIn | null;
  treatment: { id: string; name: string; doctorId: string | null } | null;
  appointment: { id: string; seq: number; service: string | null } | null;
}

/** A saved check-in and what it set off ("· 2 added to suggestions · doctor call-back task created"). */
export interface CheckInSaved {
  checkIn: CheckIn;
  suggestionsAdded: number;
  callBackCreated: boolean;
}

/** A saved review and whether it set off a call-back ("· call-back task created"). */
export interface ReviewSaved {
  review: Review;
  callBackCreated: boolean;
}
