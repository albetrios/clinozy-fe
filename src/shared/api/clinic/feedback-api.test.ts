import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isHttpError } from '@/shared/errors/HttpError.ts';

import { clinicToday } from './clinic-time.ts';
import {
  checkInNeedsAction,
  createCheckIn,
  createReview,
  deleteCheckIn,
  fetchCheckInContext,
  listPatientFeedback,
  logFeedbackAction,
  restoreCheckIn,
  reviewNeedsAction,
  updateCheckIn,
  updateReview,
} from './feedback-api.ts';
import type { CheckInInput, ReviewInput } from './feedback-contracts.ts';
import { patientRef } from './fixtures/patients.fixtures.ts';
import { ref } from './fixtures/refs.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';

const DHARTI = patientRef('Dharti Galani');
const LHR = ref.treatment(498);

const checkIn = (fields: Partial<CheckInInput> = {}): CheckInInput => ({
  patientId: DHARTI,
  appointmentId: null,
  treatmentId: LHR,
  context: 'Aftercare after LHR Full Face',
  feel: 'better',
  score: 7,
  followed: 'mostly',
  followedNote: null,
  now: 'Redness settled',
  nextPlan: null,
  nextOfferingIds: [],
  date: clinicToday(),
  ...fields,
});

const review = (fields: Partial<ReviewInput> = {}): ReviewInput => ({
  patientId: DHARTI,
  appointmentId: null,
  source: 'google',
  rating: 5,
  text: 'Lovely staff',
  link: null,
  date: clinicToday(),
  ...fields,
});

const callBacks = () =>
  clinicFixtures.tasks.snapshot(
    (task) => task.patientId === DHARTI && task.kind === 'callback',
  );

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('the Feedback card’s read (S:1636)', () => {
  it('lists a patient’s check-ins and reviews newest first, with the counts and types', async () => {
    const page = await listPatientFeedback(DHARTI);
    expect(page.counts.reviews).toBe(1);
    expect(page.counts.checkIns).toBeGreaterThan(0);
    expect(page.total).toBe(page.counts.checkIns + page.counts.reviews);
    const dates = page.items.map((item) => item.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(page.types).toContain('google');
    const google = await listPatientFeedback(DHARTI, { type: 'google' });
    expect(google.items.map((item) => item.kind)).toEqual(['review']);
    expect(google.total).toBe(1);
  });

  it('pages six at a time', async () => {
    for (let index = 0; index < 7; index += 1) {
      await createCheckIn(checkIn({ treatmentId: null, context: `Visit ${index}` }));
    }
    const first = await listPatientFeedback(DHARTI, { type: 'visit' });
    expect(first.items).toHaveLength(6);
    expect(first.total).toBeGreaterThanOrEqual(7);
    const more = await listPatientFeedback(DHARTI, { type: 'visit', limit: 12 });
    expect(more.items).toHaveLength(more.total);
  });

  it('carries the trend, the treatment and who logged it', async () => {
    await createCheckIn(checkIn({ score: 9 }));
    const { items } = await listPatientFeedback(DHARTI, { type: 'treatment' });
    const [latest] = items;
    expect(latest).toMatchObject({
      kind: 'checkIn',
      treatmentName: 'LHR Full Face',
      needsAction: false,
    });
    expect(latest?.kind === 'checkIn' && latest.previousScore).toBeTypeOf('number');
    expect(latest?.by?.initials).toBeTruthy();
  });
});

describe('the call-back task rules (S:1648–1649)', () => {
  it('needs action on Worse or a score of 4 or less, never on "not rated"', () => {
    expect(checkInNeedsAction({ feel: 'worse', score: 8 })).toBe(true);
    expect(checkInNeedsAction({ feel: 'same', score: 4 })).toBe(true);
    expect(checkInNeedsAction({ feel: 'same', score: 5 })).toBe(false);
    expect(checkInNeedsAction({ feel: 'better', score: 0 })).toBe(false);
    expect(reviewNeedsAction({ rating: 3 })).toBe(true);
    expect(reviewNeedsAction({ rating: 4 })).toBe(false);
    expect(reviewNeedsAction({ rating: null })).toBe(false);
  });

  it('creates a doctor call-back due in 3 hours after a bad check-in', async () => {
    const before = callBacks().length;
    const saved = await createCheckIn(checkIn({ feel: 'worse', score: 3 }));
    expect(saved.callBackCreated).toBe(true);
    const tasks = callBacks();
    expect(tasks).toHaveLength(before + 1);
    const task = tasks.at(-1);
    expect(task?.ownerRole).toBe('doctor');
    const hours = (Date.parse(task?.dueAt ?? '') - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(2.9);
    expect(hours).toBeLessThanOrEqual(3);
  });

  it('creates none after a good check-in, and one when an edit turns it bad', async () => {
    const before = callBacks().length;
    const saved = await createCheckIn(checkIn());
    expect(saved.callBackCreated).toBe(false);
    expect(callBacks()).toHaveLength(before);
    const worse = await updateCheckIn(saved.checkIn.id, checkIn({ feel: 'worse' }));
    expect(worse.callBackCreated).toBe(true);
    const again = await updateCheckIn(
      saved.checkIn.id,
      checkIn({ feel: 'worse', score: 2 }),
    );
    expect(again.callBackCreated).toBe(false);
    expect(callBacks()).toHaveLength(before + 1);
  });

  it('creates a call-back due in 4 hours after a review of 3 stars or less', async () => {
    const before = callBacks().length;
    const low = await createReview(review({ rating: 3 }));
    expect(low.callBackCreated).toBe(true);
    const task = callBacks().at(-1);
    const hours = (Date.parse(task?.dueAt ?? '') - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(3.9);
    const high = await createReview(review({ rating: 5 }));
    expect(high.callBackCreated).toBe(false);
    expect(callBacks()).toHaveLength(before + 1);
    const edited = await updateReview(high.review.id, review({ rating: 2 }));
    expect(edited.callBackCreated).toBe(true);
  });
});

describe('the check-in’s side effects and the card actions', () => {
  it('adds each named offering to the suggestions as Planned', async () => {
    const suggested = new Set(
      clinicFixtures.offeringSuggestions
        .snapshot((row) => row.patientId === DHARTI)
        .map((row) => row.offeringId),
    );
    const fresh = clinicFixtures.offerings
      .snapshot((row) => row.active && !suggested.has(row.id))
      .slice(0, 2);
    const [already] = suggested;
    const saved = await createCheckIn(
      checkIn({
        nextOfferingIds: [
          ...fresh.map((offering) => offering.id),
          ...(already ? [already] : []),
        ],
      }),
    );
    // One already in the plan stays as it is and is not counted.
    expect(saved.suggestionsAdded).toBe(2);
    const planned = clinicFixtures.offeringSuggestions.snapshot(
      (row) =>
        row.patientId === DHARTI && row.sourceLabel === 'Aftercare after LHR Full Face',
    );
    expect(planned.map((row) => row.status)).toEqual(['planned', 'planned']);
  });

  it('refuses a review link that is not https', async () => {
    const refused = await createReview(review({ link: 'http://example.com' })).catch(
      (error: unknown) => error,
    );
    expect(isHttpError(refused) && refused.status).toBe(422);
  });

  it('logs an action on one card, and refuses one on none or both', async () => {
    const saved = await createCheckIn(checkIn({ feel: 'worse' }));
    await logFeedbackAction({
      checkInId: saved.checkIn.id,
      reviewId: null,
      action: 'doctor_called',
      note: null,
    });
    const { items } = await listPatientFeedback(DHARTI, { type: 'treatment' });
    const card = items.find((item) => item.id === saved.checkIn.id);
    expect(card?.action?.action).toBe('doctor_called');
    const refused = await logFeedbackAction({
      checkInId: null,
      reviewId: null,
      action: 'other',
      note: null,
    }).catch((error: unknown) => error);
    expect(isHttpError(refused) && refused.status).toBe(422);
  });

  it('removes a check-in and restores it', async () => {
    const saved = await createCheckIn(checkIn());
    await deleteCheckIn(saved.checkIn.id, 'mistake', null);
    let page = await listPatientFeedback(DHARTI, { type: 'treatment', limit: 50 });
    expect(page.items.some((item) => item.id === saved.checkIn.id)).toBe(false);
    await restoreCheckIn(saved.checkIn.id);
    page = await listPatientFeedback(DHARTI, { type: 'treatment', limit: 50 });
    expect(page.items.some((item) => item.id === saved.checkIn.id)).toBe(true);
  });

  it('heads the drawer with the last check-in, the treatment and the visit', async () => {
    const context = await fetchCheckInContext(DHARTI, { treatmentId: LHR });
    expect(context.treatment).toMatchObject({ name: 'LHR Full Face' });
    expect(context.previous?.patientId).toBe(DHARTI);
    const saved = await createCheckIn(checkIn());
    const editing = await fetchCheckInContext(DHARTI, { editingId: saved.checkIn.id });
    expect(editing.previous?.id).not.toBe(saved.checkIn.id);
  });
});
