import { describe, expect, it } from 'vitest';

import type { PatientReview } from '@/shared/api/app/feedback-contracts.ts';

import {
  isReviewLink,
  newReviewForm,
  ratingLabel,
  reviewFieldsOf,
  reviewFormOf,
  takesReviewFile,
} from './review-form.ts';

/** A saved review — Google, four stars, a link and a line. */
const savedReview = (patch: Partial<PatientReview> = {}): PatientReview => ({
  id: 'prev_kavya000000000000000',
  patientId: 'pat_kavya0000000000000000',
  appointmentId: null,
  source: 'google',
  rating: 4,
  text: 'Lovely staff',
  link: 'https://g.page/r/review',
  fileKeys: ['org/reviews/clip.mp4'],
  date: '2026-10-08',
  needsAction: false,
  actions: [],
  createdAt: '2026-10-08T05:00:00.000Z',
  updatedAt: '2026-10-08T05:00:00.000Z',
  ...patch,
});

describe('the Log a review form', () => {
  it('starts on Google with five stars, or on the opener’s source', () => {
    expect(newReviewForm()).toEqual({
      source: 'google',
      rating: 5,
      link: '',
      files: [],
      text: '',
    });
    expect(newReviewForm('instagram').source).toBe('instagram');
  });

  it('opens a saved review with its words — its files stay on it, a missing link reads blank', () => {
    expect(reviewFormOf(savedReview())).toEqual({
      source: 'google',
      rating: 4,
      link: 'https://g.page/r/review',
      files: [],
      text: 'Lovely staff',
    });
    expect(reviewFormOf(savedReview({ link: null, text: null, rating: null }))).toEqual({
      source: 'google',
      rating: null,
      link: '',
      files: [],
      text: '',
    });
  });

  it('sends a blank link or text as none, and keeps an unrated review unrated', () => {
    expect(
      reviewFieldsOf({
        source: 'video',
        rating: null,
        link: '  ',
        files: [],
        text: '\n',
      }),
    ).toEqual({ source: 'video', rating: null, link: null, text: null });
    expect(
      reviewFieldsOf({
        source: 'google',
        rating: 3,
        link: ' https://g.page/r/x ',
        files: [],
        text: ' Waited long ',
      }),
    ).toEqual({
      source: 'google',
      rating: 3,
      link: 'https://g.page/r/x',
      text: 'Waited long',
    });
  });
});

describe('isReviewLink — the API takes https only, with no spaces', () => {
  it('takes an https link, trimmed', () => {
    expect(isReviewLink('https://g.page/r/abc')).toBe(true);
    expect(isReviewLink('  https://instagram.com/p/xyz  ')).toBe(true);
  });

  it('refuses http, a bare domain, a space inside and an empty scheme', () => {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- asserting http:// is rejected
    expect(isReviewLink('http://g.page/r/abc')).toBe(false);
    expect(isReviewLink('g.page/r/abc')).toBe(false);
    expect(isReviewLink('https://g.page/r/a bc')).toBe(false);
    expect(isReviewLink('https://')).toBe(false);
    expect(isReviewLink('')).toBe(false);
  });
});

describe('ratingLabel', () => {
  it('writes the stars, two spaces, the number', () => {
    expect(ratingLabel(5)).toBe('★★★★★  5');
    expect(ratingLabel(1)).toBe('★  1');
  });
});

describe('takesReviewFile — a testimonial video or a screenshot', () => {
  const file = (type: string) => new File(['x'], 'clip', { type });

  it('takes MP4, MOV, JPG and PNG', () => {
    for (const type of ['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png']) {
      expect(takesReviewFile(file(type))).toBe(true);
    }
  });

  it('refuses a PDF, a WebM and a file of no type', () => {
    for (const type of ['application/pdf', 'video/webm', '']) {
      expect(takesReviewFile(file(type))).toBe(false);
    }
  });
});
