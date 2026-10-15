import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

/** The check-in drawer reads the patient file's namespace. */
export const CHECK_IN_NS = I18N_NAMESPACES.patientFile;

/** The check-in drawer's copy (`patient-file.md:171–187, 383–390`; KICKOFF §6.6), verbatim. */
export const CHECK_IN_KEYS = {
  titles: {
    visit: 'checkIn.titles.visit',
    aftercare: 'checkIn.titles.aftercare',
  },
  /** "last check-in 24 Sep: Same". */
  last: 'checkIn.last',
  steps: {
    now: 'checkIn.steps.now',
    followed: 'checkIn.steps.followed',
    next: 'checkIn.steps.next',
  },
  feel: 'checkIn.feel',
  score: 'checkIn.score',
  scoreHint: 'checkIn.scoreHint',
  words: 'checkIn.words',
  wordsLast: 'checkIn.wordsLast',
  wordsPlaceholder: 'checkIn.wordsPlaceholder',
  /** "Followed the advice"; its values are `followedLabel` (`../../patient-feedback.ts`). */
  followed: 'checkIn.followed',
  details: 'checkIn.details',
  detailsLast: 'checkIn.detailsLast',
  detailsPlaceholder: 'checkIn.detailsPlaceholder',
  /** The chip under Details that writes last time's plan (feat-write-less). */
  useAdvised: 'checkIn.useAdvised',
  plan: 'checkIn.plan',
  planPlaceholder: 'checkIn.planPlaceholder',
  /** The chip under Next plan that writes last time's plan again (feat-write-less). */
  samePlan: 'checkIn.samePlan',
  offerings: 'checkIn.offerings',
  offeringsHint: 'checkIn.offeringsHint',
  offeringsPlaceholder: 'checkIn.offeringsPlaceholder',
  /** An offering's sub line: "₹4,800 · 7 sessions" (plural). */
  offeringSessions: 'checkIn.offeringSessions',
  /** An edit's offerings, read-only — the plan changes in the plan (TR10). */
  offeringsPlanned: 'checkIn.offeringsPlanned',
  save: 'checkIn.save',
  saveEdit: 'checkIn.saveEdit',
  noFeel: 'checkIn.noFeel',
  /** A score is required, 1–10 (Q18). */
  noScore: 'checkIn.noScore',
  /** "Check-in saved for Dharti Galani". */
  saved: 'checkIn.saved',
  /** " · 2 added to suggestions". */
  added: 'checkIn.added',
  /** " · doctor call-back task created". */
  callBack: 'checkIn.callBack',
  updated: 'checkIn.updated',
  /** The record's name in "Check-in not found · it may have been deleted". */
  record: 'checkIn.record',
} as const;

/** The drawer's root test id. */
export const CHECK_IN_TEST_ID = 'check-in-drawer';
