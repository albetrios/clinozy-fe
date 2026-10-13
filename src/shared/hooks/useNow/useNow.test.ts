import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNow } from './useNow.ts';

const START = new Date('2026-10-04T05:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => vi.useRealTimers());

describe('useNow', () => {
  it('reads the real clock and moves on every minute', () => {
    const { result } = renderHook(() => useNow());
    expect(result.current).toEqual(START);
    act(() => vi.advanceTimersByTime(59_999));
    expect(result.current).toEqual(START);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toEqual(new Date(START.getTime() + 60_000));
  });

  it('moves at the step it is given', () => {
    const { result } = renderHook(() => useNow(1_000));
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toEqual(new Date(START.getTime() + 1_000));
  });
});
