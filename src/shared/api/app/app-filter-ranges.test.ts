import { describe, expect, it } from 'vitest';

import { createdRangeOf, followUpRangeOf } from './app-filter-ranges.ts';

/*
 * The clinic's clock is Asia/Kolkata (UTC+05:30): a clinic day starts at 18:30Z the day before.
 * Every range is whole clinic days, `from` inclusive and `to` exclusive.
 */

describe('createdRangeOf — the Created filter as clinozy-be’s instant range', () => {
  const today = '2026-10-03';

  it('reads Today and Yesterday as whole clinic days, starting 18:30Z the day before', () => {
    expect(createdRangeOf('today', today)).toEqual({
      from: '2026-10-02T18:30:00.000Z',
      to: '2026-10-03T18:30:00.000Z',
    });
    expect(createdRangeOf('yesterday', today)).toEqual({
      from: '2026-10-01T18:30:00.000Z',
      to: '2026-10-02T18:30:00.000Z',
    });
  });

  it('reads "Last 7 days" as today and the six before it, "Last 30" as today and 29 before', () => {
    expect(createdRangeOf('last_7', today)).toEqual({
      from: '2026-09-26T18:30:00.000Z',
      to: '2026-10-03T18:30:00.000Z',
    });
    expect(createdRangeOf('last_30', today)).toEqual({
      from: '2026-09-03T18:30:00.000Z',
      to: '2026-10-03T18:30:00.000Z',
    });
  });

  it('reads "This month" from its first day up to the next month’s — across a year end', () => {
    expect(createdRangeOf('this_month', '2026-10-17')).toEqual({
      from: '2026-09-30T18:30:00.000Z',
      to: '2026-10-31T18:30:00.000Z',
    });
    expect(createdRangeOf('this_month', '2026-12-31')).toEqual({
      from: '2026-11-30T18:30:00.000Z',
      to: '2026-12-31T18:30:00.000Z',
    });
    // February of a leap year ends on the 29th: March starts the next range.
    expect(createdRangeOf('this_month', '2028-02-29')).toEqual({
      from: '2028-01-31T18:30:00.000Z',
      to: '2028-02-29T18:30:00.000Z',
    });
  });

  it('steps back over a year end and a leap day for Yesterday and Last 7 days', () => {
    expect(createdRangeOf('yesterday', '2027-01-01')).toEqual({
      from: '2026-12-30T18:30:00.000Z',
      to: '2026-12-31T18:30:00.000Z',
    });
    expect(createdRangeOf('last_7', '2028-03-02')).toEqual({
      from: '2028-02-24T18:30:00.000Z',
      to: '2028-03-02T18:30:00.000Z',
    });
  });

  it('includes both days of a custom range, and leaves an open end open', () => {
    expect(createdRangeOf('2026-10-01..2026-10-05', today)).toEqual({
      from: '2026-09-30T18:30:00.000Z',
      to: '2026-10-05T18:30:00.000Z',
    });
    expect(createdRangeOf('2026-10-01..2026-10-01', today)).toEqual({
      from: '2026-09-30T18:30:00.000Z',
      to: '2026-10-01T18:30:00.000Z',
    });
    const fromOnly = createdRangeOf('2026-10-01..', today);
    expect(fromOnly.from).toBe('2026-09-30T18:30:00.000Z');
    expect(fromOnly.to).toBeUndefined();
    const toOnly = createdRangeOf('..2026-10-05', today);
    expect(toOnly.from).toBeUndefined();
    expect(toOnly.to).toBe('2026-10-05T18:30:00.000Z');
  });

  it('filters nothing for a value that is no range: malformed, backwards or open at both ends', () => {
    for (const value of ['garbage', '2026-10-05..2026-10-01', '..', '2026-13-01..', '']) {
      expect(createdRangeOf(value as never, today)).toEqual({});
    }
  });
});

describe('followUpRangeOf — the Follow-up filter as clinozy-be’s instant range', () => {
  const today = '2026-10-03';

  it('has no range for "Not set" — the API has no filter for it', () => {
    expect(followUpRangeOf('not_set', today)).toBeNull();
  });

  it('reads Overdue as anything before today began, with no start', () => {
    const overdue = followUpRangeOf('overdue', today);
    expect(overdue).toEqual({ to: '2026-10-02T18:30:00.000Z' });
    expect(overdue?.from).toBeUndefined();
  });

  it('reads Today, Tomorrow and Next 7 days as whole clinic days', () => {
    expect(followUpRangeOf('today', today)).toEqual({
      from: '2026-10-02T18:30:00.000Z',
      to: '2026-10-03T18:30:00.000Z',
    });
    expect(followUpRangeOf('tomorrow', today)).toEqual({
      from: '2026-10-03T18:30:00.000Z',
      to: '2026-10-04T18:30:00.000Z',
    });
    expect(followUpRangeOf('next_7', today)).toEqual({
      from: '2026-10-02T18:30:00.000Z',
      to: '2026-10-10T18:30:00.000Z',
    });
  });

  it('reads Tomorrow across a month and a year end', () => {
    expect(followUpRangeOf('tomorrow', '2026-12-31')).toEqual({
      from: '2026-12-31T18:30:00.000Z',
      to: '2027-01-01T18:30:00.000Z',
    });
  });

  it('reads a custom range as both its days, and none for a value that is no range', () => {
    expect(followUpRangeOf('2026-10-10..2026-10-12', today)).toEqual({
      from: '2026-10-09T18:30:00.000Z',
      to: '2026-10-12T18:30:00.000Z',
    });
    expect(followUpRangeOf('not-a-range' as never, today)).toEqual({});
  });
});
