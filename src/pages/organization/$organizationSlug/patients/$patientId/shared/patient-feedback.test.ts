import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { I18N_NAMESPACES } from '@/lib/i18n/namespaces.ts';

import {
  feedbackCountsText,
  followedLabel,
  ratingTone,
  scoreTone,
} from './patient-feedback.ts';

const t = i18n.getFixedT('en', I18N_NAMESPACES.patientFile) as TFunction;

describe('the file’s feedback words and tones', () => {
  it('counts check-ins and reviews in words', () => {
    expect(feedbackCountsText(t, { checkIns: 2, reviews: 1 })).toBe(
      '2 check-ins · 1 review',
    );
  });

  it('names how far the advice was followed', () => {
    expect(followedLabel(t, 'not_at_all')).toBe('Not at all');
    expect(followedLabel(t, 'mostly')).toBe('Mostly');
  });

  it('tones a score 1–4 blush, 5–7 butter, 8–10 sage (H:4396)', () => {
    expect([1, 4, 5, 7, 8, 10].map(scoreTone)).toEqual([
      'blush',
      'blush',
      'butter',
      'butter',
      'sage',
      'sage',
    ]);
  });

  it('tones a rating 4–5 butter, 3 stone, 1–2 blush (H:4398)', () => {
    expect([5, 4, 3, 2, 1].map(ratingTone)).toEqual([
      'butter',
      'butter',
      'stone',
      'blush',
      'blush',
    ]);
  });
});
