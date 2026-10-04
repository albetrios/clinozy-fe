import { describe, expect, it } from 'vitest';

import type { SuggestionLine } from './offering-suggestions.types.ts';
import {
  belowFloor,
  fullyInvoiced,
  lineFinalPrice,
  lineFloorPrice,
  lineListPrice,
  suggestionCounts,
  suggestionTotals,
  withQty,
} from './offering-suggestions-model.ts';

/** A ₹4,800 package with a ₹4,000 floor, list-priced, planned. */
const line = (overrides: Partial<SuggestionLine> = {}): SuggestionLine => ({
  id: 'line',
  name: 'LHR Full Face · B4G7',
  tone: 'blush',
  info: 'Package · 7 sessions',
  qty: 1,
  price: null,
  listPrice: 480_000,
  floorPrice: 400_000,
  status: 'planned',
  invoicedQty: 0,
  invoicedAmount: 0,
  by: { initials: 'RM', tone: 'sky', label: 'Dr. Reenal' },
  ...overrides,
});

describe('line prices (S:490 — the price is the whole line’s)', () => {
  it('lists at unit × qty and falls back to it while the line has no price', () => {
    expect(lineListPrice(line({ qty: 3 }))).toBe(1_440_000);
    expect(lineFinalPrice(line({ qty: 3 }))).toBe(1_440_000);
    expect(lineFinalPrice(line({ qty: 3, price: 1_300_000 }))).toBe(1_300_000);
  });

  it('floors at the unit floor × qty, or none', () => {
    expect(lineFloorPrice(line({ qty: 2 }))).toBe(800_000);
    expect(lineFloorPrice(line({ floorPrice: null }))).toBeNull();
  });
});

describe('suggestionTotals (S:499)', () => {
  it('totals Planned and Accepted at their final prices, with the saving on list', () => {
    const totals = suggestionTotals([
      line({ price: 420_000, status: 'accepted' }),
      line({ id: 'b', qty: 2, listPrice: 350_000 }),
      line({ id: 'c', status: 'next_time', price: 100_000 }),
      line({ id: 'd', status: 'declined' }),
    ]);
    expect(totals.total).toBe(420_000 + 700_000);
    expect(totals.saved).toBe(60_000);
  });

  it('sums what the linked invoice lines come to, whatever the status', () => {
    const totals = suggestionTotals([
      line({ invoicedQty: 1, invoicedAmount: 420_000, status: 'accepted' }),
      line({ id: 'b', status: 'next_time', invoicedAmount: 50_000 }),
    ]);
    expect(totals.invoiced).toBe(470_000);
  });

  it('never reports a negative saving for a line priced over list', () => {
    expect(suggestionTotals([line({ price: 500_000 })]).saved).toBe(0);
  });
});

describe('suggestionCounts', () => {
  it('counts every line but a declined one, and the accepted ones', () => {
    expect(
      suggestionCounts([
        line({ status: 'accepted' }),
        line({ id: 'b', status: 'next_time' }),
        line({ id: 'c', status: 'declined' }),
      ]),
    ).toEqual({ live: 2, accepted: 1 });
  });
});

describe('belowFloor (S:490, warns not blocks)', () => {
  it('flags a line price under floor × qty', () => {
    expect(belowFloor(line({ price: 390_000 }))).toBe(true);
    expect(belowFloor(line({ qty: 2, price: 790_000 }))).toBe(true);
    expect(belowFloor(line({ qty: 2, price: 800_000 }))).toBe(false);
  });

  it('leaves a list-priced line, an emptied price and a line without a floor alone', () => {
    expect(belowFloor(line())).toBe(false);
    expect(belowFloor(line({ price: 0 }))).toBe(false);
    expect(belowFloor(line({ price: 1, floorPrice: null }))).toBe(false);
  });
});

describe('withQty (H:4343)', () => {
  it('scales a typed price with the quantity so the unit discount holds', () => {
    expect(withQty(line({ qty: 2, price: 840_000 }), 3)).toEqual({
      qty: 3,
      price: 1_260_000,
    });
  });

  it('keeps a list-priced line list-priced', () => {
    expect(withQty(line(), 2)).toEqual({ qty: 2, price: null });
  });

  it('keeps the quantity within 1–99 (S:489)', () => {
    expect(withQty(line(), 0).qty).toBe(1);
    expect(withQty(line({ qty: 99 }), 100).qty).toBe(99);
  });
});

describe('fullyInvoiced', () => {
  it('is true once every unit is invoiced', () => {
    expect(fullyInvoiced(line({ qty: 2, invoicedQty: 1 }))).toBe(false);
    expect(fullyInvoiced(line({ qty: 2, invoicedQty: 2 }))).toBe(true);
    expect(fullyInvoiced(line({ qty: 0, invoicedQty: 0 }))).toBe(false);
  });
});
