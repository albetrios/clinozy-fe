import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHoursFormat } from './useHoursFormat.ts';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T04:30:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('useHoursFormat — days, hours and times', () => {
  it('reads a run, every day and a list of days (usRange, H:3608)', () => {
    const { result } = renderHook(() => useHoursFormat());
    expect(
      result.current.hours(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], '09:30', '19:30'),
    ).toBe('Mon–Sat · 09:30–19:30');
    expect(
      result.current.hours(
        ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
        '00:00',
        '23:59',
      ),
    ).toBe('Every day · 00:00–23:59');
    expect(result.current.days(['fri', 'mon', 'wed'])).toBe('Mon, Wed, Fri');
    expect(result.current.days([])).toBe('');
  });

  it('reads an update by the rooms’ one time rule — today its time, another year’s with its year', () => {
    const { result } = renderHook(() => useHoursFormat());
    expect(result.current.updated('2026-10-03T03:32:00.000Z')).toMatch(
      /^Today 9:02\sAM$/,
    );
    expect(result.current.updated('2026-10-02T03:32:00.000Z')).toMatch(
      /^Yesterday 9:02\sAM$/,
    );
    expect(result.current.updated('2025-12-09T05:08:00.000Z')).toMatch(/2025/);
    expect(result.current.updated('2026-08-23T06:22:00.000Z')).not.toMatch(/2026/);
  });
});
