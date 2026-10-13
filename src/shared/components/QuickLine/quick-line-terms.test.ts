import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { nameNumbers } from './quick-line-match.ts';
import { parseQuickLineTerms, type QuickLineTerm } from './quick-line-terms.ts';
import { useQuickLineTerms } from './use-quick-line-terms.ts';

const CATALOG = [
  'LHR Full Face · B4G7',
  'Back Peeling',
  'Admosh UV Sunscreen 60g',
  'Sunscreen SPF 50',
  'Flubolt 400',
];
const NUMBERS = nameNumbers(CATALOG);

/** The invoice line's terms (`payments.md:140`): no free units. */
const INVOICE: readonly QuickLineTerm[] = ['qty', 'discount', 'rate'];
/** The clinic purchase's (`clinic-stock.md:149`): "10 = qty · @250 = rate". */
const STOCK: readonly QuickLineTerm[] = ['qty', 'rate'];

describe('parseQuickLineTerms (H:3861 `__czQlMods`)', () => {
  it('reads the purchase order’s example: "azel 20 +2 @180" — twenty, two free, at ₹180', () => {
    expect(parseQuickLineTerms('azel 20 +2 @180')).toEqual({
      words: ['azel'],
      values: { qty: 20, free: 2, rate: 18_000 },
    });
  });

  it('reads free units anywhere — before the name too — and holds them to the cap', () => {
    expect(parseQuickLineTerms('+3 azel')).toEqual({
      words: ['azel'],
      values: { free: 3 },
    });
    expect(parseQuickLineTerms('azel +12000', { max: 9999 }).values).toEqual({
      free: 9999,
    });
    expect(parseQuickLineTerms('azel +0').values).toEqual({ free: 0 });
    // Not a free term: a sign with no digits, or digits after a word sign.
    expect(parseQuickLineTerms('azel + +x2').words).toEqual(['azel', '+', '+x2']);
  });

  it('reads only the terms the line names; the rest stay search words', () => {
    expect(parseQuickLineTerms('azel 2 +2 10%', { terms: INVOICE })).toEqual({
      words: ['azel', '+2'],
      values: { qty: 2, discountPct: 10 },
    });
    expect(parseQuickLineTerms('gloves 10 @250 +2 5%', { terms: STOCK })).toEqual({
      words: ['gloves', '+2', '5%'],
      values: { qty: 10, rate: 25_000 },
    });
  });

  describe('the invoice line (H:3861, `payments.md:140`)', () => {
    const invoice = (text: string, max = 999) =>
      parseQuickLineTerms(text, { numbers: NUMBERS, terms: INVOICE, max });

    it('reads the example: "lhr face 1 10%" — one, 10% off', () => {
      expect(invoice('lhr face 1 10%')).toEqual({
        words: ['lhr', 'face'],
        values: { qty: 1, discountPct: 10 },
      });
    });

    it('reads a quantity after the name, a rate in rupees and a fractional discount', () => {
      expect(invoice('sun 2')).toEqual({ words: ['sun'], values: { qty: 2 } });
      expect(invoice('peel @499.50 12.5%')).toEqual({
        words: ['peel'],
        values: { rate: 49_950, discountPct: 12.5 },
      });
    });

    it('keeps a number the catalogue’s names carry in the search, unless it is x-prefixed', () => {
      expect(NUMBERS.has('50')).toBe(true);
      expect(invoice('spf 50')).toEqual({ words: ['spf', '50'], values: {} });
      expect(invoice('spf 50 x3').values).toEqual({ qty: 3 });
    });

    it('takes no quantity before a name word, nor below one, and holds it to the cap', () => {
      expect(invoice('2 sun')).toEqual({ words: ['2', 'sun'], values: {} });
      expect(invoice('sun 0').words).toEqual(['sun', '0']);
      expect(invoice('sun 5000').values.qty).toBe(999);
      expect(invoice('sun 150%').values.discountPct).toBe(100);
    });

    it('reads an empty line as nothing, and a malformed figure as a word', () => {
      expect(invoice('   ')).toEqual({ words: [], values: {} });
      expect(invoice('peel @4.9.9 1.2.3%').words).toEqual(['peel', '@4.9.9', '1.2.3%']);
    });
  });
});

describe('useQuickLineTerms (H:3863)', () => {
  it('shows the pills in the prototype’s order: ×qty · +free · @ rate · % off', () => {
    const { result } = renderHook(() => useQuickLineTerms({ max: 9999 }));
    expect(result.current('azel 20 +2 @180 5%')).toEqual({
      words: ['azel'],
      tags: ['×20', '+2 free', '@ ₹180', '5% off'],
      values: { qty: 20, free: 2, rate: 18_000, discountPct: 5 },
    });
  });

  it('shows no pill for what the line did not set, nor for zero free', () => {
    const { result } = renderHook(() => useQuickLineTerms({ terms: STOCK }));
    expect(result.current('gloves').tags).toEqual([]);
    const free = renderHook(() => useQuickLineTerms({})).result.current('azel +0');
    expect(free.tags).toEqual([]);
    expect(free.values).toEqual({ free: 0 });
  });
});
