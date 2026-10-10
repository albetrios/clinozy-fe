import { describe, expect, it } from 'vitest';

import {
  canLogFeedback,
  type FeedbackAccess,
  feedbackItemAccess,
  READ_ONLY_FEEDBACK,
} from './feedback-access.ts';

/** Marketing's feedback (clinozy-be D83 (4)): the reviews, never the file's check-ins. */
const MARKETING: FeedbackAccess = {
  checkIns: false,
  logReview: true,
  editReview: true,
  removeReview: true,
};

describe('feedback access', () => {
  it('offers Log feedback for a check-in or a review — nothing to a reader', () => {
    expect(canLogFeedback(MARKETING)).toBe(true);
    expect(canLogFeedback({ ...READ_ONLY_FEEDBACK, checkIns: true })).toBe(true);
    expect(canLogFeedback(READ_ONLY_FEEDBACK)).toBe(false);
  });

  it('opens a card by its own kind’s codes', () => {
    expect(feedbackItemAccess({ kind: 'review' }, MARKETING)).toEqual({
      canEdit: true,
      canRemove: true,
    });
    expect(feedbackItemAccess({ kind: 'checkIn' }, MARKETING)).toEqual({
      canEdit: false,
      canRemove: false,
    });
    expect(
      feedbackItemAccess({ kind: 'review' }, { ...MARKETING, removeReview: false }),
    ).toEqual({ canEdit: true, canRemove: false });
  });
});
