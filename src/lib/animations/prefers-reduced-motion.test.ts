import { afterEach, describe, expect, it, vi } from 'vitest';

import { prefersReducedMotion } from './prefers-reduced-motion.ts';

describe('prefersReducedMotion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when matchMedia reports reduce', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    expect(prefersReducedMotion()).toBe(true);
  });

  it('returns false when motion is allowed', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    expect(prefersReducedMotion()).toBe(false);
  });
});
