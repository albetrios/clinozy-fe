import { INVOICE_QTY_MAX } from '@/shared/api/clinic/invoices-contracts.ts';

/*
 * The invoice's quick line grammar (KICKOFF §6.9 Items; `payments.md:142`,
 * H:3861 `__czQlMods`): "lhr face 1 10%" — LHR Full Face, one, 10% off;
 * "sun 2" — two of the sunscreen; "peel @500" — at ₹500. A bare number after
 * a name word is the quantity (unless the catalogue's names carry it, "spf
 * 50"), `x2` always is; `N%` is the discount; `@N` the rate in rupees.
 * Everything else is the search. Pure: the drawer shows the values as pills in
 * its own words.
 */

/** What the shorthand of a line set — money in paise. */
export interface InvoiceLineValues {
  qty?: number;
  discountPct?: number;
  rate?: number;
}

/** A typed line: the words to search with and what the rest set. */
export interface ParsedInvoiceLine {
  words: string[];
  values: InvoiceLineValues;
}

const DIGITS = /^\d+$/;
const COUNT = /^x?\d+$/;

/** A figure as typed — digits with at most one point ("12.5", "500") — or null. */
function figureOf(text: string): number | null {
  const [whole = '', fraction = '', ...rest] = text.split('.');
  const wellFormed =
    rest.length === 0 && DIGITS.test(whole) && (fraction === '' || DIGITS.test(fraction));
  return wellFormed ? Number.parseFloat(text) : null;
}

/** A part's discount ("10%", "12.5%"), held to 100. */
function readDiscount(part: string, values: InvoiceLineValues): boolean {
  const figure = part.endsWith('%') ? figureOf(part.slice(0, -1)) : null;
  if (figure === null) return false;
  values.discountPct = Math.min(100, figure);
  return true;
}

/** A part's rate ("@500", "@499.50"), rupees to paise. */
function readRate(part: string, values: InvoiceLineValues): boolean {
  const figure = part.startsWith('@') ? figureOf(part.slice(1)) : null;
  if (figure === null) return false;
  values.rate = Math.round(figure * 100);
  return true;
}

/**
 * A part's quantity: `x2` after a name word, or a bare number there that the
 * catalogue's names do not carry — held to 1–999.
 */
function readQty(
  part: string,
  values: InvoiceLineValues,
  numbers: ReadonlySet<string>,
  named: boolean,
): boolean {
  const explicit = part.startsWith('x');
  if (!(named && COUNT.test(part)) || (numbers.has(part) && !explicit)) return false;
  const qty = Number(part.replace('x', ''));
  if (qty < 1) return false;
  values.qty = Math.min(INVOICE_QTY_MAX, qty);
  return true;
}

/** Read a typed line into its search words and values (H:3861). */
export function parseInvoiceLine(
  text: string,
  numbers: ReadonlySet<string> = new Set(),
): ParsedInvoiceLine {
  const words: string[] = [];
  const values: InvoiceLineValues = {};
  for (const part of text.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
    const read =
      readDiscount(part, values) ||
      readRate(part, values) ||
      readQty(part, values, numbers, words.length > 0);
    if (!read) words.push(part);
  }
  return { words, values };
}
