import { describe, expect, it } from 'vitest';

import { wordmarkParts } from './brand-wordmark.ts';

describe('wordmarkParts', () => {
  it('lower-cases the name and rings its first "o"', () => {
    expect(wordmarkParts('Nova Health')).toEqual({
      head: 'n',
      ring: true,
      tail: 'va health',
    });
  });

  it('rings only the first "o"', () => {
    expect(wordmarkParts('Odoo')).toEqual({ head: '', ring: true, tail: 'doo' });
  });

  it('sets a name without an "o" as plain text', () => {
    expect(wordmarkParts('Acme')).toEqual({ head: 'acme', ring: false, tail: '' });
  });
});
