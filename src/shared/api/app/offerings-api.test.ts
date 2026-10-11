import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/http/api.ts', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
import { api } from '@/core/http/api.ts';
import { queryClient } from '@/core/http/queryClient.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  offeringRecord,
  offeringWireRow,
  offerRecord,
  offerWireRow,
  TEST_OFFER_ID,
  TEST_OFFERING_BRANCH_ID,
  TEST_OFFERING_ID,
} from '@/tests/utils/offering-doubles.ts';

import {
  createOffer,
  createOffering,
  deleteOffer,
  deleteOffering,
  fetchAllOfferings,
  fetchAllOffers,
  fetchOffer,
  fetchOffering,
  offeringMatchesSearch,
  offerMatchesSearch,
  restoreOffer,
  restoreOffering,
  setOfferActive,
  updateOffer,
  updateOffering,
} from './offerings-api.ts';
import type { OfferFields, OfferingFields } from './offerings-contracts.ts';

const KEY = 'key-offerings-test';
const ADAJAN = 'brn_53j4b7hz7nfb0otr2d920';
const DEFAULT_GST = 'off_nl9wbfq42fsg6543qmwk7';

/** A page of rows as clinozy-be answers a list. */
const page = (rows: unknown[], next: string | null = null) => ({
  data: rows,
  meta: { pagination: { per_page: 100, next, has_more: next !== null } },
});

/** Research Peel's fields as its drawer reads them. */
const peelFields = (patch: Partial<OfferingFields> = {}): OfferingFields => ({
  name: 'Research Peel',
  category: 'treatment',
  tone: 'sage',
  branchIds: [TEST_OFFERING_BRANCH_ID],
  price: 2000,
  offerPrice: 1800,
  minPrice: 1500,
  sessions: 1,
  gstPercent: 18,
  isGstInclusive: false,
  durationMin: 30,
  validityDays: 0,
  searchTerms: ['chemical', 'glow'],
  description: 'Research row (offerings room brief)',
  isActive: true,
  ...patch,
});

/** The offer's fields as its drawer reads them. */
const glowFields = (patch: Partial<OfferFields> = {}): OfferFields => ({
  name: 'Research Diwali glow',
  code: 'DIWALI25',
  kind: 'percent',
  value: 15,
  offeringIds: [TEST_OFFERING_ID],
  branchIds: [],
  startsOn: null,
  endsOn: null,
  isActive: true,
  tone: 'blush',
  note: null,
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
});
afterEach(() => {
  queryClient.clear();
});

describe('the offerings reads', () => {
  it('reads the whole catalogue a hundred at a time, in rupees', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(page([offeringWireRow()], 'cur_2'))
      .mockResolvedValueOnce(
        page([offeringWireRow({ id: DEFAULT_GST, offering_number: 6, price: 999.5 })]),
      );

    const rows = await fetchAllOfferings();

    expect(api.get).toHaveBeenNthCalledWith(1, '/app/offerings', {
      query: { limit: 100, after: undefined },
    });
    expect(api.get).toHaveBeenNthCalledWith(2, '/app/offerings', {
      query: { limit: 100, after: 'cur_2' },
    });
    expect(rows).toEqual([
      offeringRecord(),
      offeringRecord({ id: DEFAULT_GST, offeringNumber: 6, price: 999.5 }),
    ]);
  });

  it('reads a hidden lowest price as null (O15)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: offeringWireRow({ min_price: null }) });
    expect((await fetchOffering(TEST_OFFERING_ID)).minPrice).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/app/offerings/{offering_id}', {
      params: { offering_id: TEST_OFFERING_ID },
    });
  });

  it('refuses a row the API never answers — a GST rate it does not take', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: offeringWireRow({ gst_percent: 7 }) });
    await expect(fetchOffering(TEST_OFFERING_ID)).rejects.toThrow();
  });
});

describe('createOffering', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({
      data: { name: 'Demo Organization', specialties: ['dental', 'skin'] },
    });
    vi.mocked(api.post).mockResolvedValue({ data: offeringWireRow() });
  });

  it('creates in the clinic’s first specialty, with the lowest price from a member who may set it', async () => {
    const created = await createOffering({
      fields: peelFields({
        searchTerms: [' chemical ', '', 'glow'],
        description: '  ',
      }),
      canSetLowestPrice: true,
      idempotencyKey: KEY,
    });

    expect(api.get).toHaveBeenCalledWith('/tenancy/organization');
    expect(api.post).toHaveBeenCalledWith('/app/offerings', {
      body: {
        name: 'Research Peel',
        category: 'treatment',
        tone: 'sage',
        branch_ids: [TEST_OFFERING_BRANCH_ID],
        price: 2000,
        offer_price: 1800,
        sessions: 1,
        is_gst_inclusive: false,
        duration_minutes: 30,
        validity_days: 0,
        search_terms: ['chemical', 'glow'],
        description: null,
        is_active: true,
        specialty: 'dental',
        gst_percent: 18,
        min_price: 1500,
      },
      idempotencyKey: KEY,
    });
    expect(created.offeringNumber).toBe(5);
  });

  it('never sends the lowest price without offering:lower_price:read, and leaves the GST to the server', async () => {
    await createOffering({
      fields: peelFields({ gstPercent: null }),
      canSetLowestPrice: false,
      idempotencyKey: KEY,
    });
    const body = vi.mocked(api.post).mock.calls[0]?.[1]?.body ?? {};
    expect(body).not.toHaveProperty('min_price');
    expect(body).not.toHaveProperty('gst_percent');
  });

  it('lets the server choose the specialty when the clinic has none, and reads them once', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { name: 'Demo', specialties: [] } });
    await createOffering({
      fields: peelFields(),
      canSetLowestPrice: true,
      idempotencyKey: KEY,
    });
    await createOffering({
      fields: peelFields(),
      canSetLowestPrice: true,
      idempotencyKey: KEY,
    });
    expect(vi.mocked(api.post).mock.calls[0]?.[1]?.body).not.toHaveProperty('specialty');
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe('updateOffering', () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockResolvedValue({ data: offeringWireRow({ price: 2200 }) });
  });

  it('sends only what changed, with the read’s updated_at', async () => {
    const saved = await updateOffering({
      record: offeringRecord(),
      fields: peelFields({ price: 2200, branchIds: [TEST_OFFERING_BRANCH_ID] }),
      canSetLowestPrice: true,
      idempotencyKey: KEY,
    });

    expect(api.patch).toHaveBeenCalledWith('/app/offerings/{offering_id}', {
      params: { offering_id: TEST_OFFERING_ID },
      body: { price: 2200, expected_updated_at: '2026-10-10T04:50:29.931Z' },
      idempotencyKey: KEY,
    });
    expect(saved.price).toBe(2200);
  });

  it('reads the branches as a set and keeps a null GST rate as saved', async () => {
    const record = offeringRecord({ branchIds: [TEST_OFFERING_BRANCH_ID, ADAJAN] });
    const saved = await updateOffering({
      record,
      fields: peelFields({
        branchIds: [ADAJAN, TEST_OFFERING_BRANCH_ID],
        gstPercent: null,
      }),
      canSetLowestPrice: true,
      idempotencyKey: KEY,
    });
    expect(api.patch).not.toHaveBeenCalled();
    expect(saved).toBe(record);
  });

  it('sends a changed lowest price only from a member who may set it', async () => {
    await updateOffering({
      record: offeringRecord({ minPrice: null }),
      fields: peelFields({ minPrice: 0, name: 'Research Peel Plus' }),
      canSetLowestPrice: false,
      idempotencyKey: KEY,
    });
    expect(vi.mocked(api.patch).mock.calls[0]?.[1]?.body).toEqual({
      name: 'Research Peel Plus',
      expected_updated_at: '2026-10-10T04:50:29.931Z',
    });

    vi.mocked(api.patch).mockClear();
    await updateOffering({
      record: offeringRecord(),
      fields: peelFields({ minPrice: 1200 }),
      canSetLowestPrice: true,
      idempotencyKey: KEY,
    });
    expect(vi.mocked(api.patch).mock.calls[0]?.[1]?.body).toEqual({
      min_price: 1200,
      expected_updated_at: '2026-10-10T04:50:29.931Z',
    });
  });

  it('sends an emptied offer price, the search terms in their new order and a cleared description', async () => {
    await updateOffering({
      record: offeringRecord(),
      fields: peelFields({
        offerPrice: null,
        searchTerms: ['glow', 'chemical'],
        description: null,
      }),
      canSetLowestPrice: true,
      idempotencyKey: KEY,
    });
    expect(vi.mocked(api.patch).mock.calls[0]?.[1]?.body).toEqual({
      offer_price: null,
      search_terms: ['glow', 'chemical'],
      description: null,
      expected_updated_at: '2026-10-10T04:50:29.931Z',
    });
  });
});

describe('deleting and restoring an offering', () => {
  it('deletes with the reason and its note', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined });
    await deleteOffering({ offeringId: TEST_OFFERING_ID, reason: 'other', note: 'old' });
    await deleteOffering({ offeringId: TEST_OFFERING_ID, reason: 'mistake', note: null });
    expect(api.delete).toHaveBeenNthCalledWith(1, '/app/offerings/{offering_id}', {
      params: { offering_id: TEST_OFFERING_ID },
      reason: 'other',
      note: 'old',
    });
    expect(api.delete).toHaveBeenNthCalledWith(2, '/app/offerings/{offering_id}', {
      params: { offering_id: TEST_OFFERING_ID },
      reason: 'mistake',
      note: undefined,
    });
  });

  it('restores with the Undo’s key', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: offeringWireRow() });
    expect(await restoreOffering(TEST_OFFERING_ID, KEY)).toEqual(offeringRecord());
    expect(api.post).toHaveBeenCalledWith('/app/offerings/{offering_id}/restore', {
      params: { offering_id: TEST_OFFERING_ID },
      idempotencyKey: KEY,
    });
  });
});

describe('the offers', () => {
  it('reads every offer in the server’s order, with its status', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce(page([offerWireRow()], 'cur_2'))
      .mockResolvedValueOnce(
        page([
          offerWireRow({
            id: 'ofr_ztlz67deab7f5yeztz3kl',
            kind: 'amount',
            value: 250.5,
            status: 'ended',
          }),
        ]),
      );
    const offers = await fetchAllOffers();
    expect(api.get).toHaveBeenLastCalledWith('/app/offers', {
      query: { limit: 100, after: 'cur_2' },
    });
    expect(offers.map((offer) => [offer.status, offer.value])).toEqual([
      ['live', 15],
      ['ended', 250.5],
    ]);
  });

  it('reads one offer', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: offerWireRow() });
    expect(await fetchOffer(TEST_OFFER_ID)).toEqual(offerRecord());
  });

  it('creates an offer with its code and note trimmed — the server upper-cases the code', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: offerWireRow() });
    await createOffer({
      fields: glowFields({
        code: ' diwali25 ',
        note: '  ',
        name: ' Research Diwali glow ',
      }),
      idempotencyKey: KEY,
    });
    expect(api.post).toHaveBeenCalledWith('/app/offers', {
      body: {
        name: 'Research Diwali glow',
        code: 'diwali25',
        kind: 'percent',
        value: 15,
        offering_ids: [TEST_OFFERING_ID],
        branch_ids: [],
        starts_on: null,
        ends_on: null,
        is_active: true,
        tone: 'blush',
        note: null,
      },
      idempotencyKey: KEY,
    });
  });

  it('sends the offerings only when the set changed (OFFERINGS-M5)', async () => {
    vi.mocked(api.patch).mockResolvedValue({ data: offerWireRow() });
    const record = offerRecord({ offeringIds: [TEST_OFFERING_ID, DEFAULT_GST] });
    await updateOffer({
      record,
      fields: glowFields({
        name: 'Diwali glow',
        code: 'diwali25',
        offeringIds: [DEFAULT_GST, TEST_OFFERING_ID],
      }),
      idempotencyKey: KEY,
    });
    expect(api.patch).toHaveBeenCalledWith('/app/offers/{offer_id}', {
      params: { offer_id: TEST_OFFER_ID },
      body: { name: 'Diwali glow', expected_updated_at: '2026-10-10T04:51:04.269Z' },
      idempotencyKey: KEY,
    });

    vi.mocked(api.patch).mockClear();
    await updateOffer({
      record,
      fields: glowFields({ offeringIds: [TEST_OFFERING_ID] }),
      idempotencyKey: KEY,
    });
    expect(vi.mocked(api.patch).mock.calls[0]?.[1]?.body).toEqual({
      offering_ids: [TEST_OFFERING_ID],
      expected_updated_at: '2026-10-10T04:51:04.269Z',
    });
  });

  it('sends nothing for an offer nothing changed on', async () => {
    const record = offerRecord();
    expect(await updateOffer({ record, fields: glowFields(), idempotencyKey: KEY })).toBe(
      record,
    );
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('pauses with is_active alone, and reads the status the server worked out', async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: offerWireRow({ is_active: false, status: 'paused' }),
    });
    const paused = await setOfferActive({
      offerId: TEST_OFFER_ID,
      isActive: false,
      idempotencyKey: KEY,
    });
    expect(api.patch).toHaveBeenCalledWith('/app/offers/{offer_id}', {
      params: { offer_id: TEST_OFFER_ID },
      body: { is_active: false },
      idempotencyKey: KEY,
    });
    expect(paused).toMatchObject({ isActive: false, status: 'paused' });
  });

  it('deletes an offer with its reason and restores it with the Undo’s key', async () => {
    vi.mocked(api.delete).mockResolvedValue({ data: undefined });
    vi.mocked(api.post).mockResolvedValue({ data: offerWireRow() });
    await deleteOffer({ offerId: TEST_OFFER_ID, reason: 'duplicate', note: null });
    await restoreOffer(TEST_OFFER_ID, KEY);
    expect(api.delete).toHaveBeenCalledWith('/app/offers/{offer_id}', {
      params: { offer_id: TEST_OFFER_ID },
      reason: 'duplicate',
      note: undefined,
    });
    expect(api.post).toHaveBeenCalledWith('/app/offers/{offer_id}/restore', {
      params: { offer_id: TEST_OFFER_ID },
      idempotencyKey: KEY,
    });
  });
});

describe('searching in place', () => {
  it('finds an offering by its name, a search term or its number', () => {
    const peel = offeringRecord();
    expect(offeringMatchesSearch(peel, 'PEEL')).toBe(true);
    expect(offeringMatchesSearch(peel, 'chemical')).toBe(true);
    expect(offeringMatchesSearch(peel, '#5')).toBe(true);
    expect(offeringMatchesSearch(peel, '  ')).toBe(true);
    expect(offeringMatchesSearch(peel, 'laser')).toBe(false);
  });

  it('finds an offer by its name, its code or an offering’s name', () => {
    const names = new Map([[TEST_OFFERING_ID, 'Research Peel']]);
    const glow = offerRecord();
    expect(offerMatchesSearch(glow, 'diwali25', (id) => names.get(id))).toBe(true);
    expect(offerMatchesSearch(glow, 'peel', (id) => names.get(id))).toBe(true);
    expect(offerMatchesSearch(glow, 'peel', () => undefined)).toBe(false);
  });
});
