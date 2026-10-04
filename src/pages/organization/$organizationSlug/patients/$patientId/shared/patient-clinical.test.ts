import { describe, expect, it } from 'vitest';

import { clinicalItems, clinicalText } from './patient-clinical.ts';

describe('the clinical notes as chips (S:313–316)', () => {
  it('reads one chip per line, blank lines dropped', () => {
    expect(clinicalItems('Tanning on face\n\n  Uneven skin tone \n')).toEqual([
      'Tanning on face',
      'Uneven skin tone',
    ]);
    expect(clinicalItems(null)).toEqual([]);
  });

  it('stores the chips one per line, and none as no note', () => {
    expect(clinicalText(['Tanning on face', 'Uneven skin tone'])).toBe(
      'Tanning on face\nUneven skin tone',
    );
    expect(clinicalText([])).toBeNull();
  });
});
