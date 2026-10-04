import { renderHook } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import { addCivilDays, clinicToday } from '@/shared/api/clinic/clinic-time.ts';

import { type ClinicClock, clinicDayLabel, useClinicClock } from './useClinicClock.ts';

/** A translator that answers with the key's last segment ("today"). */
const t = ((key: string) => key.split('.').at(-1)) as unknown as TFunction;

const clock: ClinicClock = {
  today: '2026-10-04',
  dayOf: (instant) => instant.slice(0, 10),
  time: () => '10:12',
  shortTime: () => '10 am',
  date: (date) => `D:${date}`,
};

describe('clinicDayLabel', () => {
  it('names today, tomorrow and yesterday, and dates the rest', () => {
    expect(clinicDayLabel('2026-10-04', clock, t)).toBe('today');
    expect(clinicDayLabel('2026-10-05', clock, t)).toBe('tomorrow');
    expect(clinicDayLabel('2026-10-03', clock, t)).toBe('yesterday');
    expect(clinicDayLabel('2026-09-25', clock, t)).toBe('D:2026-09-25');
  });
});

describe('useClinicClock', () => {
  it('reads today on the clinic calendar and dates other days', () => {
    const { result } = renderHook(() => useClinicClock());
    const today = clinicToday();
    expect(result.current.today).toBe(today);
    expect(result.current.dayOf(new Date().toISOString())).toBe(today);
    expect(result.current.date(addCivilDays(today, -9))).toMatch(/\d/);
    expect(result.current.time(new Date().toISOString())).toMatch(/\d/);
  });
});
