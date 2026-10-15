import { describe, expect, it } from 'vitest';

import type { PatientPhoto } from '@/shared/api/app/patient-images-contracts.ts';

import { photoDouble } from '../__tests__/integration/photo-api-double.ts';
import {
  compareColumns,
  comparisonOrder,
  daysBetween,
  defaultCompareLayout,
  photoCompareKey,
} from './photo-compare.ts';

const photo = (id: string, takenOn: string): PatientPhoto => photoDouble({ id, takenOn });

describe('the photo comparison', () => {
  it('counts the days between two civil dates', () => {
    expect(daysBetween('2026-07-23', '2026-08-13')).toBe(21);
    expect(daysBetween('2026-10-15', '2026-10-15')).toBe(0);
    // Across the clocks going back in Europe — calendar days, not 24-hour ones.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('orders the photos oldest first, a day keeping the pick order', () => {
    const late = photo('pimg_late', '2026-10-15');
    const early = photo('pimg_early', '2026-07-23');
    const sameDayFirst = photo('pimg_same_one', '2026-09-03');
    const sameDaySecond = photo('pimg_same_two', '2026-09-03');
    expect(
      comparisonOrder([late, sameDayFirst, early, sameDaySecond]).map(
        (entry) => entry.id,
      ),
    ).toEqual(['pimg_early', 'pimg_same_one', 'pimg_same_two', 'pimg_late']);
  });

  it('opens up to four photos in one row and more as a grid', () => {
    expect(defaultCompareLayout(2)).toBe('row');
    expect(defaultCompareLayout(4)).toBe('row');
    expect(defaultCompareLayout(5)).toBe('grid');
    expect(defaultCompareLayout(8)).toBe('grid');
  });

  it('draws one column a photo in a row, two to four in a grid, two on a phone', () => {
    expect(compareColumns({ count: 3, layout: 'row', narrow: false })).toBe(3);
    expect(compareColumns({ count: 8, layout: 'row', narrow: false })).toBe(8);
    expect(compareColumns({ count: 3, layout: 'grid', narrow: false })).toBe(2);
    expect(compareColumns({ count: 4, layout: 'grid', narrow: false })).toBe(2);
    expect(compareColumns({ count: 6, layout: 'grid', narrow: false })).toBe(3);
    expect(compareColumns({ count: 7, layout: 'grid', narrow: false })).toBe(4);
    expect(compareColumns({ count: 8, layout: 'row', narrow: true })).toBe(2);
    expect(compareColumns({ count: 2, layout: 'grid', narrow: true })).toBe(2);
  });

  it('remembers a comparison under its photo ids sorted, whatever their order', () => {
    expect(photoCompareKey(['pim_c', 'pim_a', 'pim_b'])).toBe('pim_a,pim_b,pim_c');
    expect(photoCompareKey(['pim_b', 'pim_a'])).toBe(photoCompareKey(['pim_a', 'pim_b']));
  });
});
