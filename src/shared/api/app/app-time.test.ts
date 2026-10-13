import { describe, expect, it } from 'vitest';

import {
  addCivilDays,
  addCivilMonths,
  appClockTime,
  appInstant,
  appToday,
  civilDateOf,
  civilDayOffset,
  civilDayReading,
  civilMonthStart,
  civilYearsBetween,
  clockMinutes,
  clockOfMinutes,
  localDateOf,
  workingDaysPattern,
} from './app-time.ts';

describe('clinic clock (Asia/Kolkata)', () => {
  it("reads today's clinic date, not the UTC one", () => {
    // 20:00 UTC on 2 Oct is 01:30 on 3 Oct in the clinic.
    expect(appToday(new Date('2026-10-02T20:00:00Z'))).toBe('2026-10-03');
    expect(appToday(new Date('2026-10-03T10:00:00Z'))).toBe('2026-10-03');
  });

  it('turns a clinic-local date and time into the UTC instant', () => {
    expect(appInstant('2026-10-03', '10:20')).toBe('2026-10-03T04:50:00.000Z');
    expect(appInstant('2026-10-03', '00:15')).toBe('2026-10-02T18:45:00.000Z');
  });

  it('reads the clinic-local clock time of an instant', () => {
    expect(appClockTime(new Date('2026-10-03T04:50:00Z'))).toBe('10:20');
  });

  it('turns a clock time into minutes after midnight and back', () => {
    expect(clockMinutes('00:00')).toBe(0);
    expect(clockMinutes('10:30')).toBe(630);
    expect(clockMinutes('23:45')).toBe(1425);
    expect(clockOfMinutes(630)).toBe('10:30');
    expect(clockOfMinutes(5)).toBe('00:05');
    expect(clockOfMinutes(clockMinutes('19:15'))).toBe('19:15');
  });

  it('does calendar arithmetic across month and year ends', () => {
    expect(addCivilDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addCivilDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addCivilDays('2026-10-03', 0)).toBe('2026-10-03');
  });

  it('moves by calendar months, held to the last day of a shorter month', () => {
    expect(addCivilMonths('2026-09-28', 1)).toBe('2026-10-28');
    expect(addCivilMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addCivilMonths('2027-01-31', 1)).toBe('2027-02-28');
    expect(addCivilMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addCivilMonths('2026-10-31', -1)).toBe('2026-09-30');
  });

  it('names the first day of a date’s month', () => {
    expect(civilMonthStart('2026-10-17')).toBe('2026-10-01');
    expect(civilMonthStart('2026-10-01')).toBe('2026-10-01');
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

describe('civilDayReading (the one time rule)', () => {
  const today = '2026-10-05';
  it.each([
    ['2026-10-05', 'today'],
    ['2026-10-04', 'yesterday'],
    ['2026-10-03', 'thisWeek'],
    ['2026-09-29', 'thisWeek'],
    ['2026-09-28', 'earlier'],
    ['2025-10-05', 'earlier'],
    ['2026-10-06', 'tomorrow'],
    ['2026-10-07', 'ahead'],
    ['2027-01-04', 'ahead'],
  ] as const)('reads %s as %s', (date, reading) => {
    expect(civilDayReading(today, date)).toBe(reading);
  });

  it('counts back across a month and a year end', () => {
    expect(civilDayReading('2027-01-02', '2026-12-31')).toBe('thisWeek');
    expect(civilDayReading('2027-01-01', '2026-12-31')).toBe('yesterday');
    expect(civilDayReading('2026-12-31', '2027-01-01')).toBe('tomorrow');
  });
});

describe('workingDaysPattern (usRange, H:3608)', () => {
  it('reads all seven days as every day', () => {
    expect(workingDaysPattern(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])).toEqual(
      { kind: 'everyDay' },
    );
  });

  it('reads two or more days in a row as a run, in week order', () => {
    expect(workingDaysPattern(['sat', 'mon', 'tue', 'wed', 'thu', 'fri'])).toEqual({
      kind: 'run',
      from: 'mon',
      to: 'sat',
    });
    expect(workingDaysPattern(['tue', 'wed'])).toEqual({
      kind: 'run',
      from: 'tue',
      to: 'wed',
    });
  });

  it('lists the days when they are not one run, and one day alone', () => {
    expect(workingDaysPattern(['fri', 'mon', 'wed'])).toEqual({
      kind: 'list',
      days: ['mon', 'wed', 'fri'],
    });
    expect(workingDaysPattern(['thu'])).toEqual({ kind: 'list', days: ['thu'] });
  });

  it('reads no days as none', () => {
    expect(workingDaysPattern([])).toEqual({ kind: 'none' });
  });
});
