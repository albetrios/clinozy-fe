import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';
import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

import { patientQueryKeys } from './patients-api.ts';
import {
  createPlanSuggestion,
  deletePlanSuggestion,
  fetchPlan,
  fetchPlanActivity,
  fetchPlanIdeas,
  planContextQueryKeys,
  planQueryKeys,
  restorePlanSuggestion,
  updatePlanSuggestion,
} from './plan-api.ts';
import { billedPrice, planOfferingsOf } from './plan-contracts.ts';

const PATIENT = 'pat_dharti000000000000000';
const SUGGESTION = 'osug_lhr0000000000000000000';
const KEY = 'key-1';

/** A plan row as clinozy-be answers it (live: `GET …/offering-suggestions`). */
const suggestionRow = (patch: Record<string, unknown> = {}) => ({
  id: SUGGESTION,
  patient_id: PATIENT,
  offering_id: 'off_lhr00000000000000000000',
  offering_name: 'LHR Full Face',
  quantity: 1,
  price: null,
  status: 'planned',
  reason: 'Wants smoother skin',
  appointment_id: null,
  patient_check_in_id: null,
  source_label: 'Patient file',
  suggested_by_membership_id: 'mem_reenal0000000000000000',
  invoiced_quantity: 0,
  is_fully_invoiced: false,
  is_below_lowest_price: false,
  created_at: '2026-10-10T01:42:03.734Z',
  updated_at: '2026-10-10T01:42:03.734Z',
  ...patch,
});

/** The row as the room reads it. */
const SUGGESTION_RECORD = {
  id: SUGGESTION,
  offeringId: 'off_lhr00000000000000000000',
  name: 'LHR Full Face',
  quantity: 1,
  price: null,
  status: 'planned',
  reason: 'Wants smoother skin',
  sourceLabel: 'Patient file',
  suggestedById: 'mem_reenal0000000000000000',
  invoicedQuantity: 0,
  isFullyInvoiced: false,
  isBelowLowestPrice: false,
  createdAt: '2026-10-10T01:42:03.734Z',
  updatedAt: '2026-10-10T01:42:03.734Z',
};

/** One list page as clinozy-be answers it. */
const page = (
  rows: unknown[],
  meta: Record<string, unknown> = {},
  pagination: { next?: string | null; has_more?: boolean } = {},
) => ({
  data: rows,
  meta: {
    request_id: 'req',
    ...meta,
    pagination: { per_page: 100, next: null, has_more: false, ...pagination },
  },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('plan keys', () => {
  it('sit under the patients’ key, the ideas under the patient’s plan', () => {
    expect(planQueryKeys.all.slice(0, 2)).toEqual([...patientQueryKeys.all]);
    expect(planQueryKeys.ideas('org', PATIENT).slice(0, 5)).toEqual([
      ...planQueryKeys.patient('org', PATIENT),
    ]);
    expect(planContextQueryKeys.all[0]).toBe('clinic');
    expect(planContextQueryKeys.activity('org', 'con_x')).not.toEqual(
      expect.arrayContaining([...planQueryKeys.all]),
    );
  });
});

describe('fetchPlan', () => {
  it('reads every page, newest first, with the server’s plan total', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(
        page([suggestionRow()], { plan_total: 9800 }, { next: 'c2', has_more: true }),
      )
      .mockResolvedValueOnce(
        page([suggestionRow({ id: 'osug_two', price: 5000, quantity: 2 })], {
          plan_total: 9800,
        }),
      );
    const plan = await fetchPlan(PATIENT);
    expect(api.get).toHaveBeenNthCalledWith(
      1,
      '/app/patients/{patient_id}/offering-suggestions',
      {
        params: { patient_id: PATIENT },
        query: { sort: 'created_at', order: 'desc', limit: 100, after: undefined },
      },
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      '/app/patients/{patient_id}/offering-suggestions',
      expect.objectContaining({ query: expect.objectContaining({ after: 'c2' }) }),
    );
    expect(plan.planTotal).toBe(9800);
    expect(plan.suggestions).toEqual([
      SUGGESTION_RECORD,
      { ...SUGGESTION_RECORD, id: 'osug_two', price: 5000, quantity: 2 },
    ]);
  });

  it('reads a total of 0 when the meta has none', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(page([]));
    expect(await fetchPlan(PATIENT)).toEqual({ suggestions: [], planTotal: 0 });
  });
});

describe('fetchPlanIdeas', () => {
  it('reads the server’s ideas (live: `{offering_id, offering_name, category, sessions, price, reason, source}`)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        {
          offering_id: 'off_consult',
          offering_name: 'Consultation',
          category: 'consultation',
          sessions: 1,
          price: 500,
          reason: 'First visit · start with a consultation',
          source: 'first',
        },
      ],
      meta: { request_id: 'req' },
    });
    expect(await fetchPlanIdeas(PATIENT)).toEqual([
      {
        offeringId: 'off_consult',
        name: 'Consultation',
        category: 'consultation',
        sessions: 1,
        price: 500,
        reason: 'First visit · start with a consultation',
      },
    ]);
    expect(api.get).toHaveBeenCalledWith('/app/patients/{patient_id}/offering-ideas', {
      params: { patient_id: PATIENT },
    });
  });
});

describe('planOfferingsOf', () => {
  it('takes every offering of the one catalogue, active or not, A to Z, with its prices', () => {
    const [lhr, peel] = planOfferingsOf([
      offeringRecord({ name: 'Research Peel', isActive: false }),
      offeringRecord({
        id: 'off_lhr',
        name: 'LHR Full Face',
        category: 'package',
        tone: 'lav',
        price: 4800,
        minPrice: null,
        offerPrice: 4500,
        sessions: 7,
      }),
    ]);
    expect(lhr).toEqual({
      id: 'off_lhr',
      name: 'LHR Full Face',
      category: 'package',
      tone: 'lav',
      sessions: 7,
      price: 4800,
      offerPrice: 4500,
      minPrice: null,
      isActive: true,
    });
    expect(peel).toMatchObject({ name: 'Research Peel', isActive: false });
    expect(lhr && billedPrice(lhr)).toBe(4500);
    expect(billedPrice({ price: 3500, offerPrice: null })).toBe(3500);
  });
});

describe('fetchPlanActivity', () => {
  it('reads the last five messages and calls, newest first', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(
      page([
        {
          id: 'msg_one',
          type: 'whatsapp',
          direction: 'sent',
          body: 'Your package is ready',
          delivery_status: 'read',
          occurred_at: '2026-10-09T21:49:57.585Z',
        },
        {
          id: 'msg_call',
          type: 'call_log',
          direction: 'received',
          body: 'Asked about the price',
          delivery_status: null,
          occurred_at: '2026-10-09T20:00:00.000Z',
        },
        {
          id: 'msg_note',
          type: 'note',
          direction: null,
          body: 'Prefers evenings',
          delivery_status: null,
          occurred_at: '2026-10-09T19:00:00.000Z',
        },
      ]),
    );
    const lines = await fetchPlanActivity('con_dharti');
    expect(api.get).toHaveBeenCalledWith('/app/contacts/{contact_id}/activities', {
      params: { contact_id: 'con_dharti' },
      query: {
        type: 'whatsapp,instagram,call_log',
        sort: 'occurred_at',
        order: 'desc',
        limit: 5,
      },
    });
    expect(lines).toEqual([
      {
        id: 'msg_one',
        at: '2026-10-09T21:49:57.585Z',
        channel: 'whatsapp',
        direction: 'sent',
        text: 'Your package is ready',
        delivery: 'read',
      },
      {
        id: 'msg_call',
        at: '2026-10-09T20:00:00.000Z',
        channel: 'call',
        direction: 'received',
        text: 'Asked about the price',
        delivery: null,
      },
    ]);
  });
});

describe('the row writes', () => {
  it('adds an offering with its reason and the action’s key', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: suggestionRow() });
    const row = await createPlanSuggestion({
      patientId: PATIENT,
      input: { offeringId: 'off_lhr00000000000000000000', reason: 'Wants smoother skin' },
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/offering-suggestions',
      {
        params: { patient_id: PATIENT },
        body: {
          offering_id: 'off_lhr00000000000000000000',
          reason: 'Wants smoother skin',
        },
        idempotencyKey: KEY,
      },
    );
    expect(row).toEqual(SUGGESTION_RECORD);
  });

  it('changes a row with `expected_updated_at`', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: suggestionRow({ quantity: 2, price: 7000, is_below_lowest_price: true }),
    });
    const row = await updatePlanSuggestion({
      patientId: PATIENT,
      suggestionId: SUGGESTION,
      change: { quantity: 2, price: 7000 },
      expectedUpdatedAt: '2026-10-10T01:42:03.734Z',
      idempotencyKey: KEY,
    });
    expect(api.patch).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/offering-suggestions/{patient_offering_suggestion_id}',
      {
        params: { patient_id: PATIENT, patient_offering_suggestion_id: SUGGESTION },
        body: {
          quantity: 2,
          price: 7000,
          expected_updated_at: '2026-10-10T01:42:03.734Z',
        },
        idempotencyKey: KEY,
      },
    );
    expect(row).toMatchObject({ quantity: 2, price: 7000, isBelowLowestPrice: true });
  });

  it('removes a row with its reason and note, and restores it', async () => {
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined });
    await deletePlanSuggestion({
      patientId: PATIENT,
      suggestionId: SUGGESTION,
      reason: 'other',
      note: 'Plan changed',
      idempotencyKey: KEY,
    });
    expect(api.delete).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/offering-suggestions/{patient_offering_suggestion_id}',
      {
        params: { patient_id: PATIENT, patient_offering_suggestion_id: SUGGESTION },
        reason: 'other',
        note: 'Plan changed',
        idempotencyKey: KEY,
      },
    );
    await deletePlanSuggestion({
      patientId: PATIENT,
      suggestionId: SUGGESTION,
      reason: 'not_needed',
      note: null,
      idempotencyKey: KEY,
    });
    expect(api.delete).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({ reason: 'not_needed', note: undefined }),
    );

    vi.mocked(api.post).mockResolvedValueOnce({ data: suggestionRow() });
    expect(
      await restorePlanSuggestion({
        patientId: PATIENT,
        suggestionId: SUGGESTION,
        idempotencyKey: KEY,
      }),
    ).toEqual(SUGGESTION_RECORD);
    expect(api.post).toHaveBeenCalledWith(
      '/app/patients/{patient_id}/offering-suggestions/{patient_offering_suggestion_id}/restore',
      {
        params: { patient_id: PATIENT, patient_offering_suggestion_id: SUGGESTION },
        idempotencyKey: KEY,
      },
    );
  });
});
