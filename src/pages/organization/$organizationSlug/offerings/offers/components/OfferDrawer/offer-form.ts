import {
  MONEY_SCALE,
  numberFromText,
  paiseOfRupees,
  rupeesOfPaise,
  textFromNumber,
} from '@/lib/number-text.ts';
import type { OfferKind, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import {
  OFFER_DEFAULTS,
  type OfferFields,
  type OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';

/**
 * The Offer drawer's form (`offerings.md:91–112`; KICKOFF §6.11): text as
 * typed, the value as its field shows it — a whole number for "% off" and
 * "Extra sessions", rupees for "₹ off" and "Fixed price" — dates as civil
 * `YYYY-MM-DD` (empty = "Now" / "no end"). {@link offerFieldsOf} turns it into
 * the fields clinozy-be takes (money in rupees, at the form's boundary).
 */
export interface OfferFormValues {
  name: string;
  /** Upper-cased, letters and digits only, as typed. */
  code: string;
  kind: OfferKind;
  /** The value as its field holds it: "20" (%, sessions) or "500" (₹). */
  value: string;
  tone: Tone;
  /** Picked offerings, in pick order. */
  offeringIds: string[];
  /** Empty = every branch. */
  branchIds: string[];
  startsOn: string | null;
  endsOn: string | null;
  note: string;
  /** Status "Live · applies automatically" (`is_active`); off = "Paused". */
  live: boolean;
}

/**
 * The form's own limits (`offerings.md:95–110`): the API allows a longer name (80) and code
 * (16); free sessions 1–99 and a note of 280 are the API's (`/app/offers`).
 */
export const OFFER_FORM_LIMITS = {
  name: 60,
  code: 12,
  money: 7,
  percent: 100,
  extraSessions: 99,
  note: 280,
  /** Preview boxes shown, in pick order (`offerings.md:105`). */
  previews: 6,
} as const;

/** The eight colours an offer takes (`offerings.md:99`), in the swatch row's order. */
export const OFFER_TONES: readonly Tone[] = [
  'blush',
  'lav',
  'sky',
  'butter',
  'sage',
  'mint',
  'peach',
  'plum',
];

/** "% off"'s quick picks (`offerings.md:98`). */
export const PERCENT_QUICK_PICKS: readonly number[] = [10, 15, 20, 25];

/** The kinds counted as a whole number (a stepper), not money. */
const COUNTED_KINDS: ReadonlySet<OfferKind> = new Set(['percent', 'extra']);

/** Whether a kind's value is a whole number in a stepper ("% off", "Extra sessions"). */
export const isCountedKind = (kind: OfferKind): boolean => COUNTED_KINDS.has(kind);

/**
 * The value a kind starts with when it is picked (H:5512): 10% · ₹500 ·
 * nothing for a fixed price · 1 session.
 */
export const KIND_START_VALUES: Readonly<Record<OfferKind, string>> = {
  percent: '10',
  amount: '500',
  fixed: '',
  extra: '1',
};

/**
 * A code as the field keeps it (H:5511): upper case, at most 12 characters — and only letters
 * and digits, all the API takes (`[A-Za-z0-9]`), so a space or a dash never reaches it.
 */
export function codeOf(text: string): string {
  return text
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, OFFER_FORM_LIMITS.code);
}

/**
 * The value in the API's unit: a whole number for "% off" and "Extra sessions", rupees to the
 * paisa for "₹ off" and "Fixed price".
 */
export function offerValueOf(values: Pick<OfferFormValues, 'kind' | 'value'>): number {
  return isCountedKind(values.kind)
    ? Math.round(Number.parseFloat(values.value) || 0)
    : rupeesOfPaise(numberFromText(values.value, MONEY_SCALE));
}

/** A new offer's form: "% off" at 10, blush, every branch, no dates, Live (`offerings.md:316`). */
export function emptyOfferForm(): OfferFormValues {
  return {
    name: '',
    code: '',
    kind: OFFER_DEFAULTS.kind,
    value: String(OFFER_DEFAULTS.value),
    tone: OFFER_DEFAULTS.tone,
    offeringIds: [],
    branchIds: [...OFFER_DEFAULTS.branchIds],
    startsOn: OFFER_DEFAULTS.startsOn,
    endsOn: OFFER_DEFAULTS.endsOn,
    note: '',
    live: OFFER_DEFAULTS.isActive,
  };
}

/** A saved offer's form, for Edit offer. */
export function offerFormOf(offer: OfferRecord): OfferFormValues {
  return {
    name: offer.name,
    code: offer.code ?? '',
    kind: offer.kind,
    value: isCountedKind(offer.kind)
      ? String(offer.value)
      : textFromNumber(paiseOfRupees(offer.value), MONEY_SCALE),
    tone: offer.tone,
    offeringIds: [...offer.offeringIds],
    branchIds: [...offer.branchIds],
    startsOn: offer.startsOn,
    endsOn: offer.endsOn,
    note: offer.note ?? '',
    live: offer.isActive,
  };
}

/**
 * The fields a form writes (`useCreateOffer` / `useUpdateOffer`): an empty code or note is
 * none, Paused is `isActive: false`. An edit sends only what changed (`offerChangeOf`).
 */
export function offerFieldsOf(values: OfferFormValues): OfferFields {
  const note = values.note.trim();
  return {
    name: values.name.trim(),
    code: values.code === '' ? null : values.code,
    kind: values.kind,
    value: offerValueOf(values),
    tone: values.tone,
    offeringIds: values.offeringIds,
    branchIds: values.branchIds,
    startsOn: values.startsOn,
    endsOn: values.endsOn,
    isActive: values.live,
    note: note === '' ? null : note,
  };
}

/** The required fields still empty — Save opens their step instead (H:3852). */
export function missingOfferFields(
  values: Pick<OfferFormValues, 'name' | 'offeringIds'>,
): ('name' | 'offeringIds')[] {
  const missing: ('name' | 'offeringIds')[] = [];
  if (!values.name.trim()) missing.push('name');
  if (values.offeringIds.length === 0) missing.push('offeringIds');
  return missing;
}

/**
 * The rule a form breaks once its required fields are in (H:5521): no value
 * for its kind, or an end before the start. `null` when it holds.
 */
export function offerProblem(
  values: Pick<OfferFormValues, 'kind' | 'value' | 'startsOn' | 'endsOn'>,
): { field: 'value' | 'endsOn'; rule: 'value' | 'endsBeforeStart' } | null {
  if (offerValueOf(values) <= 0) return { field: 'value', rule: 'value' };
  if (values.startsOn && values.endsOn && values.endsOn < values.startsOn) {
    return { field: 'endsOn', rule: 'endsBeforeStart' };
  }
  return null;
}
