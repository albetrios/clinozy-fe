import { MONEY_SCALE, numberFromText, textFromNumber } from '@/lib/number-text.ts';
import type { OfferingCategory, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import {
  OFFERING_DEFAULTS,
  type OfferingInput,
  type OfferingRecord,
} from '@/shared/api/clinic/offerings-contracts.ts';

/**
 * The Offering drawer's form (`offerings.md:59–80`; KICKOFF §6.11): text as
 * typed — money in rupees, as the fields show it — chips as the contract's
 * values, steppers as whole numbers. {@link offeringInputOf} turns it into the
 * contract's fields.
 */
export interface OfferingFormValues {
  name: string;
  category: OfferingCategory;
  tone: Tone;
  /** Picked in "Available at"; empty = every branch. */
  branchIds: string[];
  /** The list price in rupees as typed ("7500", "12.5"); empty or 0 is missing. */
  price: string;
  /** What the desk bills, rupees as typed; empty bills the list price. */
  offerPrice: string;
  sessions: number;
  /** GST % as typed; empty is 0. */
  gstPct: string;
  gstInclusive: boolean;
  /** The lowest price, rupees as typed; empty is none. */
  minPrice: string;
  durationMin: number;
  validityDays: number;
  /** As typed — "laser, face, hair removal". */
  searchTerms: string;
  description: string;
  active: boolean;
}

/**
 * The form's own limits (`offerings.md:63–79`): the contract takes a longer
 * name (120); the steppers stop at the contract's ranges.
 */
export const OFFERING_FORM_LIMITS = {
  name: 60,
  /** A money field's characters — digits and one point. */
  money: 7,
  gstPct: 100,
  sessions: 99,
  durationMin: 480,
  validityDays: 1095,
  searchTerms: 80,
  description: 1000,
} as const;

/** The six colours an offering takes (`offerings.md:65`), in the swatch row's order. */
export const OFFERING_TONES: readonly Tone[] = [
  'lav',
  'sky',
  'butter',
  'blush',
  'sage',
  'mint',
];

/** Sessions' quick picks (`offerings.md:69`). */
export const SESSION_QUICK_PICKS: readonly number[] = [1, 4, 6, 8, 10];

/** Duration's quick picks in minutes (`offerings.md:76`). */
export const DURATION_QUICK_PICKS: readonly number[] = [15, 20, 30, 45, 60, 90];

/** Validity's quick picks in days — None · 3 mo · 6 mo · 1 yr (`offerings.md:77`). */
export const VALIDITY_QUICK_PICKS = [
  { id: 'none', days: 0 },
  { id: 'quarter', days: 90 },
  { id: 'half', days: 180 },
  { id: 'year', days: 365 },
] as const;

/** A money field's typed rupees as paise; empty is 0. */
export const paiseOfText = (text: string): number => numberFromText(text, MONEY_SCALE);

/** Paise as a money field shows them: the plain figure, nothing for 0. */
const textOfPaise = (paise: number): string => textFromNumber(paise, MONEY_SCALE);

/** A new offering's form: the contract's defaults and the prefill's name (`?name=`, `S:99`). */
export function emptyOfferingForm(prefill: { name?: string } = {}): OfferingFormValues {
  return {
    name: (prefill.name ?? '').trim().slice(0, OFFERING_FORM_LIMITS.name),
    category: OFFERING_DEFAULTS.category,
    tone: OFFERING_DEFAULTS.tone,
    branchIds: [...OFFERING_DEFAULTS.branchIds],
    price: '',
    offerPrice: '',
    sessions: OFFERING_DEFAULTS.sessions,
    gstPct: '',
    gstInclusive: OFFERING_DEFAULTS.gstInclusive,
    minPrice: '',
    durationMin: OFFERING_DEFAULTS.durationMin,
    validityDays: OFFERING_DEFAULTS.validityDays,
    searchTerms: '',
    description: '',
    active: OFFERING_DEFAULTS.active,
  };
}

/** A saved offering's form, for Edit offering. */
export function offeringFormOf(offering: OfferingRecord): OfferingFormValues {
  return {
    name: offering.name,
    category: offering.category,
    tone: offering.tone,
    branchIds: [...offering.branchIds],
    price: textOfPaise(offering.price),
    offerPrice: offering.offerPrice === null ? '' : textOfPaise(offering.offerPrice),
    sessions: offering.sessions,
    gstPct: offering.gstPct === 0 ? '' : String(offering.gstPct),
    gstInclusive: offering.gstInclusive,
    minPrice: textOfPaise(offering.minPrice),
    durationMin: offering.durationMin,
    validityDays: offering.validityDays,
    searchTerms: offering.searchTerms.join(', '),
    description: offering.description ?? '',
    active: offering.active,
  };
}

/** Search terms as typed, split on commas, blanks dropped (`offerings.md:78`). */
export function splitSearchTerms(text: string): string[] {
  return text
    .split(',')
    .map((term) => term.trim())
    .filter(Boolean);
}

/**
 * What the offering's pricing reads from the form, in paise: the offer price
 * only while it is set below the price — empty or at least the price bills
 * the list price (`offerings.md:66`).
 */
export function offeringPricesOf(
  values: Pick<OfferingFormValues, 'price' | 'offerPrice' | 'minPrice'>,
): { price: number; offerPrice: number | null; minPrice: number } {
  const price = paiseOfText(values.price);
  const offer = paiseOfText(values.offerPrice);
  return {
    price,
    offerPrice: offer > 0 && offer < price ? offer : null,
    minPrice: paiseOfText(values.minPrice),
  };
}

/**
 * The contract's fields for a form (`createOffering` / `updateOffering`): the
 * name trimmed, money in paise, at least one session, search terms split on
 * commas, an empty description none. No lowest price is invented (Q-O4).
 */
export function offeringInputOf(
  values: OfferingFormValues,
): Omit<OfferingInput, 'specialty' | 'defaultDoctorId' | 'room'> {
  return {
    name: values.name.trim(),
    category: values.category,
    tone: values.tone,
    branchIds: values.branchIds,
    ...offeringPricesOf(values),
    sessions: Math.max(1, values.sessions),
    gstPct: Number.parseFloat(values.gstPct) || 0,
    gstInclusive: values.gstInclusive,
    durationMin: values.durationMin,
    validityDays: values.validityDays,
    searchTerms: splitSearchTerms(values.searchTerms),
    description: values.description.trim() || null,
    active: values.active,
  };
}

/** The required fields (Name, Price) still empty — Save opens their step instead (H:3852). */
export function missingOfferingFields(
  values: Pick<OfferingFormValues, 'name' | 'price'>,
): ('name' | 'price')[] {
  const missing: ('name' | 'price')[] = [];
  if (!values.name.trim()) missing.push('name');
  if (paiseOfText(values.price) <= 0) missing.push('price');
  return missing;
}

/**
 * The price rule a form breaks (H:5507), checked before the save: an offer
 * price above the price, or a lowest price above what is billed (the offer
 * price, else the price). `null` when both hold.
 */
export function offeringPriceProblem(
  values: Pick<OfferingFormValues, 'price' | 'offerPrice' | 'minPrice'>,
): {
  field: 'offerPrice' | 'minPrice';
  rule: 'offerAbovePrice' | 'floorAboveOffer';
} | null {
  const price = paiseOfText(values.price);
  const offer = paiseOfText(values.offerPrice);
  const floor = paiseOfText(values.minPrice);
  if (offer > 0 && offer > price) return { field: 'offerPrice', rule: 'offerAbovePrice' };
  if (floor > 0 && floor > (offer || price)) {
    return { field: 'minPrice', rule: 'floorAboveOffer' };
  }
  return null;
}

/** A Quick fill preset (`offerings.md:240`): what it sets, in its chip's tone. */
export interface OfferingQuickFill {
  id: 'single' | 'pack' | 'lhr' | 'consultation';
  tone: Tone;
  values: Partial<OfferingFormValues>;
}

/** New offering's Quick fill, in order; each prefills, none saves. */
export const OFFERING_QUICK_FILLS: readonly OfferingQuickFill[] = [
  {
    id: 'single',
    tone: 'sage',
    values: { category: 'treatment', sessions: 1, validityDays: 0, durationMin: 30 },
  },
  {
    id: 'pack',
    tone: 'lav',
    values: { category: 'package', sessions: 6, validityDays: 180, durationMin: 45 },
  },
  {
    id: 'lhr',
    tone: 'blush',
    values: {
      category: 'lhr',
      sessions: 10,
      validityDays: 365,
      durationMin: 60,
      tone: 'blush',
    },
  },
  {
    id: 'consultation',
    tone: 'sky',
    values: {
      category: 'consultation',
      sessions: 1,
      validityDays: 0,
      durationMin: 20,
      tone: 'sky',
    },
  },
];
