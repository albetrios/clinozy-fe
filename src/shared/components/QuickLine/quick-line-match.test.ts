import { describe, expect, it } from 'vitest';

import {
  quickLineBrowseMatches,
  quickLineMatches,
  quickLineTypedName,
  quickLineWordScore,
} from './quick-line-match.ts';

const CATALOG = [
  { label: 'LHR Full Face · B4G7', keywords: 'package laser' },
  { label: 'LHR Half Leg', keywords: 'lhr' },
  { label: 'Back Peeling', keywords: 'treatment' },
  { label: 'Admosh UV Sunscreen 60g', keywords: 'spf' },
  { label: 'Sunscreen SPF 50', keywords: '' },
  { label: 'Flubolt 400', keywords: 'flurbiprofen' },
];

describe('the quick line’s search (H:3790–3797)', () => {
  it('scores a label start, a word start, anywhere, then letters in order', () => {
    const face = CATALOG[0] ?? { label: '' };
    expect(quickLineWordScore('lhr', face)).toBe(0);
    expect(quickLineWordScore('face', face)).toBe(1);
    expect(quickLineWordScore('ser', face)).toBe(2);
    expect(quickLineWordScore('lfce', face)).toBe(4);
    expect(quickLineWordScore('zz', face)).toBeNull();
  });

  it('lists the entries every word matches, best first, eight at most', () => {
    expect(
      quickLineMatches(CATALOG, ['lhr', 'face']).map((entry) => entry.label),
    ).toEqual(['LHR Full Face · B4G7']);
    expect(quickLineMatches(CATALOG, ['sun']).map((entry) => entry.label)).toEqual([
      'Sunscreen SPF 50',
      'Admosh UV Sunscreen 60g',
    ]);
    expect(quickLineMatches(CATALOG, ['nothing'])).toEqual([]);
  });

  it('suggests the often-used first while nothing is typed', () => {
    const often = [CATALOG[2], CATALOG[5]].filter((entry) => entry !== undefined);
    const suggested = quickLineMatches(CATALOG, [], often).map((entry) => entry.label);
    expect(suggested.slice(0, 2)).toEqual(['Back Peeling', 'Flubolt 400']);
    expect(suggested).toHaveLength(CATALOG.length);
    expect(quickLineMatches(CATALOG, [], [], 3)).toHaveLength(3);
  });

  it('offers a missing name as typed, each word capitalised', () => {
    expect(quickLineTypedName(CATALOG, ['glow', 'serum'])).toBe('Glow Serum');
    expect(quickLineTypedName(CATALOG, ['back', 'peeling'])).toBeNull();
    expect(quickLineTypedName(CATALOG, [])).toBeNull();
  });

  it('narrows Browse to the entries holding every word', () => {
    expect(
      CATALOG.filter((entry) => quickLineBrowseMatches(entry, ['sun'])).map(
        (entry) => entry.label,
      ),
    ).toEqual(['Admosh UV Sunscreen 60g', 'Sunscreen SPF 50']);
    expect(CATALOG.filter((entry) => quickLineBrowseMatches(entry, []))).toHaveLength(
      CATALOG.length,
    );
  });
});
