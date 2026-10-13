import type { CheckinFeel, ReviewSource } from './app-schema.ts';
import type { PatientRecord } from './patients-contracts.ts';

/*
 * The patient file's own read on clinozy-be (api-integration §5.4): the patient with their
 * person, and what the file bar and the rail show beside them — the next visit (the contact's
 * preview), the Instagram handle and the language (the person's), the latest feedback (the
 * newest check-in and review). Dues, credit, per-section counts and an unread count have no
 * read yet (G4); the rail and the section popover go without them.
 */

/** The patient's next visit — the rail's Up next card. */
export interface PatientNextVisit {
  appointmentId: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `HH:mm`. */
  startTime: string;
  serviceLabel: string;
}

/**
 * The rail's Feedback row: the latest check-in's feel and score ("Better · 7/10"), else the
 * latest review, and how many of each there are.
 */
export interface PatientFileFeedback {
  feel: CheckinFeel | null;
  score: number | null;
  review: { source: ReviewSource; rating: number | null } | null;
  checkIns: number;
  reviews: number;
}

/** The languages a person can ask for — their preference tags of that kind. */
export const PATIENT_LANGUAGE_TAGS = ['gujarati', 'hindi', 'english'] as const;

/** One language tag. */
export type PatientLanguage = (typeof PATIENT_LANGUAGE_TAGS)[number];

/** Everything the file's bar and rail read in one go. */
export interface PatientFile {
  patient: PatientRecord;
  /** The person's first Instagram handle. */
  instagram: string | null;
  /** The language the person asked for — their first Gujarati · Hindi · English tag. */
  language: PatientLanguage | null;
  nextVisit: PatientNextVisit | null;
  feedback: PatientFileFeedback;
  /** Their last message is newer than ours — the Activity badge's dot. */
  awaitingReply: boolean;
}
