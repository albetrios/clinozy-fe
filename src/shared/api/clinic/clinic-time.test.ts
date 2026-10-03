import { describe, expect, it } from 'vitest';

import {
  addCivilDays,
  civilDateOf,
  civilDayOffset,
  civilYearsBetween,
  clinicClockTime,
  clinicInstant,
  clinicToday,
  localDateOf,
} from './clinic-time.ts';

describe('clinic clock (Asia/Kolkata)', () => {
  it("reads today's clinic date, not the UTC one", () => {
    // 20:00 UTC on 2 Oct is 01:30 on 3 Oct in the clinic.
    expect(clinicToday(new Date('2026-10-02T20:00:00Z'))).toBe('2026-10-03');
    expect(clinicToday(new Date('2026-10-03T10:00:00Z'))).toBe('2026-10-03');
  });

  it('turns a clinic-local date and time into the UTC instant', () => {
    expect(clinicInstant('2026-10-03', '10:20')).toBe('2026-10-03T04:50:00.000Z');
    expect(clinicInstant('2026-10-03', '00:15')).toBe('2026-10-02T18:45:00.000Z');
  });

  it('reads the clinic-local clock time of an instant', () => {
    expect(clinicClockTime(new Date('2026-10-03T04:50:00Z'))).toBe('10:20');
  });

  it('does calendar arithmetic across month and year ends', () => {
    expect(addCivilDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addCivilDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addCivilDays('2026-10-03', 0)).toBe('2026-10-03');
  });

  it('counts whole days between civil dates, across months and years', () => {
    expect(civilDayOffset('2026-10-03', '2026-10-04')).toBe(1);
    expect(civilDayOffset('2026-10-03', '2026-09-30')).toBe(-3);
    expect(civilDayOffset('2026-12-31', '2027-01-01')).toBe(1);
    expect(civilDayOffset('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('round-trips a civil date through a local-midnight Date', () => {
    const date = localDateOf('2026-02-28');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(28);
    expect(civilDateOf(date)).toBe('2026-02-28');
  });

  it('reads a calendar date as that local day', () => {
    const day = localDateOf('2026-09-24');
    expect([day.getFullYear(), day.getMonth(), day.getDate(), day.getHours()]).toEqual([
      2026, 8, 24, 0,
    ]);
  });

  it('counts whole years between calendar dates, as an age', () => {
    expect(civilYearsBetween('1997-03-14', '2026-09-17')).toBe(29);
    expect(civilYearsBetween('1997-09-17', '2026-09-17')).toBe(29);
    expect(civilYearsBetween('1997-09-18', '2026-09-17')).toBe(28);
    expect(civilYearsBetween('1997-10-01', '2026-09-30')).toBe(28);
  });
});
