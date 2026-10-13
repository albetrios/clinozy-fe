import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';
import { kebabCase } from '@/lib/kebab-case.ts';
import type { FeedbackActionKind } from '@/shared/api/app/app-schema.ts';

import type { ClinicalField } from '../shared/patient-clinical.ts';

/** Clinical notes read the patient file's namespace. */
export const CLINICAL_NS = I18N_NAMESPACES.patientFile;

/** The chip cards' copy (`patient-file.md:52–56`), verbatim. */
export const CLINICAL_KEYS = {
  titles: {
    complaints: 'clinical.titles.complaints',
    diagnosis: 'clinical.titles.diagnosis',
    treatmentSuggestions: 'clinical.titles.treatmentSuggestions',
    futureSuggestions: 'clinical.titles.futureSuggestions',
  },
  /** "1 new" (plural). */
  newCount: 'clinical.newCount',
  newHint: 'clinical.newHint',
  empty: 'clinical.empty',
  placeholder: 'clinical.placeholder',
  /** "Add Complaints" — the input's name. */
  add: 'clinical.add',
  /** "Remove Tanning on face". */
  remove: 'clinical.remove',
  /** "Tanning on face removed" — its toast, with Undo (Q24). */
  removed: 'clinical.removed',
} as const satisfies Record<string, unknown>;

/** The Feedback card's copy (`patient-file.md:52–56`; KICKOFF §6.6 Feedback), verbatim. */
export const FEEDBACK_KEYS = {
  title: 'feedback.title',
  log: 'feedback.log',
  typesLabel: 'feedback.typesLabel',
  types: {
    all: 'feedback.types.all',
    visit: 'feedback.types.visit',
    treatment: 'feedback.types.treatment',
  },
  previous: 'feedback.previous',
  next: 'feedback.next',
  emptyTitle: 'feedback.emptyTitle',
  emptySub: 'feedback.emptySub',
  notRated: 'feedback.notRated',
  score: 'feedback.score',
  stars: 'feedback.stars',
  trendUp: 'feedback.trendUp',
  trendDown: 'feedback.trendDown',
  trendSame: 'feedback.trendSame',
  followed: 'feedback.followed',
  appointment: 'feedback.appointment',
  visitWith: 'feedback.visitWith',
  visit: 'feedback.visit',
  noVisit: 'feedback.noVisit',
  noNow: 'feedback.noNow',
  noText: 'feedback.noText',
  nextLabel: 'feedback.nextLabel',
  linkLabel: 'feedback.linkLabel',
  noNext: 'feedback.noNext',
  noLink: 'feedback.noLink',
  files: 'feedback.files',
  actions: 'feedback.actions',
  edit: 'feedback.edit',
  remove: 'feedback.remove',
  actionNeeded: 'feedback.actionNeeded',
  logAction: 'feedback.logAction',
  nextAction: 'feedback.nextAction',
  actionBy: 'feedback.actionBy',
  actionLogged: 'feedback.actionLogged',
  actionKinds: {
    doctor_called: 'feedback.actionKinds.doctor_called',
    asked_revisit: 'feedback.actionKinds.asked_revisit',
    free_review_booked: 'feedback.actionKinds.free_review_booked',
    plan_changed: 'feedback.actionKinds.plan_changed',
    replied_google: 'feedback.actionKinds.replied_google',
    replied_instagram: 'feedback.actionKinds.replied_instagram',
    replied_whatsapp: 'feedback.actionKinds.replied_whatsapp',
    refund_credit: 'feedback.actionKinds.refund_credit',
    other: 'feedback.actionKinds.other',
  } satisfies Record<FeedbackActionKind, string>,
  loadMore: 'feedback.loadMore',
  /** "6 more" (plural). */
  more: 'feedback.more',
  loading: 'feedback.loading',
  removeCheckIn: 'feedback.removeCheckIn',
  removeReview: 'feedback.removeReview',
  checkInRemoved: 'feedback.checkInRemoved',
  reviewRemoved: 'feedback.reviewRemoved',
} as const;

/** The Log feedback picker's copy (H:4406–4409; KICKOFF §6.6 Drawers), verbatim. */
export const LOG_FEEDBACK_KEYS = {
  title: 'logFeedback.title',
  sub: 'logFeedback.sub',
  groups: {
    checkIn: 'logFeedback.groups.checkIn',
    treatment: 'logFeedback.groups.treatment',
    review: 'logFeedback.groups.review',
  },
  consultation: 'logFeedback.consultation',
  after: 'logFeedback.after',
  close: 'logFeedback.close',
  /** Each chip's line on hover (H:4406): what that record holds. */
  hints: {
    consultation: 'logFeedback.hints.consultation',
    google: 'logFeedback.hints.google',
    video: 'logFeedback.hints.video',
    other: 'logFeedback.hints.other',
  },
} as const;

/** Clinical notes' test ids. */
export const OVERVIEW_TEST_IDS = {
  /** `clinical-card-complaints`, `…-treatment-suggestions`. */
  chipCard: (field: ClinicalField) => `clinical-card-${kebabCase(field)}`,
  feedback: 'feedback-card',
  logFeedback: 'log-feedback-picker',
} as const;
