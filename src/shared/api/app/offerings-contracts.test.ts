import { describe, expect, it } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';
import { offeringRecord, offerRecord } from '@/tests/utils/offering-doubles.ts';

import {
  isOfferCodeInUse,
  isOfferingNameTaken,
  OFFER_DEFAULTS,
  offerChangeOf,
  OFFERING_DEFAULTS,
  offeringChangeOf,
} from './offerings-contracts.ts';

/** A refusal as the fetch client raises it. */
const refusal = (status: number, error: Record<string, unknown>) =>
  new HttpError('refused', status, '/app/offerings', 'POST', { error });

describe('the conflicts a save reads (D81)', () => {
  it('reads a taken name from its reason, or from a 409 that carries none', () => {
    expect(isOfferingNameTaken(refusal(409, { reason: 'offering_name_taken' }))).toBe(
      true,
    );
    // clinozy-be before D81: "A record with these details already exists", no reason.
    expect(isOfferingNameTaken(refusal(409, { code: 'conflict' }))).toBe(true);
    expect(isOfferingNameTaken(refusal(409, { reason: 'record_changed' }))).toBe(false);
    expect(isOfferingNameTaken(refusal(400, { code: 'validation_error' }))).toBe(false);
    expect(isOfferingNameTaken(new Error('offline'))).toBe(false);
  });

  it('reads a code in use the same way', () => {
    expect(isOfferCodeInUse(refusal(409, { reason: 'offer_code_in_use' }))).toBe(true);
    expect(isOfferCodeInUse(refusal(409, { code: 'conflict' }))).toBe(true);
    expect(isOfferCodeInUse(refusal(409, { reason: 'offering_name_taken' }))).toBe(false);
    expect(isOfferCodeInUse(refusal(409, { reason: 'record_changed' }))).toBe(false);
  });
});

describe('what a change sends', () => {
  it('sends a new offering’s defaults as a full change against an old record', () => {
    const change = offeringChangeOf(
      offeringRecord({ category: 'package', tone: 'lav', sessions: 6 }),
      { ...OFFERING_DEFAULTS, name: 'Research Peel', price: 2000 },
      { canSetLowestPrice: true },
    );
    expect(change).toEqual({
      category: 'treatment',
      tone: 'sage',
      branch_ids: [],
      offer_price: null,
      sessions: 1,
      search_terms: [],
      description: null,
    });
  });

  it('sends nothing when only the code’s case differs', () => {
    expect(
      offerChangeOf(offerRecord(), {
        ...OFFER_DEFAULTS,
        name: 'Research Diwali glow',
        code: 'Diwali25',
        value: 15,
        offeringIds: offerRecord().offeringIds,
      }),
    ).toBeNull();
  });
});
