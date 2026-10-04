import { renderHook } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { afterEach, describe, expect, it } from 'vitest';

import { addCivilDays, clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import {
  type ClinicClock,
  clinicDayLabel,
  clinicWallClock,
  useClinicClock,
} from './useClinicClock.ts';

/** A translator that answers with the key's last segment ("today"). */
const t = ((key: string) => key.split('.').at(-1)) as unknown as TFunction;

const clock: ClinicClock = {
  today: '2026-10-04',
  dayOf: (instant) => instant.slice(0, 10),
  time: () => '10:12',
  shortTime: () => '10 am',
  date: (date) => `D:${date}`,
  wallTime: (_date, time) => time,
};

const initialHourCycle = useLocaleStore.getState().hourCycle;
afterEach(() => useLocaleStore.setState({ hourCycle: initialHourCycle }));

describe('clinicDayLabel', () => {
  it('names today, tomorrow and yesterday, and dates the rest', () => {
    expect(clinicDayLabel('2026-10-04', clock, t)).toBe('today');
    expect(clinicDayLabel('2026-10-05', clock, t)).toBe('tomorrow');
    expect(clinicDayLabel('2026-10-03', clock, t)).toBe('yesterday');
    expect(clinicDayLabel('2026-09-25', clock, t)).toBe('D:2026-09-25');
  });
});

describe('clinicWallClock', () => {
  it('holds the clinic-local day and time as its own fields', () => {
    const wall = clinicWallClock('2026-10-03', '15:30');
    expect([wall.getFullYear(), wall.getMonth(), wall.getDate()]).toEqual([2026, 9, 3]);
    expect([wall.getHours(), wall.getMinutes()]).toEqual([15, 30]);
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

  it('words a clinic-local wall-clock time in the viewer’s hour cycle (§7.2)', () => {
    useLocaleStore.setState({ hourCycle: 'h23' });
    const { result, rerender } = renderHook(() => useClinicClock());
    expect(result.current.wallTime('2026-10-03', '09:05')).toBe('09:05');
    useLocaleStore.setState({ hourCycle: 'h12' });
    rerender();
    expect(result.current.wallTime('2026-10-03', '15:30')).toMatch(/^3:30\s?pm$/i);
  });
});
