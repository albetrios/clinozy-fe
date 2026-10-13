import { describe, expect, it } from 'vitest';

import { occurrenceKeys } from './occurrence-keys.ts';

describe('occurrenceKeys', () => {
  it('keeps a value that appears once as its own key', () => {
    expect(occurrenceKeys(['Consultation', 'Peel'])).toEqual(['Consultation', 'Peel']);
  });

  it('counts the repeats of a value, so every key is unique', () => {
    const keys = occurrenceKeys(['Peel', 'Consultation', 'Peel', 'Peel']);
    expect(keys).toEqual(['Peel', 'Consultation', 'Peel·2', 'Peel·3']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('answers nothing for nothing', () => {
    expect(occurrenceKeys([])).toEqual([]);
  });
});
