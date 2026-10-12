import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { useTableDay } from './patient-table-format.ts';

describe('useTableDay — a record’s day as the section tables write it', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    useLocaleStore.getState().setFormatLocale('en-IN');
  });
  afterEach(() => {
    vi.useRealTimers();
    useLocaleStore.getState().setFormatLocale('en-US');
  });

  it('writes a day with its year, and drops the year of this year’s days when short', () => {
    vi.setSystemTime(new Date('2026-10-12T06:00:00Z'));
    const { result } = renderHook(() => useTableDay());
    expect(result.current('2026-10-04')).toBe('4 Oct 2026');
    expect(result.current('2026-10-04', true)).toBe('4 Oct');
    expect(result.current('2025-10-04', true)).toBe('4 Oct 2025');
  });

  it('reads "this year" on the clinic’s clock — already the new year at 00:30 in India', () => {
    // 19:00 on 31 Dec in UTC is 00:30 on 1 Jan in the clinic.
    vi.setSystemTime(new Date('2026-12-31T19:00:00Z'));
    const { result } = renderHook(() => useTableDay());
    expect(result.current('2027-01-01', true)).toBe('1 Jan');
    expect(result.current('2026-12-31', true)).toBe('31 Dec 2026');
  });

  it('keeps a calendar day on its day whatever the viewer’s own zone', () => {
    vi.setSystemTime(new Date('2026-10-12T06:00:00Z'));
    const { result } = renderHook(() => useTableDay());
    expect(result.current('2026-01-01')).toBe('1 Jan 2026');
    expect(result.current('2026-12-31')).toBe('31 Dec 2026');
  });
});
