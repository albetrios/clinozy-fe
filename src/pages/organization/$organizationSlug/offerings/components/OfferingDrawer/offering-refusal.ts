import { apiErrorReason } from '@/shared/errors/errorHandler.ts';
import { HttpError, isHttpError } from '@/shared/errors/HttpError.ts';

/** The refusal reason of a field the member's codes may not set (D81). */
const FIELD_PERMISSION_REQUIRED = 'field_permission_required';

/** The lowest price's field on the wire — the one field an offering guards. */
const LOWEST_PRICE_FIELD = 'min_price';

/** A validation entry as clinozy-be lists it (`errors[]`). */
interface FieldRefusal {
  field: string;
  message: string;
}

/** What {@link offeringRefusalOnForm} needs beside the refusal. */
export interface OfferingRefusalContext {
  /** The member holds `offering:lower_price:read` — the floor is a field they see. */
  canSeeFloor: boolean;
  /** The form bills an offer price: a hidden floor's refusal lands on it, else on the price. */
  hasOfferPrice: boolean;
  /** The member's own words for the two lowest-price refusals. */
  messages: {
    /** "Below this offering’s lowest price — ask an Owner or Admin" (gap 7). */
    belowFloor: string;
    /** The role no longer sets the lowest price (`403 field_permission_required`). */
    floorNeedsPermission: string;
  };
}

/** Whether a listed entry is a validation entry: a field and its message. */
function isFieldRefusal(entry: unknown): entry is FieldRefusal {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'field' in entry &&
    typeof entry.field === 'string' &&
    'message' in entry &&
    typeof entry.message === 'string'
  );
}

/** The validation entries of a 400, as listed; none for anything else. */
function fieldRefusalsOf(error: HttpError): FieldRefusal[] {
  if (error.status !== 400) return [];
  const list: unknown = (
    error.data as { error?: { errors?: unknown } } | null | undefined
  )?.error?.errors;
  return Array.isArray(list) ? list.filter(isFieldRefusal) : [];
}

/** Whether a validation entry names the lowest price (`min_price` or `body.min_price`). */
const namesLowestPrice = ({ field }: FieldRefusal) =>
  field === LOWEST_PRICE_FIELD || field.endsWith(`.${LOWEST_PRICE_FIELD}`);

/** The same refusal as a 400 naming `fields` — the shape the drawer's save puts on its fields. */
function asFieldRefusal(error: HttpError, fields: FieldRefusal[]): HttpError {
  const envelope = (error.data as { error?: object } | null | undefined)?.error ?? {};
  return new HttpError(error.message, 400, error.url, error.method, {
    error: { ...envelope, type: 'validation_error', errors: fields },
  });
}

/**
 * An offering save's refusal as the drawer's form can show it — the lowest price is the one
 * field not every member sees (O15):
 *
 * - `400` on `min_price` for a member without `offering:lower_price:read` (gap 7: the price or
 *   offer price went under a floor they cannot see) lands on the Offer price — or the Price,
 *   with no offer price — in their words: "Below this offering’s lowest price — ask an Owner or
 *   Admin". The server's own words name a field they never saw.
 * - `403 field_permission_required` for a member the drawer let set the floor (their role lost
 *   the code since they signed in) lands on the Lowest price itself.
 *
 * Any other refusal goes through as it came — the save puts a 400's fields on theirs.
 */
export function offeringRefusalOnForm(
  error: unknown,
  { canSeeFloor, hasOfferPrice, messages }: OfferingRefusalContext,
): unknown {
  if (!isHttpError(error)) return error;
  if (error.status === 403 && apiErrorReason(error) === FIELD_PERMISSION_REQUIRED) {
    return canSeeFloor
      ? asFieldRefusal(error, [
          { field: LOWEST_PRICE_FIELD, message: messages.floorNeedsPermission },
        ])
      : error;
  }
  const fields = fieldRefusalsOf(error);
  if (canSeeFloor || !fields.some(namesLowestPrice)) return error;
  const priceField = hasOfferPrice ? 'offer_price' : 'price';
  return asFieldRefusal(error, [
    ...fields.filter((entry) => !namesLowestPrice(entry)),
    { field: priceField, message: messages.belowFloor },
  ]);
}
