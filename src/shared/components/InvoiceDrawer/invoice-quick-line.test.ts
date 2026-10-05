import { describe, expect, it } from 'vitest';

import { nameNumbers } from '@/shared/components/QuickLine/index.ts';

import { parseInvoiceLine } from './invoice-quick-line.ts';

const CATALOG = [
  { label: 'LHR Full Face · B4G7', keywords: 'package laser' },
  { label: 'LHR Half Leg', keywords: 'lhr' },
  { label: 'Back Peeling', keywords: 'treatment' },
  { label: 'Admosh UV Sunscreen 60g', keywords: 'spf' },
  { label: 'Sunscreen SPF 50', keywords: '' },
  { label: 'Flubolt 400', keywords: 'flurbiprofen' },
];

describe('parseInvoiceLine (H:3861)', () => {
  it('reads the example: "lhr face 1 10%" — one, 10% off', () => {
    expect(parseInvoiceLine('lhr face 1 10%')).toEqual({
      words: ['lhr', 'face'],
      values: { qty: 1, discountPct: 10 },
    });
  });

  it('reads a quantity after the name, a rate in rupees and a fractional discount', () => {
    expect(parseInvoiceLine('sun 2')).toEqual({ words: ['sun'], values: { qty: 2 } });
    expect(parseInvoiceLine('peel @499.50 12.5%')).toEqual({
      words: ['peel'],
      values: { rate: 49_950, discountPct: 12.5 },
    });
  });

  it('keeps a number the catalogue’s names carry in the search, unless it is x-prefixed', () => {
    const numbers = nameNumbers(CATALOG.map((entry) => entry.label));
    expect(numbers.has('50')).toBe(true);
    expect(parseInvoiceLine('spf 50', numbers)).toEqual({
      words: ['spf', '50'],
      values: {},
    });
    expect(parseInvoiceLine('spf 50 x3', numbers).values).toEqual({ qty: 3 });
  });

  it('takes no quantity before a name word, nor below one, and holds it to 999', () => {
    expect(parseInvoiceLine('2 sun')).toEqual({ words: ['2', 'sun'], values: {} });
    expect(parseInvoiceLine('sun 0').words).toEqual(['sun', '0']);
    expect(parseInvoiceLine('sun 5000').values.qty).toBe(999);
    expect(parseInvoiceLine('sun 150%').values.discountPct).toBe(100);
  });

  it('reads an empty line as nothing', () => {
    expect(parseInvoiceLine('   ')).toEqual({ words: [], values: {} });
  });
});
