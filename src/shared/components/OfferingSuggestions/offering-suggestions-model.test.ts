import { describe, expect, it } from 'vitest';

import type { SuggestionLine } from './offering-suggestions.types.ts';
import {
  lineFinalPrice,
  lineListPrice,
  suggestionCounts,
  withQty,
} from './offering-suggestions-model.ts';

/** A ₹4,800 package at its billed price, planned. */
const line = (overrides: Partial<SuggestionLine> = {}): SuggestionLine => ({
  id: 'line',
  name: 'LHR Full Face · B4G7',
  tone: 'blush',
  info: 'Package · 7 sessions',
  qty: 1,
  price: null,
  listPrice: 480_000,
  status: 'planned',
  invoicedQty: 0,
  fullyInvoiced: false,
  belowLowest: false,
  by: { initials: 'RM', tone: 'sky', label: 'Dr. Reenal' },
  ...overrides,
});

describe('line prices (PK9 — the price is the whole line’s)', () => {
  it('bills at unit × qty and falls back to it while the line has no price', () => {
    expect(lineListPrice(line({ qty: 3 }))).toBe(1_440_000);
    expect(lineFinalPrice(line({ qty: 3 }))).toBe(1_440_000);
    expect(lineFinalPrice(line({ qty: 3, price: 1_300_000 }))).toBe(1_300_000);
  });
});

describe('suggestionCounts', () => {
  it('counts the lines not declined and the accepted ones', () => {
    expect(
      suggestionCounts([
        line({ status: 'accepted' }),
        line({ id: 'b' }),
        line({ id: 'c', status: 'next_time' }),
        line({ id: 'd', status: 'declined' }),
      ]),
    ).toEqual({ live: 3, accepted: 1 });
  });
});

describe('withQty (H:4343)', () => {
  it('scales a typed price with the quantity so the unit discount holds', () => {
    expect(withQty(line({ price: 420_000 }), 2)).toEqual({ qty: 2, price: 840_000 });
    expect(withQty(line({ qty: 2, price: 840_000 }), 1)).toEqual({
      qty: 1,
      price: 420_000,
    });
  });

  it('keeps a line at its billed price there, and the quantity within 1–99', () => {
    expect(withQty(line(), 3)).toEqual({ qty: 3, price: null });
    expect(withQty(line(), 0)).toEqual({ qty: 1, price: null });
    expect(withQty(line(), 120)).toEqual({ qty: 99, price: null });
  });
});
