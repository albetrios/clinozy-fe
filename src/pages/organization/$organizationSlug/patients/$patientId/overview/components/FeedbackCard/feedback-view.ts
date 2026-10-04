import type { TFunction } from 'i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type {
  CheckinFollowed,
  FeedbackActionKind,
  Tone,
} from '@/shared/api/clinic/clinic-schema.ts';
import type {
  CheckInFeedback,
  FeedbackItem,
  FeedbackType,
} from '@/shared/api/clinic/feedback-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  CHECKIN_FEEL_TONES,
  CHECKIN_FOLLOWED_TONES,
  REVIEW_SOURCE_TONES,
} from '@/shared/clinic/clinic-tones.ts';
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

/** Which type chip a card answers to. */
function feedbackTypeOf(item: FeedbackItem): Exclude<FeedbackType, 'all'> {
  if (item.kind === 'review') return item.review.source;
  return item.checkIn.treatmentId ? 'treatment' : 'visit';
}

/** A type chip's label: "All", "Consultation", "Treatment feedback", "Google" … */
export function feedbackTypeLabel(type: FeedbackType, t: TFunction): string {
  if (type === 'all' || type === 'visit' || type === 'treatment') return t(K.types[type]);
  return t(CLINIC_KEYS.reviewSources[type], { ns: CLINIC_NS });
}

/** The follow-ups a card offers (H:4390 `ACTS_C` / `ACTS_R`), as the contract's values. */
export function feedbackActionsFor(item: FeedbackItem): FeedbackActionKind[] {
  if (item.kind === 'checkIn') {
    return [
      'doctor_called',
      'asked_revisit',
      'free_review_booked',
      'plan_changed',
      'refund_credit',
      'other',
    ];
  }
  const replied: Partial<Record<string, FeedbackActionKind>> = {
    google: 'replied_google',
    instagram: 'replied_instagram',
    whatsapp: 'replied_whatsapp',
  };
  const reply = replied[item.review.source];
  return [
    ...(reply ? [reply] : []),
    'doctor_called',
    'asked_revisit',
    'refund_credit',
    'other',
  ];
}

/** What one card shows (H:4389–4390). */
export interface FeedbackCardView {
  type: Exclude<FeedbackType, 'all'>;
  typeLabel: string;
  sub: string;
  /** The pill: the feel ("Better"), or the stars ("★★★★☆"). */
  head: { text: string; tone: Tone; stars: boolean };
  /** "7/10" or "5/5"; none while not rated. */
  score: string | null;
  /** The score against the check-in before: "▲ 2", "▼ 1", "= same". */
  trend: { text: string; direction: 'up' | 'down' | 'same' } | null;
  /** "Followed mostly" or the review's files. */
  tag: { text: string; tone: Tone } | null;
  quote: string;
  quoteEmpty: boolean;
  detailLabel: string;
  detail: string;
}

/** The visit a card follows: "Hydrafacial · Appt #2790", or just the number. */
function visitLine(item: FeedbackItem, t: TFunction): string | null {
  if (!item.appointment) return null;
  const number = displayId.appointment(item.appointment.seq);
  return item.appointment.service
    ? t(K.visitWith, { service: item.appointment.service, number })
    : t(K.appointment, { number });
}

function trendOf(score: number, previous: number | null, t: TFunction) {
  if (score <= 0 || previous === null) return null;
  const points = score - previous;
  if (points > 0) return { text: t(K.trendUp, { points }), direction: 'up' as const };
  if (points < 0)
    return { text: t(K.trendDown, { points: -points }), direction: 'down' as const };
  return { text: t(K.trendSame), direction: 'same' as const };
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

/** A check-in card: the feel, the score and its trend, what was followed, the words, the plan. */
function checkInCardView(item: CheckInFeedback, t: TFunction): FeedbackCardView {
  const { checkIn } = item;
  const type = feedbackTypeOf(item);
  const now = checkIn.now?.trim();
  return {
    type,
    typeLabel: feedbackTypeLabel(type, t),
    sub: item.treatmentName ?? visitLine(item, t) ?? t(K.visit),
    head: {
      text: t(CLINIC_KEYS.checkInFeels[checkIn.feel], { ns: CLINIC_NS }),
      tone: CHECKIN_FEEL_TONES[checkIn.feel],
      stars: false,
    },
    score: checkIn.score > 0 ? t(K.score, { score: checkIn.score }) : null,
    trend: trendOf(checkIn.score, item.previousScore, t),
    tag: followedTag(checkIn.followed, t),
    quote: now ? `“${now}”` : t(K.noNow),
    quoteEmpty: !now,
    detailLabel: t(K.nextLabel),
    detail: checkIn.nextPlan?.trim() || checkIn.followedNote?.trim() || t(K.noNext),
  };
}

/** One card's words and tones (H:4389–4390 `revVM`). */
export function feedbackCardView(item: FeedbackItem, t: TFunction): FeedbackCardView {
  if (item.kind === 'checkIn') return checkInCardView(item, t);
  const { review } = item;
  const type = feedbackTypeOf(item);
  const text = review.text?.trim();
  const files = review.files.map((file) => file.split('/').pop() ?? file);
  return {
    type,
    typeLabel: feedbackTypeLabel(type, t),
    sub: visitLine(item, t) ?? t(K.noVisit),
    head: starsOf(review.rating, t),
    score: review.rating === null ? null : t(K.stars, { rating: review.rating }),
    trend: null,
    tag: files.length
      ? { text: t(K.files, { files: files.join(', ') }), tone: 'lav' }
      : null,
    quote: text ? `“${text}”` : t(K.noText),
    quoteEmpty: !text,
    detailLabel: t(K.linkLabel),
    detail: review.link?.trim() || t(K.noLink),
  };
}
