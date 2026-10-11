import {
  MONEY_SCALE,
  numberFromText,
  paiseOfRupees,
  rupeesOfPaise,
  textFromNumber,
} from '@/lib/number-text.ts';
import type { OfferingCategory, Tone } from '@/shared/api/app/app-schema.ts';
import {
  GST_PERCENT_VALUES,
  type GstPercent,
  OFFERING_DEFAULTS,
  type OfferingFields,
  type OfferingRecord,
} from '@/shared/api/app/offerings-contracts.ts';

/**
 * The Offering drawer's form (`offerings.md:59–80`; KICKOFF §6.11): text as
 * typed — money in rupees, as the fields show it — chips as the contract's
 * values, steppers as whole numbers. {@link offeringFieldsOf} turns it into
 * the fields the offering's writes take; field names follow the API's, so a
 * refusal's `errors[].field` lands on its field.
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
  /**
   * The picked GST chip ("18"). Empty until one is picked on a new offering:
   * the server then applies the category's rate (0% for a consultation, else 18%).
   */
  gstPercent: string;
  isGstInclusive: boolean;
  /**
   * The lowest price, rupees as typed; empty is none. Only a member with
   * `offering:lower_price:read` sees or sets it — for anyone else it stays empty
   * and is never sent.
   */
  minPrice: string;
  durationMinutes: number;
  validityDays: number;
  /** As typed — "laser, face, hair removal". */
  searchTerms: string;
  description: string;
  isActive: boolean;
}

/**
 * The form's own limits (`offerings.md:63–79`) inside the API's: the API takes
 * a longer name (120); sessions 1–99, duration 5–480 minutes and validity
 * 0–1095 days are the API's ranges.
 */
export const OFFERING_FORM_LIMITS = {
  name: 60,
  /** A money field's characters — digits and one point. */
  money: 7,
  sessionsMin: 1,
  sessions: 99,
  durationMinutesMin: 5,
  durationMinutes: 480,
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

/** A money field's typed rupees, to the paisa; empty is 0. */
export const rupeesOfText = (text: string): number =>
  rupeesOfPaise(numberFromText(text, MONEY_SCALE));

/** Rupees as a money field shows them: the plain figure, nothing for 0. */
const textOfRupees = (rupees: number): string =>
  textFromNumber(paiseOfRupees(rupees), MONEY_SCALE);

/** The GST rate a chip names; `null` while none is picked. */
export function gstPercentOf(text: string): GstPercent | null {
  return GST_PERCENT_VALUES.find((value) => String(value) === text) ?? null;
}

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
    gstPercent:
      OFFERING_DEFAULTS.gstPercent === null ? '' : String(OFFERING_DEFAULTS.gstPercent),
    isGstInclusive: OFFERING_DEFAULTS.isGstInclusive,
    minPrice: '',
    durationMinutes: OFFERING_DEFAULTS.durationMin,
    validityDays: OFFERING_DEFAULTS.validityDays,
    searchTerms: '',
    description: '',
    isActive: OFFERING_DEFAULTS.isActive,
  };
}

/** A saved offering's form, for Edit offering — a lowest price the member cannot see reads empty. */
export function offeringFormOf(offering: OfferingRecord): OfferingFormValues {
  return {
    name: offering.name,
    category: offering.category,
    tone: offering.tone,
    branchIds: [...offering.branchIds],
    price: textOfRupees(offering.price),
    offerPrice: offering.offerPrice === null ? '' : textOfRupees(offering.offerPrice),
    sessions: offering.sessions,
    gstPercent: String(offering.gstPercent),
    isGstInclusive: offering.isGstInclusive,
    minPrice: offering.minPrice === null ? '' : textOfRupees(offering.minPrice),
    durationMinutes: offering.durationMin,
    validityDays: offering.validityDays,
    searchTerms: offering.searchTerms.join(', '),
    description: offering.description ?? '',
    isActive: offering.isActive,
  };
}

/** Search terms as typed, split on commas, blanks dropped (`offerings.md:78`). */
export function splitSearchTerms(text: string): string[] {
  return text
    .split(',')
    .map((term) => term.trim())
    .filter((term) => term !== '');
}

/**
 * What the offering's pricing reads from the form, in rupees: the offer price
 * only while it is set below the price — empty or at least the price bills the
 * list price (`offerings.md:66`).
 */
export function offeringPricesOf(
  values: Pick<OfferingFormValues, 'price' | 'offerPrice' | 'minPrice'>,
): { price: number; offerPrice: number | null; minPrice: number } {
  const price = rupeesOfText(values.price);
  const offer = rupeesOfText(values.offerPrice);
  return {
    price,
    offerPrice: offer > 0 && offer < price ? offer : null,
    minPrice: rupeesOfText(values.minPrice),
  };
}

/**
 * The fields an offering write takes, for a form (`useCreateOffering` /
 * `useUpdateOffering`): the name trimmed, money in rupees, at least one session,
 * search terms split on commas, an empty description none, the GST rate only
 * once a chip is picked. The lowest price only from a member who may see it
 * (`canSeeFloor`) — for anyone else `null`, which sends nothing (gap 6).
 */
export function offeringFieldsOf(
  values: OfferingFormValues,
  { canSeeFloor }: { canSeeFloor: boolean },
): OfferingFields {
  const { minPrice, ...prices } = offeringPricesOf(values);
  const description = values.description.trim();
  return {
    name: values.name.trim(),
    category: values.category,
    tone: values.tone,
    branchIds: values.branchIds,
    ...prices,
    minPrice: canSeeFloor ? minPrice : null,
    sessions: Math.max(OFFERING_FORM_LIMITS.sessionsMin, values.sessions),
    gstPercent: gstPercentOf(values.gstPercent),
    isGstInclusive: values.isGstInclusive,
    durationMin: Math.max(
      OFFERING_FORM_LIMITS.durationMinutesMin,
      values.durationMinutes,
    ),
    validityDays: values.validityDays,
    searchTerms: splitSearchTerms(values.searchTerms),
    description: description === '' ? null : description,
    isActive: values.isActive,
  };
}

/** The required fields (Name, Price) still empty — Save opens their step instead (H:3852). */
export function missingOfferingFields(
  values: Pick<OfferingFormValues, 'name' | 'price'>,
): ('name' | 'price')[] {
  const missing: ('name' | 'price')[] = [];
  if (!values.name.trim()) missing.push('name');
  if (rupeesOfText(values.price) <= 0) missing.push('price');
  return missing;
}

/** A price rule the form breaks: the field to outline and the rule's toast. */
interface OfferingPriceProblem {
  field: 'offerPrice' | 'minPrice';
  rule: 'offerAbovePrice' | 'floorAboveOffer' | 'floorAbovePrice';
}

/**
 * The price rule a form breaks (H:5507; the API's order `min_price` ≤
 * `offer_price` ≤ `price`), checked before the save: an offer price above the
 * price, or a lowest price above what is billed — the offer price, else the
 * price. `null` when both hold. A lowest price the member cannot see reads
 * empty here; the server holds it, and its refusal is re-addressed (gap 7).
 */
export function offeringPriceProblem(
  values: Pick<OfferingFormValues, 'price' | 'offerPrice' | 'minPrice'>,
): OfferingPriceProblem | null {
  const { price, offerPrice, minPrice } = offeringPricesOf(values);
  if (rupeesOfText(values.offerPrice) > price) {
    return { field: 'offerPrice', rule: 'offerAbovePrice' };
  }
  if (minPrice <= 0) return null;
  if (offerPrice !== null) {
    return minPrice > offerPrice ? { field: 'minPrice', rule: 'floorAboveOffer' } : null;
  }
  return minPrice > price ? { field: 'minPrice', rule: 'floorAbovePrice' } : null;
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
    values: { category: 'treatment', sessions: 1, validityDays: 0, durationMinutes: 30 },
  },
  {
    id: 'pack',
    tone: 'lav',
    values: { category: 'package', sessions: 6, validityDays: 180, durationMinutes: 45 },
  },
  {
    id: 'lhr',
    tone: 'blush',
    values: {
      category: 'lhr',
      sessions: 10,
      validityDays: 365,
      durationMinutes: 60,
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
      durationMinutes: 20,
      tone: 'sky',
    },
  },
];
