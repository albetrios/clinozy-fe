import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

import {
  attachReviewFile,
  createCheckIn,
  createReview,
  deleteFeedback,
  fetchCheckIn,
  fetchPreviousCheckIn,
  listPatientFeedback,
  logFeedbackAction,
  restoreFeedback,
  updateCheckIn,
  updateReview,
} from './feedback-api.ts';
import { type CheckInFields, checkInOfferingsOf } from './feedback-contracts.ts';

const PATIENT = 'pat_priya0000000000000000';
const CHECK_IN = 'chk_priya0000000000000000';
const REVIEW = 'rev_priya0000000000000000';
const KEY = 'key-0000-0000-0000';

/** A check-in as clinozy-be answers it (the live shape, 2026-10-10). */
const checkInRow = (patch: Record<string, unknown> = {}) => ({
  id: CHECK_IN,
  patient_id: PATIENT,
  appointment_id: null,
  patient_treatment_id: null,
  context: 'Visit · 10 Oct',
  feel: 'worse',
  score: 3,
  score_change: -4,
  followed: null,
  followed_note: null,
  current_state: 'Itching again',
  next_plan: null,
  next_offering_ids: ['off_hydra0000000000000000'],
  check_in_date: '2026-10-10',
  needs_action: false,
  actions: [
    {
      id: 'fba_called000000000000000',
      action: 'doctor_called',
      note: 'Spoke at 4pm',
      author_membership_id: 'mem_nisha0000000000000000',
      created_at: '2026-10-10T01:43:17.495Z',
    },
  ],
  created_at: '2026-10-10T01:43:09.892Z',
  updated_at: '2026-10-10T01:43:09.892Z',
  ...patch,
});

/** A review as clinozy-be answers it. */
const reviewRow = (patch: Record<string, unknown> = {}) => ({
  id: REVIEW,
  patient_id: PATIENT,
  appointment_id: null,
  source: 'google',
  rating: 2,
  text: 'Waited an hour',
  link: 'https://g.page/r/abc',
  file_keys: [],
  review_date: '2026-10-10',
  needs_action: true,
  actions: [],
  created_at: '2026-10-10T01:43:34.671Z',
  updated_at: '2026-10-10T01:43:34.671Z',
  ...patch,
});

/** One list page as clinozy-be answers it. */
const page = (rows: unknown[], next: string | null = null) => ({
  data: rows,
  meta: {
    request_id: 'req',
    pagination: {
      per_page: 100,
      next,
      has_more: next !== null,
      estimated_total: rows.length,
    },
  },
});

const FIELDS: CheckInFields = {
  feel: 'better',
  score: 7,
  currentState: 'Less redness',
  followed: 'mostly',
  followedNote: null,
  nextPlan: 'Second session in 3 weeks',
};

afterEach(() => vi.resetAllMocks());

describe('the feedback reads', () => {
  it('reads every check-in and review of a patient, newest first, mapped', async () => {
    vi.mocked(api.get).mockImplementation(async (path: string, init?: unknown) => {
      const after = (init as { query?: { after?: string } }).query?.after;
      if (path === '/app/patients/{patient_id}/check-ins') {
        return after
          ? page([checkInRow({ id: 'chk_old', check_in_date: '2026-09-24' })])
          : page([checkInRow()], 'cursor');
      }
      return page([reviewRow({ review_date: '2026-10-01' })]);
    });

    const items = await listPatientFeedback(PATIENT);

    expect(api.get).toHaveBeenCalledWith('/app/patients/{patient_id}/check-ins', {
      params: { patient_id: PATIENT },
      query: { sort: 'check_in_date', order: 'desc', limit: 100, after: undefined },
    });
    expect(api.get).toHaveBeenCalledWith('/app/patients/{patient_id}/check-ins', {
      params: { patient_id: PATIENT },
      query: { sort: 'check_in_date', order: 'desc', limit: 100, after: 'cursor' },
    });
    expect(api.get).toHaveBeenCalledWith('/app/patients/{patient_id}/reviews', {
      params: { patient_id: PATIENT },
      query: { sort: 'review_date', order: 'desc', limit: 100, after: undefined },
    });
    expect(items.map((item) => item.id)).toEqual([CHECK_IN, REVIEW, 'chk_old']);
    expect(items[0]).toEqual({
      kind: 'checkIn',
      id: CHECK_IN,
      checkIn: {
        id: CHECK_IN,
        patientId: PATIENT,
        appointmentId: null,
        treatmentId: null,
        context: 'Visit · 10 Oct',
        feel: 'worse',
        score: 3,
        scoreChange: -4,
        followed: null,
        followedNote: null,
        currentState: 'Itching again',
        nextPlan: null,
        nextOfferingIds: ['off_hydra0000000000000000'],
        date: '2026-10-10',
        needsAction: false,
        actions: [
          {
            id: 'fba_called000000000000000',
            action: 'doctor_called',
            note: 'Spoke at 4pm',
            authorId: 'mem_nisha0000000000000000',
            at: '2026-10-10T01:43:17.495Z',
          },
        ],
        createdAt: '2026-10-10T01:43:09.892Z',
        updatedAt: '2026-10-10T01:43:09.892Z',
      },
    });
    expect(items[1]).toMatchObject({
      kind: 'review',
      review: { source: 'google', rating: 2, fileKeys: [], needsAction: true },
    });
  });

  it('reads one check-in by the patient', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: checkInRow(),
      meta: { request_id: 'r' },
    });
    await expect(fetchCheckIn(PATIENT, CHECK_IN)).resolves.toMatchObject({ score: 3 });
    expect(api.get).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/check-ins/{patient_check_in_id}',
      { params: { patient_id: PATIENT, patient_check_in_id: CHECK_IN } },
    );
  });

  it('finds the check-in before a new one, and before the one being edited', async () => {
    vi.mocked(api.get).mockResolvedValue(
      page([
        checkInRow({ id: 'chk_same_later', created_at: '2026-10-10T09:00:00.000Z' }),
        checkInRow({ id: CHECK_IN }),
        checkInRow({ id: 'chk_same_earlier', created_at: '2026-10-10T00:10:00.000Z' }),
        checkInRow({ id: 'chk_old', check_in_date: '2026-09-24' }),
      ]),
    );
    await expect(fetchPreviousCheckIn(PATIENT, null)).resolves.toMatchObject({
      id: 'chk_same_later',
    });
    expect(api.get).toHaveBeenLastCalledWith('/app/patients/{patient_id}/check-ins', {
      params: { patient_id: PATIENT },
      query: {
        sort: 'check_in_date',
        order: 'desc',
        limit: 10,
        check_in_date_to: undefined,
      },
    });

    await expect(
      fetchPreviousCheckIn(PATIENT, {
        id: CHECK_IN,
        date: '2026-10-10',
        createdAt: '2026-10-10T01:43:09.892Z',
      }),
    ).resolves.toMatchObject({ id: 'chk_same_earlier' });
    expect(api.get).toHaveBeenLastCalledWith('/app/patients/{patient_id}/check-ins', {
      params: { patient_id: PATIENT },
      query: {
        sort: 'check_in_date',
        order: 'desc',
        limit: 10,
        check_in_date_to: '2026-10-10',
      },
    });
  });
});

describe('checkInOfferingsOf (the drawer’s "Add to offering suggestions")', () => {
  it('takes every offering of the one catalogue, active or not, A to Z, in rupees', () => {
    const catalogue = [
      offeringRecord({
        id: 'off_lhr00000000000000000',
        name: 'LHR Full Face',
        category: 'package',
        tone: 'lav',
        price: 4800,
        sessions: 7,
        searchTerms: ['laser'],
      }),
      offeringRecord({ id: 'off_glow00000000000000000', name: 'Glow', isActive: false }),
    ];
    expect(checkInOfferingsOf(catalogue)).toEqual([
      {
        id: 'off_glow00000000000000000',
        name: 'Glow',
        category: 'treatment',
        tone: 'sage',
        price: 2000,
        sessions: 1,
        searchTerms: ['chemical', 'glow'],
        isActive: false,
      },
      {
        id: 'off_lhr00000000000000000',
        name: 'LHR Full Face',
        category: 'package',
        tone: 'lav',
        price: 4800,
        sessions: 7,
        searchTerms: ['laser'],
        isActive: true,
      },
    ]);
  });
});

describe('the feedback writes', () => {
  it('logs a check-in with its place and the offerings to plan — no context of its own', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: checkInRow(),
      meta: { request_id: 'r' },
    });
    await createCheckIn({
      patientId: PATIENT,
      input: {
        ...FIELDS,
        appointmentId: 'appt_x',
        treatmentId: 'trt_x',
        date: '2026-10-10',
        nextOfferingIds: ['off_a'],
      },
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/patients/{patient_id}/check-ins', {
      params: { patient_id: PATIENT },
      body: {
        feel: 'better',
        score: 7,
        current_state: 'Less redness',
        followed: 'mostly',
        followed_note: null,
        next_plan: 'Second session in 3 weeks',
        appointment_id: 'appt_x',
        patient_treatment_id: 'trt_x',
        check_in_date: '2026-10-10',
        next_offering_ids: ['off_a'],
      },
      idempotencyKey: KEY,
    });
  });

  it('changes a check-in stale-checked, without next offerings', async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: checkInRow(),
      meta: { request_id: 'r' },
    });
    await updateCheckIn({
      patientId: PATIENT,
      checkInId: CHECK_IN,
      fields: FIELDS,
      expectedUpdatedAt: '2026-10-10T01:43:09.892Z',
      idempotencyKey: KEY,
    });
    expect(api.patch).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/check-ins/{patient_check_in_id}',
      {
        params: { patient_id: PATIENT, patient_check_in_id: CHECK_IN },
        body: {
          feel: 'better',
          score: 7,
          current_state: 'Less redness',
          followed: 'mostly',
          followed_note: null,
          next_plan: 'Second session in 3 weeks',
          expected_updated_at: '2026-10-10T01:43:09.892Z',
        },
        idempotencyKey: KEY,
      },
    );
  });

  it('logs and changes a review', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: reviewRow(),
      meta: { request_id: 'r' },
    });
    vi.mocked(api.patch).mockResolvedValue({
      data: reviewRow(),
      meta: { request_id: 'r' },
    });
    const fields = { source: 'video', rating: 5, text: null, link: null } as const;
    await createReview({
      patientId: PATIENT,
      input: { ...fields, appointmentId: null, date: '2026-10-10' },
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/patients/{patient_id}/reviews', {
      params: { patient_id: PATIENT },
      body: { ...fields, appointment_id: null, review_date: '2026-10-10' },
      idempotencyKey: KEY,
    });
    await updateReview({
      patientId: PATIENT,
      reviewId: REVIEW,
      fields,
      expectedUpdatedAt: 'at',
      idempotencyKey: KEY,
    });
    expect(api.patch).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/reviews/{patient_review_id}',
      {
        params: { patient_id: PATIENT, patient_review_id: REVIEW },
        body: { ...fields, expected_updated_at: 'at' },
        idempotencyKey: KEY,
      },
    );
  });

  it('files each uploaded key on the review in turn, never twice', async () => {
    let keys: string[] = ['organization-files/org/one.png'];
    let updated = 0;
    vi.mocked(api.get).mockImplementation(async () => ({
      data: reviewRow({ file_keys: keys, updated_at: `v${updated}` }),
      meta: { request_id: 'r' },
    }));
    vi.mocked(api.patch).mockImplementation(async (_path, init) => {
      const body = (init as { body: { file_keys: string[] } }).body;
      keys = body.file_keys;
      updated += 1;
      return { data: reviewRow({ file_keys: keys }), meta: { request_id: 'r' } };
    });

    await Promise.all([
      attachReviewFile({ patientId: PATIENT, reviewId: REVIEW, fileKey: 'k/two.mp4' }),
      attachReviewFile({ patientId: PATIENT, reviewId: REVIEW, fileKey: 'k/three.png' }),
      attachReviewFile({
        patientId: PATIENT,
        reviewId: REVIEW,
        fileKey: 'organization-files/org/one.png',
      }),
    ]);

    expect(keys).toEqual(['organization-files/org/one.png', 'k/two.mp4', 'k/three.png']);
    expect(api.patch).toHaveBeenCalledTimes(2);
    expect(api.patch).toHaveBeenLastCalledWith(
      '/app/patients/{patient_id}/reviews/{patient_review_id}',
      {
        params: { patient_id: PATIENT, patient_review_id: REVIEW },
        body: {
          file_keys: ['organization-files/org/one.png', 'k/two.mp4', 'k/three.png'],
          expected_updated_at: 'v1',
        },
      },
    );
  });

  it('removes with the reason, restores and logs a follow-up on the record’s own route', async () => {
    await deleteFeedback({
      patientId: PATIENT,
      kind: 'checkIn',
      id: CHECK_IN,
      reason: 'other',
      note: 'Wrong patient',
    });
    expect(api.delete).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/check-ins/{patient_check_in_id}',
      {
        params: { patient_id: PATIENT, patient_check_in_id: CHECK_IN },
        reason: 'other',
        note: 'Wrong patient',
      },
    );
    await deleteFeedback({
      patientId: PATIENT,
      kind: 'review',
      id: REVIEW,
      reason: 'duplicate',
      note: null,
    });
    expect(api.delete).toHaveBeenLastCalledWith(
      '/app/patients/{patient_id}/reviews/{patient_review_id}',
      {
        params: { patient_id: PATIENT, patient_review_id: REVIEW },
        reason: 'duplicate',
        note: undefined,
      },
    );

    await restoreFeedback({
      patientId: PATIENT,
      kind: 'review',
      id: REVIEW,
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenLastCalledWith(
      '/app/patients/{patient_id}/reviews/{patient_review_id}/restore',
      { params: { patient_id: PATIENT, patient_review_id: REVIEW }, idempotencyKey: KEY },
    );
    await restoreFeedback({
      patientId: PATIENT,
      kind: 'checkIn',
      id: CHECK_IN,
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenLastCalledWith(
      '/app/patients/{patient_id}/check-ins/{patient_check_in_id}/restore',
      {
        params: { patient_id: PATIENT, patient_check_in_id: CHECK_IN },
        idempotencyKey: KEY,
      },
    );

    await logFeedbackAction({
      patientId: PATIENT,
      kind: 'checkIn',
      id: CHECK_IN,
      action: 'doctor_called',
      note: null,
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenLastCalledWith(
      '/app/patients/{patient_id}/check-ins/{patient_check_in_id}/actions',
      {
        params: { patient_id: PATIENT, patient_check_in_id: CHECK_IN },
        body: { action: 'doctor_called', note: undefined },
        idempotencyKey: KEY,
      },
    );
    await logFeedbackAction({
      patientId: PATIENT,
      kind: 'review',
      id: REVIEW,
      action: 'replied_google',
      note: 'Thanked them',
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenLastCalledWith(
      '/app/patients/{patient_id}/reviews/{patient_review_id}/actions',
      {
        params: { patient_id: PATIENT, patient_review_id: REVIEW },
        body: { action: 'replied_google', note: 'Thanked them' },
        idempotencyKey: KEY,
      },
    );
  });
});
