import { afterEach, describe, expect, it } from 'vitest';

import { applyOrgBrand } from './org-brand.ts';

afterEach(() => {
  document.documentElement.style.removeProperty('--color-brand');
});

describe('applyOrgBrand', () => {
  it('sets --color-brand when a color is provided', () => {
    applyOrgBrand('oklch(0.6 0.2 25)');
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe(
      'oklch(0.6 0.2 25)',
    );
  });

  it('clears --color-brand for null / undefined (reverts to theme default)', () => {
    applyOrgBrand('#ff0000');
    applyOrgBrand(null);
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('');
    applyOrgBrand(undefined);
    expect(document.documentElement.style.getPropertyValue('--color-brand')).toBe('');
  });
});
