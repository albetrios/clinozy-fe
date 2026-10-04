import { describe, expect, it } from 'vitest';

import { kebabCase } from './kebab-case.ts';

describe('kebabCase', () => {
  it('lowers each capital behind a hyphen', () => {
    expect(kebabCase('treatmentSuggestions')).toBe('treatment-suggestions');
    expect(kebabCase('painBefore')).toBe('pain-before');
  });

  it('leaves a lower-case name as it is', () => {
    expect(kebabCase('complaints')).toBe('complaints');
  });
});
