import { describe, expect, it } from 'vitest';

import { isSafeCssColor } from './css-safe.ts';

describe('isSafeCssColor', () => {
  it('accepts legitimate color tokens', () => {
    expect(isSafeCssColor('#0a0a0a')).toBe(true);
    expect(isSafeCssColor('hsl(220, 70%, 50%)')).toBe(true);
    expect(isSafeCssColor('oklch(0.7 0.15 250)')).toBe(true);
    expect(isSafeCssColor('var(--chart-1)')).toBe(true);
    expect(isSafeCssColor('rebeccapurple')).toBe(true);
  });

  it('rejects values that could break out of the declaration or <style> block', () => {
    expect(isSafeCssColor('red; } </style><script>alert(1)</script>')).toBe(false);
    expect(isSafeCssColor('red;background:url(javascript:alert(1))')).toBe(false);
    expect(isSafeCssColor('}')).toBe(false);
    expect(isSafeCssColor('<')).toBe(false);
    expect(isSafeCssColor('')).toBe(false);
    expect(isSafeCssColor('a'.repeat(200))).toBe(false);
  });
});
