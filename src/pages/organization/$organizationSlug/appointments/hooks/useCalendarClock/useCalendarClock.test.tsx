import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';

import { useCalendarClock } from './useCalendarClock.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(clinicInstant('2026-10-03', '10:30')));
});
afterEach(() => vi.useRealTimers());

describe('useCalendarClock', () => {
  it('reads today and the minutes after midnight on the clinic’s clock', () => {
    const { result } = renderHook(() => useCalendarClock());
    expect(result.current).toEqual({ today: '2026-10-03', minutes: 630 });
  });

  it('moves on every minute, across midnight too', () => {
    vi.setSystemTime(new Date(clinicInstant('2026-10-03', '23:59')));
    const { result } = renderHook(() => useCalendarClock());
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toEqual({ today: '2026-10-04', minutes: 0 });
  });
});
