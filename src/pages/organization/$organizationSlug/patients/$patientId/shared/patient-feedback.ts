import type { TFunction } from 'i18next';

import type { CheckinFollowed, Tone } from '@/shared/api/clinic/clinic-schema.ts';

/*
 * The feedback words and tones the file's parts share — the rail, the
 * Feedback card and the check-in and review drawers — kept in this plain
 * module so a card never loads a drawer to name a value.
 */

/** The feedback count words, in the patient file's namespace (`patient-file.md:296`). */
const FEEDBACK_COUNT_KEYS = {
  /** "2 check-ins" (plural). */
  checkIns: 'rail.checkIns',
  /** "1 review" (plural). */
  reviews: 'rail.reviews',
  /** "2 check-ins · 1 review". */
  counts: 'rail.feedbackCounts',
} as const;

/** "Followed the advice" — Fully, Mostly, Partly, Not at all (`patient-file.md:178`). */
const FOLLOWED_KEYS: Readonly<Record<CheckinFollowed, string>> = {
  fully: 'checkIn.followedValues.fully',
  mostly: 'checkIn.followedValues.mostly',
  partly: 'checkIn.followedValues.partly',
  not_at_all: 'checkIn.followedValues.not_at_all',
};

/**
 * "2 check-ins · 1 review" — the rail's Feedback row and the Feedback card's
 * header (H:4389). `t` reads the patient file's namespace.
 */
export function feedbackCountsText(
  t: TFunction,
  counts: { checkIns: number; reviews: number },
): string {
  return t(FEEDBACK_COUNT_KEYS.counts, {
    checkIns: t(FEEDBACK_COUNT_KEYS.checkIns, { count: counts.checkIns }),
    reviews: t(FEEDBACK_COUNT_KEYS.reviews, { count: counts.reviews }),
  });
}

/** How far the advice was followed: "Mostly". `t` reads the patient file's namespace. */
export function followedLabel(t: TFunction, followed: CheckinFollowed): string {
  return t(FOLLOWED_KEYS[followed]);
}

/** A check-in score's tone (H:4396): 1–4 blush, 5–7 butter, 8–10 sage. */
export function scoreTone(score: number): Tone {
  if (score >= 8) return 'sage';
  if (score >= 5) return 'butter';
  return 'blush';
}

/** A review rating's tone (H:4398, H:4390): 4–5 butter, 3 stone, 1–2 blush. */
export function ratingTone(rating: number): Tone {
  if (rating >= 4) return 'butter';
  return rating === 3 ? 'stone' : 'blush';
}
