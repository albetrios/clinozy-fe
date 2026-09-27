import { describe, expect, it } from 'vitest';

import { computeProfileCompleteness, profileSchema } from './contracts.ts';

describe('profile contracts', () => {
  it('computes completeness from the two persisted fields', () => {
    expect(computeProfileCompleteness({})).toBe(0);
    expect(computeProfileCompleteness({ name: 'Ada' })).toBe(50);
    expect(computeProfileCompleteness({ name: 'Ada', jobTitle: 'Engineer' })).toBe(100);
  });

  it('ignores whitespace-only values', () => {
    expect(computeProfileCompleteness({ name: '   ' })).toBe(0);
  });

  it('rejects an empty name', () => {
    expect(profileSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('accepts a valid profile', () => {
    expect(profileSchema.safeParse({ name: 'Ada' }).success).toBe(true);
  });
});
