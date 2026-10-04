import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useLocaleStore } from '@/shared/store/useLocaleStore/index.ts';

import { useDayTime } from './useDayTime.ts';

describe('useDayTime', () => {
  afterEach(() => {
    useLocaleStore.setState({
      formatLocale: 'en-US',
      hourCycle: 'auto',
      timeZone: 'auto',
    });
  });

  it('reads an instant as "Sep 24 · 14:50" in the viewer’s zone and hour cycle', () => {
    useLocaleStore.setState({
      formatLocale: 'en-US',
      hourCycle: 'h23',
      timeZone: 'Asia/Kolkata',
    });
    const { result } = renderHook(() => useDayTime());
    // 09:20 UTC is 14:50 in Kolkata.
    expect(result.current('2026-09-24T09:20:00.000Z')).toBe('Sep 24 · 14:50');
  });

  it('writes the day as the format locale does', () => {
    useLocaleStore.setState({
      formatLocale: 'en-IN',
      hourCycle: 'h23',
      timeZone: 'Asia/Kolkata',
    });
    const { result } = renderHook(() => useDayTime());
    expect(result.current('2026-09-24T09:20:00.000Z')).toBe('24 Sept · 14:50');
  });

  it('follows a 12-hour clock', () => {
    useLocaleStore.setState({
      formatLocale: 'en-US',
      hourCycle: 'h12',
      timeZone: 'Asia/Kolkata',
    });
    const { result } = renderHook(() => useDayTime());
    expect(result.current('2026-09-24T09:20:00.000Z')).toMatch(/^Sep 24 · 2:50\sPM$/);
  });
});
