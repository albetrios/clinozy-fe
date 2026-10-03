import { describe, expect, it } from 'vitest';

import {
  clinicDateOf,
  createdFilterMatches,
  followUpFilterMatches,
} from './clinic-filter-match.ts';
import { clinicInstant } from './clinic-time.ts';

const TODAY = '2026-10-03';
/** An instant at 10:00 on a clinic-local day. */
const on = (date: string, time = '10:00') => clinicInstant(date, time);

describe('clinicDateOf', () => {
  it('reads the clinic-local day, not the UTC one', () => {
    // 00:30 IST on 3 Oct is still 2 Oct in UTC.
    expect(clinicDateOf('2026-10-02T19:00:00.000Z')).toBe('2026-10-03');
  });
});

describe('the Created filter (S:1541, H:3857)', () => {
  const passes = (date: string, filter: Parameters<typeof createdFilterMatches>[1]) =>
    createdFilterMatches(on(date), filter, TODAY);

  it('matches the presets day by day', () => {
    expect(passes('2026-10-03', 'today')).toBe(true);
    expect(passes('2026-10-02', 'today')).toBe(false);
    expect(passes('2026-10-02', 'yesterday')).toBe(true);
    expect(passes('2026-09-27', 'last_7')).toBe(true);
    expect(passes('2026-09-26', 'last_7')).toBe(false);
    expect(passes('2026-09-04', 'last_30')).toBe(true);
    expect(passes('2026-09-03', 'last_30')).toBe(false);
    expect(passes('2026-10-01', 'this_month')).toBe(true);
    expect(passes('2026-09-30', 'this_month')).toBe(false);
  });

  it('includes both ends of a custom range, and an open end reaches as far as it goes', () => {
    expect(passes('2026-09-01', '2026-09-01..2026-09-30')).toBe(true);
    expect(passes('2026-09-30', '2026-09-01..2026-09-30')).toBe(true);
    expect(passes('2026-10-01', '2026-09-01..2026-09-30')).toBe(false);
    expect(passes('2020-01-01', '..2026-09-30')).toBe(true);
    expect(passes('2030-01-01', '2026-09-01..')).toBe(true);
  });
});

describe('the Follow-up filter (S:1542, H:3857)', () => {
  const passes = (
    date: string | null,
    filter: Parameters<typeof followUpFilterMatches>[1],
  ) => followUpFilterMatches(date === null ? null : on(date), filter, TODAY);

  it('matches the presets day by day', () => {
    expect(passes('2026-10-02', 'overdue')).toBe(true);
    expect(passes('2026-10-03', 'overdue')).toBe(false);
    expect(passes('2026-10-03', 'today')).toBe(true);
    expect(passes('2026-10-04', 'tomorrow')).toBe(true);
    expect(passes('2026-10-03', 'next_7')).toBe(true);
    expect(passes('2026-10-10', 'next_7')).toBe(true);
    expect(passes('2026-10-11', 'next_7')).toBe(false);
    expect(passes('2026-10-02', 'next_7')).toBe(false);
  });

  it('matches "Not set" only without a date, and nothing else without one', () => {
    expect(passes(null, 'not_set')).toBe(true);
    expect(passes('2026-10-03', 'not_set')).toBe(false);
    expect(passes(null, 'today')).toBe(false);
    expect(passes(null, '2026-09-01..')).toBe(false);
  });

  it('includes both ends of a custom range', () => {
    expect(passes('2026-10-05', '2026-10-05..2026-10-06')).toBe(true);
    expect(passes('2026-10-07', '2026-10-05..2026-10-06')).toBe(false);
  });
});
