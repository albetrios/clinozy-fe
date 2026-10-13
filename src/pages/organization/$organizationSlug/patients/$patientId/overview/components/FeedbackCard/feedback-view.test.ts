import { describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import type {
  FeedbackItem,
  PatientCheckIn,
  PatientReview,
} from '@/shared/api/app/feedback-contracts.ts';
import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import { CLINICAL_NS } from '../../overview.constants.ts';
import {
  feedbackActionsFor,
  feedbackCardView,
  feedbackTypeLabel,
  feedbackTypeOf,
  feedbackTypesOf,
  type FeedbackVisit,
} from './feedback-view.ts';

const t = i18n.getFixedT('en', CLINICAL_NS);

const checkIn = (patch: Partial<PatientCheckIn> = {}): FeedbackItem => {
  const record: PatientCheckIn = {
    id: 'chk_1',
    patientId: 'pat_priya',
    appointmentId: null,
    treatmentId: null,
    context: 'Visit · 24 Sep',
    feel: 'better',
    score: 7,
    scoreChange: null,
    followed: null,
    followedNote: null,
    currentState: null,
    nextPlan: null,
    nextOfferingIds: [],
    date: '2026-09-24',
    needsAction: false,
    actions: [],
    createdAt: '2026-09-24T05:00:00.000Z',
    updatedAt: '2026-09-24T05:00:00.000Z',
    ...patch,
  };
  return { kind: 'checkIn', id: record.id, checkIn: record };
};

const review = (patch: Partial<PatientReview> = {}): FeedbackItem => {
  const record: PatientReview = {
    id: 'prev_1',
    patientId: 'pat_priya',
    appointmentId: null,
    source: 'google',
    rating: 4,
    text: null,
    link: null,
    fileKeys: [],
    date: '2026-10-08',
    needsAction: false,
    actions: [],
    createdAt: '2026-10-08T05:00:00.000Z',
    updatedAt: '2026-10-08T05:00:00.000Z',
    ...patch,
  };
  return { kind: 'review', id: record.id, review: record };
};

const view = (
  item: FeedbackItem,
  visitOf?: (appointmentId: string | null) => FeedbackVisit | null,
) => feedbackCardView(item, t, visitOf);

describe('the type chips', () => {
  it('reads a check-in after a session as treatment feedback, else a visit, and a review by its source', () => {
    expect(feedbackTypeOf(checkIn())).toBe('visit');
    expect(feedbackTypeOf(checkIn({ treatmentId: 'trt_1' }))).toBe('treatment');
    expect(feedbackTypeOf(review({ source: 'whatsapp' }))).toBe('whatsapp');
  });

  it('lists only the types a patient has, in the card’s order — never one twice', () => {
    expect(
      feedbackTypesOf([
        review({ source: 'whatsapp' }),
        checkIn({ treatmentId: 'trt_1' }),
        review({ source: 'google' }),
        checkIn(),
        review({ source: 'google' }),
      ]),
    ).toEqual(['visit', 'treatment', 'google', 'whatsapp']);
    expect(feedbackTypesOf([])).toEqual([]);
  });

  it('names each chip', () => {
    expect(feedbackTypeLabel('all', t)).toBe('All');
    expect(feedbackTypeLabel('visit', t)).toBe('Consultation');
    expect(feedbackTypeLabel('treatment', t)).toBe('Treatment feedback');
    expect(feedbackTypeLabel('internal_form', t)).toBe('Feedback form');
  });
});

describe('the follow-ups a card offers', () => {
  it('offers a check-in the five clinic follow-ups — never "Other"', () => {
    expect(feedbackActionsFor(checkIn())).toEqual([
      'doctor_called',
      'asked_revisit',
      'free_review_booked',
      'plan_changed',
      'refund_credit',
    ]);
  });

  it('offers a reply first where the review’s channel takes one', () => {
    expect(feedbackActionsFor(review({ source: 'instagram' }))[0]).toBe(
      'replied_instagram',
    );
    expect(feedbackActionsFor(review({ source: 'google' }))[0]).toBe('replied_google');
    expect(feedbackActionsFor(review({ source: 'video' }))).toEqual([
      'doctor_called',
      'asked_revisit',
      'refund_credit',
    ]);
  });
});

describe('a check-in card', () => {
  it('reads the feel, the score out of 10 and what it follows', () => {
    const card = view(checkIn());
    expect(card).toMatchObject({
      type: 'visit',
      typeLabel: 'Consultation',
      sub: 'Visit · 24 Sep',
      head: { text: 'Better', stars: false },
      score: '7/10',
      trend: null,
      tag: null,
    });
  });

  it('reads the server’s move against the check-in before — up, down or the same', () => {
    expect(view(checkIn({ scoreChange: 2 })).trend).toEqual({
      text: '▲ 2',
      direction: 'up',
    });
    expect(view(checkIn({ scoreChange: -1 })).trend).toEqual({
      text: '▼ 1',
      direction: 'down',
    });
    expect(view(checkIn({ scoreChange: 0 })).trend).toEqual({
      text: '= same',
      direction: 'same',
    });
  });

  it('tags how the plan was followed, lower-cased in the sentence', () => {
    expect(withoutBidiMarks(view(checkIn({ followed: 'not_at_all' })).tag?.text)).toBe(
      'Followed not at all',
    );
  });

  it('quotes how it is now, and says when there is no note — a blank one counts as none', () => {
    expect(view(checkIn({ currentState: ' Redness settled ' }))).toMatchObject({
      quote: '“Redness settled”',
      quoteEmpty: false,
    });
    expect(view(checkIn({ currentState: '   ' }))).toMatchObject({
      quote: 'No note on how it is now',
      quoteEmpty: true,
    });
  });

  it('shows the plan, else the note on what was followed, else says there is none', () => {
    expect(
      view(checkIn({ nextPlan: ' Sunscreen ', followedNote: 'Skipped' })).detail,
    ).toBe('Sunscreen');
    expect(
      view(checkIn({ nextPlan: '  ', followedNote: ' Skipped twice ' })).detail,
    ).toBe('Skipped twice');
    expect(view(checkIn({ nextPlan: null, followedNote: '' })).detail).toBe(
      'No next step noted',
    );
  });
});

describe('a review card', () => {
  it('fills the stars up to the rating, out of 5, toned by it', () => {
    expect(view(review({ rating: 5 })).head).toEqual({
      text: '★★★★★',
      tone: 'butter',
      stars: true,
    });
    expect(view(review({ rating: 3 })).head).toMatchObject({
      text: '★★★☆☆',
      tone: 'stone',
    });
    expect(view(review({ rating: 1 })).head).toMatchObject({
      text: '★☆☆☆☆',
      tone: 'blush',
    });
    expect(view(review({ rating: 4 })).score).toBe('4/5');
  });

  it('reads a review never rated as "Not rated", with no score', () => {
    const card = view(review({ rating: null }));
    expect(card.head).toEqual({ text: 'Not rated', tone: 'stone', stars: false });
    expect(card.score).toBeNull();
  });

  it('names the visit it follows: its service and number, the number alone, "Visit" until read, or none', () => {
    const linked = review({ appointmentId: 'appt_1' });
    expect(
      withoutBidiMarks(view(linked, () => ({ seq: 2790, service: 'Hydrafacial' })).sub),
    ).toBe('Hydrafacial · Appt #2790');
    expect(withoutBidiMarks(view(linked, () => ({ seq: 2790, service: null })).sub)).toBe(
      'Appt #2790',
    );
    expect(view(linked).sub).toBe('Visit');
    expect(view(review()).sub).toBe('Not linked to a visit');
  });

  it('counts its files, and says when it has no words or link', () => {
    expect(view(review({ fileKeys: ['a.mp4'] })).tag).toEqual({
      text: '▶ 1 file',
      tone: 'lav',
    });
    expect(view(review({ fileKeys: ['a.mp4', 'b.png'] })).tag?.text).toBe('▶ 2 files');
    expect(view(review()).tag).toBeNull();
    expect(view(review({ text: ' ', link: ' ' }))).toMatchObject({
      quote: 'No review text',
      quoteEmpty: true,
      detail: 'No link added',
    });
    expect(view(review({ text: 'Great', link: ' https://g.page/r/x ' }))).toMatchObject({
      quote: '“Great”',
      detail: 'https://g.page/r/x',
    });
  });
});
