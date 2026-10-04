import { describe, expect, it } from 'vitest';

import { birthdayInDays, lastFourDigits, patientTenure } from './patient-rail.ts';

describe('patientTenure', () => {
  it('counts days below 60, then months of 30.4 days', () => {
    expect(patientTenure('2026-10-04', '2026-10-04')).toEqual({ kind: 'today' });
    expect(patientTenure('2026-10-03', '2026-10-04')).toEqual({ kind: 'days', count: 1 });
    expect(patientTenure('2026-08-20', '2026-10-04')).toEqual({
      kind: 'days',
      count: 45,
    });
    expect(patientTenure('2026-08-05', '2026-10-04')).toEqual({
      kind: 'months',
      count: 2,
    });
    expect(patientTenure('2025-10-04', '2026-10-04')).toEqual({
      kind: 'months',
      count: 12,
    });
  });
});

describe('birthdayInDays', () => {
  it('counts the days to the next birthday within 45 days, 0 on the day', () => {
    expect(birthdayInDays('1996-10-04', '2026-10-04')).toBe(0);
    expect(birthdayInDays('1996-10-28', '2026-10-04')).toBe(24);
    expect(birthdayInDays('1996-11-18', '2026-10-04')).toBe(45);
    expect(birthdayInDays('1996-11-19', '2026-10-04')).toBeNull();
  });

  it('looks into next year once this year’s has passed', () => {
    expect(birthdayInDays('1990-01-10', '2026-12-20')).toBe(21);
    expect(birthdayInDays('1990-10-03', '2026-10-04')).toBeNull();
  });

  it('keeps a 29 February birthday on 28 February in a common year', () => {
    expect(birthdayInDays('2000-02-29', '2027-02-20')).toBe(8);
  });

  it('has nothing to say without a birth date', () => {
    expect(birthdayInDays(null, '2026-10-04')).toBeNull();
  });
});

describe('lastFourDigits', () => {
  it('reads the last four digits of a stored number', () => {
    expect(lastFourDigits('+91 98250 43212')).toBe('3212');
    expect(lastFourDigits('+919825043212')).toBe('3212');
  });
});
