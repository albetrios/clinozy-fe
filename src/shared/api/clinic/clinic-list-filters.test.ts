import { describe, expect, it } from 'vitest';

import {
  CREATED_PRESETS,
  dateRangeOf,
  FOLLOW_UP_PRESETS,
  readCreatedFilter,
  readFollowUpFilter,
  toDateRange,
} from './clinic-list-filters.ts';

describe('custom date ranges', () => {
  it('reads both ends, or one end left open', () => {
    expect(dateRangeOf('2026-09-01..2026-09-30')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(dateRangeOf('2026-09-01..')).toEqual({ from: '2026-09-01', to: null });
    expect(dateRangeOf('..2026-09-30')).toEqual({ from: null, to: '2026-09-30' });
  });

  it('refuses what is no range', () => {
    for (const value of [
      '..',
      '2026-09-01',
      '2026-09-30..2026-09-01',
      '2026-13-01..',
      '2026-09-01..2026-09-30..2026-10-01',
      'yesterday..today',
    ]) {
      expect(dateRangeOf(value), value).toBeNull();
    }
  });

  it('writes a range back as it reads', () => {
    expect(toDateRange('2026-09-01', null)).toBe('2026-09-01..');
    expect(dateRangeOf(toDateRange(null, '2026-09-30'))).toEqual({
      from: null,
      to: '2026-09-30',
    });
  });
});

describe('reading a filter from the URL or the list params', () => {
  it('takes the presets and a valid range', () => {
    for (const preset of CREATED_PRESETS) expect(readCreatedFilter(preset)).toBe(preset);
    for (const preset of FOLLOW_UP_PRESETS)
      expect(readFollowUpFilter(preset)).toBe(preset);
    expect(readCreatedFilter('2026-09-01..2026-09-30')).toBe('2026-09-01..2026-09-30');
    expect(readFollowUpFilter('..2026-10-10')).toBe('..2026-10-10');
  });

  it('drops "any", the other filter’s presets and anything malformed', () => {
    expect(readCreatedFilter('any')).toBeUndefined();
    expect(readCreatedFilter('overdue')).toBeUndefined();
    expect(readFollowUpFilter('last_7')).toBeUndefined();
    expect(readFollowUpFilter('2026-10-10..2026-10-01')).toBeUndefined();
    expect(readCreatedFilter(7)).toBeUndefined();
    expect(readCreatedFilter(undefined)).toBeUndefined();
  });
});
