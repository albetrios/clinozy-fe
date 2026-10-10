import { describe, expect, it } from 'vitest';

import { HttpError } from '@/shared/errors/HttpError.ts';

import {
  type OfferingRefusalContext,
  offeringRefusalOnForm,
} from './offering-refusal.ts';

const OFFERING_PATH = '/api/v1/app/offerings/off_xh6ravxjcszcpta6taym0';

const MESSAGES: OfferingRefusalContext['messages'] = {
  belowFloor: 'Below this offering’s lowest price — ask an Owner or Admin',
  floorNeedsPermission: 'Your role can’t change the lowest price — ask an Owner or Admin',
};

/** clinozy-be's `400` for the prices out of order, as the live stack answers it. */
const floorRefusal = (
  errors = [{ field: 'min_price', message: "The lowest price can't be above the price" }],
) =>
  new HttpError('Bad Request', 400, OFFERING_PATH, 'PATCH', {
    error: {
      type: 'validation_error',
      code: 'invalid_field',
      detail: "The lowest price can't be above the price",
      errors,
    },
  });

/** clinozy-be's `403` for a guarded field sent without its code. */
const fieldPermissionRefusal = () =>
  new HttpError('Forbidden', 403, OFFERING_PATH, 'PATCH', {
    error: {
      type: 'request_error',
      code: 'forbidden',
      reason: 'field_permission_required',
      detail: 'You need the offering:lower_price:read permission to change min_price',
    },
  });

/** The `errors[]` of a re-addressed refusal. */
function listed(error: unknown) {
  expect(error).toBeInstanceOf(HttpError);
  const refusal = error as HttpError;
  expect(refusal.status).toBe(400);
  return (refusal.data as { error: { errors: unknown } }).error.errors;
}

describe('offeringRefusalOnForm', () => {
  it('puts a hidden floor’s refusal on the Offer price, in the member’s words (gap 7)', () => {
    const error = offeringRefusalOnForm(floorRefusal(), {
      canSeeFloor: false,
      hasOfferPrice: true,
      messages: MESSAGES,
    });
    expect(listed(error)).toEqual([
      { field: 'offer_price', message: MESSAGES.belowFloor },
    ]);
  });

  it('puts it on the Price when no offer price is billed, keeping the other fields', () => {
    const error = offeringRefusalOnForm(
      floorRefusal([
        { field: 'body.min_price', message: "The lowest price can't be above the price" },
        { field: 'body.sessions', message: 'Too big' },
      ]),
      { canSeeFloor: false, hasOfferPrice: false, messages: MESSAGES },
    );
    expect(listed(error)).toEqual([
      { field: 'body.sessions', message: 'Too big' },
      { field: 'price', message: MESSAGES.belowFloor },
    ]);
  });

  it('leaves the floor’s refusal on the floor for a member who sees it', () => {
    const refusal = floorRefusal();
    expect(
      offeringRefusalOnForm(refusal, {
        canSeeFloor: true,
        hasOfferPrice: false,
        messages: MESSAGES,
      }),
    ).toBe(refusal);
  });

  it('puts 403 field_permission_required on the Lowest price for a member it was shown to', () => {
    const error = offeringRefusalOnForm(fieldPermissionRefusal(), {
      canSeeFloor: true,
      hasOfferPrice: false,
      messages: MESSAGES,
    });
    expect(listed(error)).toEqual([
      { field: 'min_price', message: MESSAGES.floorNeedsPermission },
    ]);
    expect((error as HttpError).data).toMatchObject({
      error: { reason: 'field_permission_required' },
    });
  });

  it('passes every other refusal through as it came', () => {
    const forbidden = fieldPermissionRefusal();
    const context = { canSeeFloor: false, hasOfferPrice: false, messages: MESSAGES };
    expect(offeringRefusalOnForm(forbidden, context)).toBe(forbidden);
    const name = floorRefusal([{ field: 'body.name', message: 'Too long' }]);
    expect(offeringRefusalOnForm(name, context)).toBe(name);
    const conflict = new HttpError('Conflict', 409, OFFERING_PATH, 'PATCH', {
      error: { reason: 'record_changed' },
    });
    expect(offeringRefusalOnForm(conflict, context)).toBe(conflict);
    const dropped = new TypeError('Failed to fetch');
    expect(offeringRefusalOnForm(dropped, context)).toBe(dropped);
  });
});
