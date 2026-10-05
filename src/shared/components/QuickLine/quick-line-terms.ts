/*
 * The item lines' shorthand (H:3861 `__czQlMods`) — the one grammar the
 * Invoice drawer's, the purchase order's and the clinic purchase's quick lines
 * share: "azel 20 +2 @180" — Azelan, twenty, two free, at ₹180; "lhr face 1
 * 10%" — one, 10% off. `N%` is the discount, `@N` the rate in rupees, `+N`
 * the free units, `xN` — or a bare number once the name has a word, unless
 * the catalogue's names carry it ("spf 50") — the quantity. A line reads the
 * terms its rows hold ("20 = qty · +2 = free · @180 = rate"); a term it does
 * not read stays a search word. Pure: the pills are the host's words
 * (`useQuickLineTerms`). The Rx line has a grammar of its own (H:3864).
 */

/** The shorthand terms, in the order the pills show them (H:3863). */
const QUICK_LINE_TERMS = ['qty', 'free', 'rate', 'discount'] as const;

/** One shorthand term. */
export type QuickLineTerm = (typeof QUICK_LINE_TERMS)[number];

/** What a line's shorthand set — the rate in paise. */
export interface QuickLineTermValues {
  qty?: number;
  /** Free units on top of the quantity ("+2"). */
  free?: number;
  /** Paise. */
  rate?: number;
  discountPct?: number;
}

/** A typed line: the words to search with, and what the shorthand set. */
interface ParsedQuickLineTerms {
  words: string[];
  values: QuickLineTermValues;
}

/** How a line reads its shorthand. */
export interface QuickLineTermOptions {
  /** The numbers the catalogue's names carry (`nameNumbers`): a bare one stays in the name. */
  numbers?: ReadonlySet<string>;
  /** The terms this line reads — every one unless named. */
  terms?: readonly QuickLineTerm[];
  /** The rows' count cap: the quantity and the free units are held to it. */
  max?: number;
}

const DIGITS = /^\d+$/;
const COUNT = /^x?\d+$/;
const FREE = /^\+\d+$/;

/** A figure as typed — digits with at most one point ("12.5", "500") — or null. */
function figureOf(text: string): number | null {
  const [whole = '', fraction = '', ...rest] = text.split('.');
  const wellFormed =
    rest.length === 0 && DIGITS.test(whole) && (fraction === '' || DIGITS.test(fraction));
  return wellFormed ? Number.parseFloat(text) : null;
}

/** A part's discount ("10%", "12.5%"), held to 100. */
function readDiscount(part: string, values: QuickLineTermValues): boolean {
  const figure = part.endsWith('%') ? figureOf(part.slice(0, -1)) : null;
  if (figure === null) return false;
  values.discountPct = Math.min(100, figure);
  return true;
}

/** A part's rate ("@500", "@499.50"), rupees to paise. */
function readRate(part: string, values: QuickLineTermValues): boolean {
  const figure = part.startsWith('@') ? figureOf(part.slice(1)) : null;
  if (figure === null) return false;
  values.rate = Math.round(figure * 100);
  return true;
}

/** A part's free units ("+2"), held to the cap. */
function readFree(part: string, values: QuickLineTermValues, max: number): boolean {
  if (!FREE.test(part)) return false;
  values.free = Math.min(max, Number(part.slice(1)));
  return true;
}

/**
 * A part's quantity: `x2` after a name word, or a bare number there that the
 * catalogue's names do not carry — at least one, held to the cap.
 */
function readQty(
  part: string,
  values: QuickLineTermValues,
  numbers: ReadonlySet<string>,
  named: boolean,
  max: number,
): boolean {
  const explicit = part.startsWith('x');
  if (!(named && COUNT.test(part)) || (numbers.has(part) && !explicit)) return false;
  const qty = Number(part.replace('x', ''));
  if (qty < 1) return false;
  values.qty = Math.min(max, qty);
  return true;
}

/**
 * Read a typed line into its search words and the values of the terms the
 * line reads (H:3861): each part is tried as a discount, a rate, free units,
 * then a quantity — in the prototype's order — and is otherwise a word.
 */
export function parseQuickLineTerms(
  text: string,
  {
    numbers = new Set(),
    terms = QUICK_LINE_TERMS,
    max = Number.POSITIVE_INFINITY,
  }: QuickLineTermOptions = {},
): ParsedQuickLineTerms {
  const reads = new Set<QuickLineTerm>(terms);
  const words: string[] = [];
  const values: QuickLineTermValues = {};
  for (const part of text.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    const read =
      (reads.has('discount') && readDiscount(part, values)) ||
      (reads.has('rate') && readRate(part, values)) ||
      (reads.has('free') && readFree(part, values, max)) ||
      (reads.has('qty') && readQty(part, values, numbers, words.length > 0, max));
    if (!read) words.push(part);
  }
  return { words, values };
}
