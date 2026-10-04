import { MONEY_SCALE, numberFromText, textFromNumber } from '@/lib/number-text.ts';
import type { OfferKind, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import {
  OFFER_DEFAULTS,
  type OfferInput,
  type OfferRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';

/**
 * The Offer drawer's form (`offerings.md:91–112`; KICKOFF §6.11): text as
 * typed, the value as its field shows it — a whole number for "% off" and
 * "Extra sessions", rupees for "₹ off" and "Fixed price" — dates as civil
 * `YYYY-MM-DD` (empty = "Now" / "no end"). {@link offerInputOf} turns it into
 * the contract's fields.
 */
export interface OfferFormValues {
  name: string;
  /** Upper-cased and stripped of spaces as typed. */
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
  /** Status "Live · applies automatically"; off = "Paused". */
  live: boolean;
}

/** The form's own limits (`offerings.md:95–110`): the contract allows a longer name (80) and code (16). */
export const OFFER_FORM_LIMITS = {
  name: 60,
  code: 12,
  money: 7,
  percent: 100,
  extraSessions: 20,
  note: 1000,
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

/** A code as the field keeps it: upper case, no spaces, at most 12 characters (H:5511). */
export function codeOf(text: string): string {
  return text.replace(/\s/g, '').toUpperCase().slice(0, OFFER_FORM_LIMITS.code);
}

/** The value in the contract's unit: a whole number, or paise for money. */
export function offerValueOf(values: Pick<OfferFormValues, 'kind' | 'value'>): number {
  return isCountedKind(values.kind)
    ? Math.round(Number.parseFloat(values.value) || 0)
    : numberFromText(values.value, MONEY_SCALE);
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
    live: !OFFER_DEFAULTS.paused,
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
      : textFromNumber(offer.value, MONEY_SCALE),
    tone: offer.tone,
    offeringIds: [...offer.offeringIds],
    branchIds: [...offer.branchIds],
    startsOn: offer.startsOn,
    endsOn: offer.endsOn,
    note: offer.note ?? '',
    live: !offer.paused,
  };
}

/** The contract's fields for a form (`createOffer` / `updateOffer`). */
export function offerInputOf(values: OfferFormValues): OfferInput {
  return {
    name: values.name.trim(),
    code: values.code || null,
    kind: values.kind,
    value: offerValueOf(values),
    tone: values.tone,
    offeringIds: values.offeringIds,
    branchIds: values.branchIds,
    startsOn: values.startsOn,
    endsOn: values.endsOn,
    paused: !values.live,
    note: values.note.trim() || null,
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
