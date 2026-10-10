import type { ReviewSource } from '@/shared/api/clinic/clinic-schema.ts';
import type {
  PatientReview,
  ReviewFields,
} from '@/shared/api/clinic/feedback-contracts.ts';
import type { PickedFile } from '@/shared/components/DrawerField/index.ts';

import { REVIEW_FILE_TYPES } from './review.constants.ts';

/** Log a review's fields (`patient-file.md:189–197`). */
export interface ReviewFormValues {
  source: ReviewSource;
  /** 1–5; null only on a saved review that never had one. */
  rating: number | null;
  link: string;
  /** Filed through the upload tray once the review is written. */
  files: PickedFile[];
  text: string;
}

/** The rating a new review starts on (H:4398): five stars. */
const DEFAULT_REVIEW_RATING = 5;

/** A new review: from the opener's source (Google by default), five stars (H:4398). */
export function newReviewForm(source: ReviewSource = 'google'): ReviewFormValues {
  return { source, rating: DEFAULT_REVIEW_RATING, link: '', files: [], text: '' };
}

/** A saved review as the edit drawer opens it — its files stay on it. */
export function reviewFormOf(review: PatientReview): ReviewFormValues {
  return {
    source: review.source,
    rating: review.rating,
    link: review.link ?? '',
    files: [],
    text: review.text ?? '',
  };
}

const textOrNull = (text: string) => text.trim() || null;

/** What a save sends — a blank link or text is none. */
export function reviewFieldsOf(values: ReviewFormValues): ReviewFields {
  return {
    source: values.source,
    rating: values.rating,
    link: textOrNull(values.link),
    text: textOrNull(values.text),
  };
}

/** A link the API takes: https, no spaces (TR11). */
export function isReviewLink(link: string): boolean {
  return /^https:\/\/\S+$/.test(link.trim());
}

/** A rating chip's words: "★★★★★  5" — the stars, two spaces, the number (H:4398). */
export function ratingLabel(rating: number): string {
  return `${'★'.repeat(rating)}  ${rating}`;
}

const FILE_TYPES: ReadonlySet<string> = new Set(REVIEW_FILE_TYPES);

/** Whether the Video or screenshot field takes a file: MP4, MOV, JPG or PNG. */
export function takesReviewFile(file: File): boolean {
  return FILE_TYPES.has(file.type);
}
