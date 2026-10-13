import type { TFunction } from 'i18next';

import { displayId } from '@/shared/api/app/app-display-id.ts';
import type {
  CheckinFollowed,
  FeedbackActionKind,
  Tone,
} from '@/shared/api/app/app-schema.ts';
import type {
  FeedbackItem,
  FeedbackType,
  PatientCheckIn,
  PatientReview,
} from '@/shared/api/app/feedback-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import {
  CHECKIN_FEEL_TONES,
  CHECKIN_FOLLOWED_TONES,
  REVIEW_SOURCE_TONES,
} from '@/shared/app/app-tones.ts';
import {
  type AppIcon,
  Calendar,
  FileIcon,
  InstagramMark,
  Play,
  Search,
  Sparkles,
  WhatsAppMark,
} from '@/shared/icons/index.ts';

import { followedLabel, ratingTone } from '../../../shared/patient-feedback.ts';
import { FEEDBACK_KEYS } from '../../overview.constants.ts';

const K = FEEDBACK_KEYS;

/**
 * Each card type's tile (H:4389 `TY`): a visit check-in sage `Calendar`, a
 * treatment one mint `Sparkles`, then each review source in its tone.
 */
export const FEEDBACK_TYPE_LOOK: Readonly<
  Record<Exclude<FeedbackType, 'all'>, { tone: Tone; icon: AppIcon }>
> = {
  visit: { tone: 'sage', icon: Calendar },
  treatment: { tone: 'mint', icon: Sparkles },
  google: { tone: REVIEW_SOURCE_TONES.google, icon: Search },
  video: { tone: REVIEW_SOURCE_TONES.video, icon: Play },
  instagram: { tone: REVIEW_SOURCE_TONES.instagram, icon: InstagramMark },
  internal_form: { tone: REVIEW_SOURCE_TONES.internal_form, icon: FileIcon },
  whatsapp: { tone: REVIEW_SOURCE_TONES.whatsapp, icon: WhatsAppMark },
};

/** The type chips after "All", in the card's order (H:4390). */
const CARD_TYPES = [
  'visit',
  'treatment',
  'google',
  'video',
  'instagram',
  'internal_form',
  'whatsapp',
] as const satisfies readonly Exclude<FeedbackType, 'all'>[];

/** Which type chip a card answers to: a review's source, a check-in after a session or a visit. */
export function feedbackTypeOf(item: FeedbackItem): Exclude<FeedbackType, 'all'> {
  if (item.kind === 'review') return item.review.source;
  return item.checkIn.treatmentId ? 'treatment' : 'visit';
}

/** The types a patient has a card of — the chips after "All". */
export function feedbackTypesOf(items: readonly FeedbackItem[]): FeedbackType[] {
  const present = new Set(items.map(feedbackTypeOf));
  return CARD_TYPES.filter((type) => present.has(type));
}

/** A type chip's label: "All", "Consultation", "Treatment feedback", "Google" … */
export function feedbackTypeLabel(type: FeedbackType, t: TFunction): string {
  if (type === 'all' || type === 'visit' || type === 'treatment') return t(K.types[type]);
  return t(APP_KEYS.reviewSources[type], { ns: APP_NS });
}

/**
 * The follow-ups a card offers (H:4390 `ACTS_C` / `ACTS_R`), as the API's values. "Other"
 * is not offered: the API takes it only with a note saying what was done, and the menu has
 * no field for one.
 */
export function feedbackActionsFor(item: FeedbackItem): FeedbackActionKind[] {
  if (item.kind === 'checkIn') {
    return [
      'doctor_called',
      'asked_revisit',
      'free_review_booked',
      'plan_changed',
      'refund_credit',
    ];
  }
  const replied: Partial<Record<string, FeedbackActionKind>> = {
    google: 'replied_google',
    instagram: 'replied_instagram',
    whatsapp: 'replied_whatsapp',
  };
  const reply = replied[item.review.source];
  return [...(reply ? [reply] : []), 'doctor_called', 'asked_revisit', 'refund_credit'];
}

/** The visit a review follows — its number and service, from the patient's bookings. */
export interface FeedbackVisit {
  seq: number;
  service: string | null;
}

/** What one card shows (H:4389–4390). */
export interface FeedbackCardView {
  type: Exclude<FeedbackType, 'all'>;
  typeLabel: string;
  sub: string;
  /** The pill: the feel ("Better"), or the stars ("★★★★☆"). */
  head: { text: string; tone: Tone; stars: boolean };
  /** "7/10" or "5/5"; none for a review never rated. */
  score: string | null;
  /** The server's move against the check-in before: "▲ 2", "▼ 1", "= same". */
  trend: { text: string; direction: 'up' | 'down' | 'same' } | null;
  /** "Followed mostly", or how many files a review has. */
  tag: { text: string; tone: Tone } | null;
  quote: string;
  quoteEmpty: boolean;
  detailLabel: string;
  detail: string;
}

/** The visit a review follows: "Hydrafacial · Appt #2790", or just the number. */
function visitLine(visit: FeedbackVisit, t: TFunction): string {
  const number = displayId.appointment(visit.seq);
  return visit.service
    ? t(K.visitWith, { service: visit.service, number })
    : t(K.appointment, { number });
}

/** `score_change` as the trend (§7: the server's, never worked out here). */
function trendOf(change: number | null, t: TFunction): FeedbackCardView['trend'] {
  if (change === null) return null;
  if (change > 0) return { text: t(K.trendUp, { points: change }), direction: 'up' };
  if (change < 0) return { text: t(K.trendDown, { points: -change }), direction: 'down' };
  return { text: t(K.trendSame), direction: 'same' };
}

/** A review's rating as its pill: ★ filled up to it (≥4 butter, 3 stone, else blush). */
function starsOf(rating: number | null, t: TFunction): FeedbackCardView['head'] {
  if (rating === null) return { text: t(K.notRated), tone: 'stone', stars: false };
  return {
    text: '★'.repeat(rating) + '☆'.repeat(5 - rating),
    tone: ratingTone(rating),
    stars: true,
  };
}

/** "Followed mostly" in the answer's tone; none when it was not asked. */
function followedTag(followed: CheckinFollowed | null, t: TFunction) {
  if (!followed) return null;
  return {
    text: t(K.followed, { how: followedLabel(t, followed).toLocaleLowerCase() }),
    tone: CHECKIN_FOLLOWED_TONES[followed],
  };
}

/**
 * A check-in card: what it follows in the server's words (`context`, TR9 — "After LHR Full
 * Face", "Visit · 10 Oct"), the feel, the score and its move, what was followed, the words,
 * the plan.
 */
function checkInCardView(checkIn: PatientCheckIn, t: TFunction): FeedbackCardView {
  const type = checkIn.treatmentId ? 'treatment' : 'visit';
  const now = checkIn.currentState?.trim();
  return {
    type,
    typeLabel: feedbackTypeLabel(type, t),
    sub: checkIn.context,
    head: {
      text: t(APP_KEYS.checkInFeels[checkIn.feel], { ns: APP_NS }),
      tone: CHECKIN_FEEL_TONES[checkIn.feel],
      stars: false,
    },
    score: t(K.score, { score: checkIn.score }),
    trend: trendOf(checkIn.scoreChange, t),
    tag: followedTag(checkIn.followed, t),
    quote: now ? `“${now}”` : t(K.noNow),
    quoteEmpty: !now,
    detailLabel: t(K.nextLabel),
    detail: checkIn.nextPlan?.trim() || checkIn.followedNote?.trim() || t(K.noNext), // NOSONAR(S6606): a blank plan or note is none — "" falls through
  };
}

/**
 * A review card: the visit it follows (the patient's bookings name it — "Visit" until they
 * are read), the stars, how many files it has (B1: none can be read back, and their names are
 * not kept), the words, the link.
 */
function reviewCardView(
  review: PatientReview,
  visit: FeedbackVisit | null,
  t: TFunction,
): FeedbackCardView {
  const text = review.text?.trim();
  let sub = t(K.noVisit);
  if (visit) sub = visitLine(visit, t);
  else if (review.appointmentId) sub = t(K.visit);
  const files = review.fileKeys.length;
  return {
    type: review.source,
    typeLabel: feedbackTypeLabel(review.source, t),
    sub,
    head: starsOf(review.rating, t),
    score: review.rating === null ? null : t(K.stars, { rating: review.rating }),
    trend: null,
    tag: files > 0 ? { text: t(K.files, { count: files }), tone: 'lav' } : null,
    quote: text ? `“${text}”` : t(K.noText),
    quoteEmpty: !text,
    detailLabel: t(K.linkLabel),
    detail: review.link?.trim() || t(K.noLink), // NOSONAR(S6606): a blank link is no link — "" falls back
  };
}

/** One card's words and tones (H:4389–4390 `revVM`); `visitOf` names a booking by id. */
export function feedbackCardView(
  item: FeedbackItem,
  t: TFunction,
  visitOf: (appointmentId: string | null) => FeedbackVisit | null = () => null,
): FeedbackCardView {
  if (item.kind === 'checkIn') return checkInCardView(item.checkIn, t);
  return reviewCardView(item.review, visitOf(item.review.appointmentId), t);
}
